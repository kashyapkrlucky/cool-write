import type { Document } from '@repo/types'
import { create } from 'zustand'

import { persist } from 'zustand/middleware'

interface DocumentsState {
    documents: Document[];
    activeId: string | null;
    setActiveId: (id: string | null) => void;
    setDocuments: (documents: Document[]) => void
    getDocument: (id: string) => Document | undefined
    getDocuments: () => Document[]
    createDocument: (title: string) => void
    updateDocument: (id: string, document: Document) => void
    deleteDocument: (id: string) => void
    renameDocument: (id: string, title: string) => void
    updateContent: (id: string, content: string) => void
}

export const useDocuments = create<DocumentsState>()(
    persist(
        (set, get) => ({
            documents: [],
            activeId: null,
            setDocuments: (documents: Document[]) => set({ documents }),
            getDocument: (id: string) => {
                const { documents } = get()
                return documents.find((doc) => doc.id === id)
            },
            getDocuments: () => {
                const { documents } = get()
                return documents
            },
            createDocument: (title: string) => {
                const { documents } = get()
                const document: Document = {
                    id: Date.now().toString(),
                    title,
                    content: '',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
                set({ documents: [...documents, document] })
            },
            updateDocument: (id: string, document: Document) => {
                const { documents } = get()
                set({ documents: documents.map((doc) => (doc.id === id ? document : doc)) })
            },
            deleteDocument: (id: string) => {
                const { documents } = get()
                set({ documents: documents.filter((doc) => doc.id !== id) })
            },
            setActiveId: (id: string | null) => set({ activeId: id }),
            renameDocument: (id: string, title: string) => {
                const { documents } = get()
                set({ documents: documents.map((doc) => (doc.id === id ? { ...doc, title, updatedAt: new Date() } : doc)) })
            },
            updateContent: (id: string, content: string) => {
                const { documents } = get()
                set({ documents: documents.map((doc) => (doc.id === id ? { ...doc, content, updatedAt: new Date() } : doc)) })
            },
        }),
        {
            name: 'documents',
        }
    )
)


export function useActiveDoc(): Document | null {
    const documents = useDocuments((s) => s.documents)
    const activeId = useDocuments((s) => s.activeId)
    return documents.find((d) => d.id === activeId) ?? null
}
