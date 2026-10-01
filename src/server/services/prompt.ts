import { AI_CONTEXT_HEAD_CHARS, AI_CONTEXT_TAIL_CHARS } from "../core/limits"

// Long documents keep their beginning and end, which is what summaries and
// "continue writing" need most, and bound the per-request token cost.
export function documentContext(content: string) {
    if (content.length <= AI_CONTEXT_HEAD_CHARS + AI_CONTEXT_TAIL_CHARS) return content
    const omitted = content.length - AI_CONTEXT_HEAD_CHARS - AI_CONTEXT_TAIL_CHARS
    return (
        content.slice(0, AI_CONTEXT_HEAD_CHARS) +
        `\n\n[… ${omitted} characters omitted …]\n\n` +
        content.slice(-AI_CONTEXT_TAIL_CHARS)
    )
}

export function buildSystemPrompt(document: { title?: string; content?: string } | null | undefined) {
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
        `Current document content:\n"""\n${document.content ? documentContext(document.content) : "(empty)"}\n"""`
    )
}
