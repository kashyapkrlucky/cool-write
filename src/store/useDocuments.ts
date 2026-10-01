import { DOCUMENT_PREVIEW_LENGTH, type Document, type DocumentSummary } from '../types'
import { create } from 'zustand'
import { httpClient } from '../lib/httpClient'

interface InsertRequest {
    content: string;
    // 'cursor' inserts at the caret (replacing any selection) in the open editor.
    mode: 'cursor' | 'append' | 'replace';
}

const LAST_ACTIVE_KEY = 'cool-write:last-active-document'

function readLastActiveId(): string | null {
    try {
        return localStorage.getItem(LAST_ACTIVE_KEY)
    } catch {
        return null
    }
}

function writeLastActiveId(id: string | null) {
    try {
        if (id) localStorage.setItem(LAST_ACTIVE_KEY, id)
        else localStorage.removeItem(LAST_ACTIVE_KEY)
    } catch {
        // Storage unavailable (private mode etc.) — remembering the last doc is best-effort.
    }
}

function toSummary(doc: Document): DocumentSummary {
    return {
        id: doc.id,
        title: doc.title,
        preview: doc.content.slice(0, DOCUMENT_PREVIEW_LENGTH),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    }
}

function upsertSorted(documents: DocumentSummary[], summary: DocumentSummary) {
    return [summary, ...documents.filter((doc) => doc.id !== summary.id)].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
}

interface DocumentsState {
    // Status of loading the document list only. Individual saves/creates/deletes
    // report their own errors to the caller and never touch this.
    status: 'idle' | 'loading' | 'success' | 'error';
    documents: DocumentSummary[];
    activeId: string | null;
    // Full contents of the open document, fetched on demand.
    activeDocument: Document | null;
    activeStatus: 'idle' | 'loading' | 'success' | 'error';
    // Bumped whenever the open document is (re)loaded from the server, so the
    // editor remounts with fresh contents instead of keeping local state.
    activeRevision: number;
    insertRequest: InsertRequest | null;
    setActiveId: (id: string | null) => void;
    getDocuments: () => Promise<DocumentSummary[]>
    createDocument: (title: string) => Promise<Document>
    deleteDocument: (id: string) => Promise<void>
    applySavedDocument: (doc: Document) => void
    replaceActiveDocument: (doc: Document) => void
    requestInsert: (content: string, mode?: InsertRequest['mode']) => void
    clearInsertRequest: () => void
}

export const useDocuments = create<DocumentsState>()((set, get) => ({
    status: 'idle',
    documents: [],
    activeId: null,
    activeDocument: null,
    activeStatus: 'idle',
    activeRevision: 0,
    insertRequest: null,
    requestInsert: (content: string, mode: InsertRequest['mode'] = 'append') => set({ insertRequest: { content, mode } }),
    clearInsertRequest: () => set({ insertRequest: null }),
    getDocuments: async () => {
        try {
            set({ status: 'loading' })
            const { data } = await httpClient.get<DocumentSummary[]>('/api/v1/documents')
            set({ documents: data, status: 'success' })
            const lastActiveId = get().activeId ?? readLastActiveId()
            const nextActiveId = data.some((doc) => doc.id === lastActiveId)
                ? lastActiveId
                : data[0]?.id ?? null
            if (nextActiveId !== get().activeId || !get().activeDocument) get().setActiveId(nextActiveId)
            return data
        } catch (error) {
            console.error('Error getting documents:', error)
            set({ status: 'error' })
            return []
        }
    },
    createDocument: async (title: string) => {
        const { data } = await httpClient.post<Document>('/api/v1/documents', { title })
        set({
            documents: upsertSorted(get().documents, toSummary(data)),
            activeId: data.id,
            activeDocument: data,
            activeStatus: 'success',
            activeRevision: get().activeRevision + 1,
        })
        writeLastActiveId(data.id)
        return data
    },
    deleteDocument: async (id: string) => {
        await httpClient.delete(`/api/v1/documents/${id}`)
        const documents = get().documents.filter((doc) => doc.id !== id)
        set({ documents })
        if (get().activeId === id) get().setActiveId(documents[0]?.id ?? null)
    },
    setActiveId: (id: string | null) => {
        writeLastActiveId(id)
        if (!id) {
            set({ activeId: null, activeDocument: null, activeStatus: 'idle' })
            return
        }
        set({ activeId: id, activeDocument: null, activeStatus: 'loading' })
        httpClient
            .get<Document>(`/api/v1/documents/${id}`)
            .then(({ data }) => {
                // Ignore responses for a document the user already navigated away from.
                if (get().activeId !== id) return
                set({ activeDocument: data, activeStatus: 'success', activeRevision: get().activeRevision + 1 })
            })
            .catch((error) => {
                if (get().activeId !== id) return
                console.error('Error loading document:', error)
                set({ activeStatus: 'error' })
            })
    },
    // Called after a successful save: refreshes the list entry and the open
    // document's version without remounting the editor.
    applySavedDocument: (doc: Document) => {
        const { activeDocument } = get()
        set({
            documents: upsertSorted(get().documents, toSummary(doc)),
            activeDocument: activeDocument?.id === doc.id ? doc : activeDocument,
        })
    },
    // Replaces the open document with the server's version (e.g. after a
    // conflict) and remounts the editor with it.
    replaceActiveDocument: (doc: Document) => {
        set({
            documents: upsertSorted(get().documents, toSummary(doc)),
            activeDocument: get().activeId === doc.id ? doc : get().activeDocument,
            activeRevision: get().activeRevision + 1,
        })
    },
}))


export function useActiveDoc(): Document | null {
    const activeDocument = useDocuments((s) => s.activeDocument)
    const activeId = useDocuments((s) => s.activeId)
    return activeDocument?.id === activeId ? activeDocument : null
}
