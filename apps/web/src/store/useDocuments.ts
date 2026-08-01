import type { Document } from '@repo/types'
import { create } from 'zustand'
import { httpClient } from '../lib/httpClient'

interface DocumentsState {
    documents: Document[];
    activeId: string | null;
    setActiveId: (id: string | null) => void;
    getDocument: (id: string) => Document | undefined
    getDocuments: () => Promise<Document[]>
    createDocument: (title: string) => Promise<Document>
    deleteDocument: (id: string) => Promise<void>
    renameDocument: (id: string, title: string) => Promise<void>
    updateContent: (id: string, content: string) => Promise<void>
}

export const useDocuments = create<DocumentsState>()((set, get) => ({
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
    deleteDocument: async (id: string) => {
        try {
            await httpClient.delete(`/api/v1/documents/${id}`);
            set({ documents: get().documents.filter((doc) => doc.id !== id) });
        } catch (error) {
            console.error('Error deleting document:', error)
            throw error;
        }
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
}))


export function useActiveDoc(): Document | null {
    const documents = useDocuments((s) => s.documents)
    const activeId = useDocuments((s) => s.activeId)
    return documents.find((d) => d.id === activeId) ?? null
}
