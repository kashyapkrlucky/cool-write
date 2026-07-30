export interface Document {
    id: string
    title: string
    content: string
    createdAt: Date
    updatedAt: Date
}


export interface CreateDocumentInput {
  title?: string
  content?: string
}

export interface UpdateDocumentInput {
  title?: string
  content?: string
}
