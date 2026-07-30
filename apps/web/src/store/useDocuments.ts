import type { Document } from '@repo/types'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { httpClient } from '../lib/httpClient'

interface DocumentsState {
    documents: Document[];
    activeId: string | null;
    setActiveId: (id: string | null) => void;
    getDocument: (id: string) => Document | undefined
    getDocuments: () => Promise<Document[]>
    createDocument: (title: string) => Promise<Document>
    deleteDocument: (id: string) => void
    renameDocument: (id: string, title: string) => void
    updateContent: (id: string, content: string) => void
}

export const useDocuments = create<DocumentsState>()(
    persist(
        (set, get) => ({
            documents: [],
            activeId: null,
            getDocument: (id: string) => {
                const { documents } = get()
                return documents.find((doc) => doc.id === id)
            },
            getDocuments: async () => {
                try {
                    const { data } = await httpClient.get('/api/v1/documents')
                    set({ documents: data })
                    return data
                } catch (error) {
                    console.error('Error getting documents:', error)
                    return []
                }
            },
            createDocument: async (title: string) => {
                try {
                    const { data } = await httpClient.post('/api/v1/documents', { title });
                    console.log('Document created:', data);
                    set({ documents: [...get().documents, data] });
                    return data;
                } catch (error) {
                    console.error('Error creating document:', error)
                    throw error;
                }
            },
            deleteDocument: (id: string) => {
                const { documents } = get()
                set({ documents: documents.filter((doc) => doc.id !== id) })
            },
            setActiveId: (id: string | null) => set({ activeId: id }),
            renameDocument: async (id: string, title: string) => {
                try {
                    const { data } = await httpClient.patch(`/api/v1/documents/${id}`, { title });
                    console.log('Document updated:', data);
                    set({ documents: get().documents.map((doc) => (doc.id === id ? { ...doc, title, updatedAt: new Date() } : doc)) })
                    return data;
                } catch (error) {
                    console.error('Error updating document:', error)
                    throw error;
                }
            },
            updateContent: async (id: string, content: string) => {
                try {
                    const { data } = await httpClient.patch(`/api/v1/documents/${id}`, { content });
                    console.log('Document updated:', data);
                    set({ documents: get().documents.map((doc) => (doc.id === id ? { ...doc, content, updatedAt: new Date() } : doc)) })
                    return data;
                } catch (error) {
                    console.error('Error updating document:', error)
                    throw error;
                }
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
