// Shared by API validation and editor inputs so both sides agree on the limits.
export const LIMITS = {
    titleMaxLength: 200,
    // ~1 MB of text; comfortably above any real document, bounds DB rows and AI context.
    contentMaxLength: 1_000_000,
    promptMaxLength: 8_000,
} as const

// Characters of content returned with each document in the list endpoint.
export const DOCUMENT_PREVIEW_LENGTH = 200

// Dates are ISO strings: this is the JSON shape the API returns.
export interface Document {
    id: string
    title: string
    content: string
    createdAt: string
    updatedAt: string
}

export interface DocumentSummary {
    id: string
    title: string
    preview: string
    createdAt: string
    updatedAt: string
}

export interface CreateDocumentInput {
  title: string
  content?: string
}

export interface UpdateDocumentInput {
  title?: string
  content?: string
}
