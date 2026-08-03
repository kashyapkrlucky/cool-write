export interface ChatMessage {
    id: string
    documentId: string
    role: 'user' | 'assistant'
    content: string
    createdAt: Date
}
