import type { Document } from '@repo/types'
import { create } from 'zustand'
import { httpClient } from '../lib/httpClient'

interface DocumentsState {
    status: 'idle' | 'loading' | 'success' | 'error';
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
    status: 'idle',
    documents: [],
    activeId: null,
    getDocument: (id: string) => {
        const { documents } = get()
        return documents.find((doc) => doc.id === id)
    },
    setStatus: (status: 'idle' | 'loading' | 'success' | 'error') => set({ status }),
    getDocuments: async () => {
        try {
            set({ status: 'loading' })
            const { data } = await httpClient.get('/api/v1/documents')
            set({ documents: data, status: 'success' })
            return data
        } catch (error) {
            console.error('Error getting documents:', error)
            set({ status: 'error' })
            return []
        }
    },
    createDocument: async (title: string) => {
        try {
            set({ status: 'loading' })
            const { data } = await httpClient.post('/api/v1/documents', { title });
            set({ documents: [data, ...get().documents], status: 'success' });
            return data;
        } catch (error) {
            console.error('Error creating document:', error)
            set({ status: 'error' })
            throw error;
        }
    },
    deleteDocument: async (id: string) => {
        try {
            set({ status: 'loading' })
            await httpClient.delete(`/api/v1/documents/${id}`);
            set({ documents: get().documents.filter((doc) => doc.id !== id), status: 'success' });
        } catch (error) {
            console.error('Error deleting document:', error)
            set({ status: 'error' })
            throw error;
        }
    },
    setActiveId: (id: string | null) => set({ activeId: id }),
    renameDocument: async (id: string, title: string) => {
        try {
            const { data } = await httpClient.patch(`/api/v1/documents/${id}`, { title });
            set({ documents: get().documents.map((doc) => (doc.id === id ? { ...doc, title, updatedAt: new Date() } : doc)), status: 'success' })
            return data;
        } catch (error) {
            console.error('Error updating document:', error)
            set({ status: 'error' })
            throw error;
        }
    },
    updateContent: async (id: string, content: string) => {
        try {
            const { data } = await httpClient.patch(`/api/v1/documents/${id}`, { content });
            set({ documents: get().documents.map((doc) => (doc.id === id ? { ...doc, content, updatedAt: new Date() } : doc)), status: 'success' })
            return data;
        } catch (error) {
            console.error('Error updating document:', error)
            set({ status: 'error' })
            throw error;
        }
    },
}))


export function useActiveDoc(): Document | null {
    const documents = useDocuments((s) => s.documents)
    const activeId = useDocuments((s) => s.activeId)
    return documents.find((d) => d.id === activeId) ?? null
}
