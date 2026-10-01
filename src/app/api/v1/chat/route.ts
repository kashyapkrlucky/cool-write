import OpenAI from "openai"
import { requireApiUser } from "../../../../server/core/auth/session"
import { getDocument } from "../../../../server/services/Document"
import { getRecentMessages, saveExchange } from "../../../../server/services/ChatMessage"
import { consumeAiQuota } from "../../../../server/services/AiUsage"
import { chatRequestSchema, parseBody, readJson } from "../../../../server/core/validation"
import { buildSystemPrompt } from "../../../../server/services/prompt"
import {
    AI_HISTORY_MAX_CHARS,
    AI_HISTORY_MAX_MESSAGES,
    CHAT_BODY_MAX_BYTES,
} from "../../../../server/core/limits"
import { getEnv } from "../../../../server/env"

let openai: OpenAI | undefined
function getOpenAI(apiKey: string) {
    openai ??= new OpenAI({ apiKey })
    return openai
}

export async function POST(request: Request) {
    const { user, response } = await requireApiUser()
    if (!user) return response

    const env = getEnv()
    if (!env.OPENAI_API_KEY) {
        return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 })
    }

    const json = await readJson(request, CHAT_BODY_MAX_BYTES)
    if (!json.ok) return json.response
    const parsed = parseBody(chatRequestSchema, json.body)
    if (!parsed.ok) return parsed.response
    const { prompt } = parsed.data
    const documentId = parsed.data.documentId ?? null
    const promptAt = new Date()

    let document = null
    if (documentId) {
        document = await getDocument(documentId, user.id)
        if (!document) {
            return Response.json({ error: "Document not found" }, { status: 404 })
        }
    }

    const quota = await consumeAiQuota(user.id)
    if (!quota.allowed) {
        const error =
            quota.reason === "day"
                ? "You've reached today's AI limit. Please try again tomorrow."
                : "You're sending messages too quickly. Please wait a moment."
        return Response.json(
            { error },
            { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } },
        )
    }

    // Earlier turns give follow-ups ("make it shorter") something to refer to.
    const history = documentId
        ? await getRecentMessages(documentId, AI_HISTORY_MAX_MESSAGES, AI_HISTORY_MAX_CHARS)
        : []

    let stream
    try {
        stream = await getOpenAI(env.OPENAI_API_KEY).chat.completions.create(
            {
                model: env.OPENAI_MODEL,
                stream: true,
                messages: [
                    { role: "system", content: buildSystemPrompt(document) },
                    ...history.map((message) => ({ role: message.role, content: message.content })),
                    { role: "user", content: prompt },
                ],
            },
            { signal: request.signal },
        )
    } catch (error) {
        console.error("Error starting chat completion:", error)
        return Response.json({ error: "Failed to reach the AI provider" }, { status: 502 })
    }

    const encoder = new TextEncoder()
    let assistantText = ""
    const responseStream = new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                for await (const chunk of stream) {
                    const delta = chunk.choices[0]?.delta?.content
                    if (delta) {
                        assistantText += delta
                        controller.enqueue(encoder.encode(delta))
                    }
                }
            } catch (error) {
                if (!request.signal.aborted) {
                    console.error("Error while streaming chat completion:", error)
                    // Tell the reader the answer is incomplete instead of silently truncating it.
                    const notice = `${assistantText ? "\n\n" : ""}_(The response was interrupted. Please try again.)_`
                    try {
                        controller.enqueue(encoder.encode(notice))
                    } catch {
                        // Client already disconnected.
                    }
                }
            } finally {
                // Partial replies (user pressed stop) are kept; empty ones aren't.
                if (documentId && assistantText.trim()) {
                    try {
                        await saveExchange(documentId, prompt, promptAt, assistantText)
                    } catch (error) {
                        console.error("Error saving chat messages:", error)
                    }
                }
                try {
                    controller.close()
                } catch {
                    // Stream was cancelled by the client.
                }
            }
        },
        cancel() {
            stream.controller.abort()
        },
    })

    return new Response(responseStream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
        },
    })
}
