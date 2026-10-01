import { LIMITS } from "../../types"

// Content is capped in characters; UTF-8 can take up to 4 bytes per character,
// plus JSON escaping and the title.
export const DOCUMENT_BODY_MAX_BYTES = LIMITS.contentMaxLength * 4 + 64 * 1024

export const CHAT_BODY_MAX_BYTES = 64 * 1024

// How much of the document is sent to the model as context. Long documents keep
// their beginning and end (where "continue writing" picks up).
export const AI_CONTEXT_HEAD_CHARS = 12_000
export const AI_CONTEXT_TAIL_CHARS = 36_000

// Earlier chat turns sent with each request (newest kept first when trimming).
export const AI_HISTORY_MAX_MESSAGES = 20
export const AI_HISTORY_MAX_CHARS = 24_000
