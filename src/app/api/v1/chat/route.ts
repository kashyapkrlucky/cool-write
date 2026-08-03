import OpenAI from "openai"
import { requireApiUser } from "../../../../server/core/auth/session"
import { getDocument } from "../../../../server/services/Document"
import { createMessage } from "../../../../server/services/ChatMessage"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function buildSystemPrompt(document: { title?: string; content?: string } | null | undefined) {
    const base =
        "You are the AI writing assistant embedded in Cool Write, a distraction-free document editor. " +
        "Help the user write, edit, brainstorm, and answer questions about their current document. " +
        "When asked to produce or revise text for the document, reply with just that text unless the user asks for commentary."

    if (!document || (!document.title && !document.content)) {
        return `${base}\n\nThere is no document currently open.`
    }

    return (
        `${base}\n\n` +
        `Current document title: "${document.title || "Untitled"}"\n\n` +
        `Current document content:\n"""\n${document.content || "(empty)"}\n"""`
    )
}

export async function POST(request: Request) {
    const { user, response } = await requireApiUser()
    if (!user) return response

    if (!process.env.OPENAI_API_KEY) {
        return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 })
    }

    const body = await request.json().catch(() => null)
    const prompt = body?.prompt
    const documentId = typeof body?.documentId === "string" ? body.documentId : null

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return Response.json({ error: "Missing prompt" }, { status: 400 })
    }

    let document = null
    if (documentId) {
        document = await getDocument(documentId, user.id)
        if (!document) {
            return Response.json({ error: "Document not found" }, { status: 404 })
        }
        await createMessage(documentId, "user", prompt)
    }

    let stream
    try {
        stream = await openai.chat.completions.create(
            {
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                stream: true,
                messages: [
                    { role: "system", content: buildSystemPrompt(document) },
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
                }
            } finally {
                if (documentId && assistantText.trim()) {
                    try {
                        await createMessage(documentId, "assistant", assistantText)
                    } catch (error) {
                        console.error("Error saving assistant message:", error)
                    }
                }
                controller.close()
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
