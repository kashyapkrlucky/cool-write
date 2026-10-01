import { useActiveDoc, useDocuments } from '../../store/useDocuments'
import { SparklesIcon } from 'lucide-react'
import { Button } from '../ui/Button'
import { useSettings } from '../../store/useSettings'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LIMITS, type Document, type UpdateDocumentInput } from '../../types'
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor'
import { registerSaveFlusher } from '../../lib/pendingSaves'

const SAVE_DEBOUNCE_MS = 800
// Browsers cap the total body size of in-flight keepalive requests at 64 KiB.
const KEEPALIVE_MAX_BYTES = 60_000

type SaveState = 'saved' | 'saving' | 'error' | 'conflict'

class SaveConflictError extends Error {
    constructor(readonly serverDocument: Document) {
        super('Document was changed somewhere else')
    }
}

// Sends a PATCH with `keepalive` whenever the body is small enough, so a save
// started just before the tab closes still reaches the server.
async function patchDocument(id: string, patch: UpdateDocumentInput, baseUpdatedAt: string | null) {
    const body = JSON.stringify(baseUpdatedAt ? { ...patch, baseUpdatedAt } : patch)
    const res = await fetch(`/api/v1/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: new Blob([body]).size <= KEEPALIVE_MAX_BYTES,
        credentials: 'same-origin',
    })
    if (res.status === 401) {
        window.location.assign('/login')
        throw new Error('Signed out')
    }
    const data = await res.json().catch(() => null)
    if (res.status === 409 && data?.document) throw new SaveConflictError(data.document)
    if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`)
    return data as Document
}

// Debounced, strictly ordered autosave for a single document. Every save
// carries the version the editor last saw, so edits made elsewhere (another
// tab, the desktop app) surface as a conflict instead of being overwritten.
function useAutosave(doc: Document) {
    const documentId = doc.id
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [conflict, setConflict] = useState<Document | null>(null)
    const baseRef = useRef<string | null>(doc.updatedAt)
    const pendingRef = useRef<UpdateDocumentInput | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const inFlightRef = useRef(false)
    const conflictRef = useRef(false)

    const flush = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
        // One save at a time; the running save flushes again when it finishes.
        // While in conflict, nothing is sent until the user resolves it.
        if (inFlightRef.current || conflictRef.current) return
        const patch = pendingRef.current
        if (!patch) return
        pendingRef.current = null
        inFlightRef.current = true

        patchDocument(documentId, patch, baseRef.current)
            .then((saved) => {
                baseRef.current = saved.updatedAt
                useDocuments.getState().applySavedDocument(saved)
                inFlightRef.current = false
                if (pendingRef.current) flush()
                else setSaveState('saved')
            })
            .catch((error) => {
                inFlightRef.current = false
                // Keep the unsaved changes; anything typed since takes precedence.
                pendingRef.current = { ...patch, ...pendingRef.current }
                if (error instanceof SaveConflictError) {
                    conflictRef.current = true
                    setConflict(error.serverDocument)
                    setSaveState('conflict')
                } else {
                    console.error('Error saving document:', error)
                    setSaveState('error')
                }
            })
    }, [documentId])

    const schedule = useCallback(
        (patch: UpdateDocumentInput) => {
            pendingRef.current = { ...pendingRef.current, ...patch }
            if (conflictRef.current) return
            setSaveState('saving')
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS)
        },
        [flush],
    )

    // Conflict resolution: overwrite the server with everything shown locally…
    const keepMine = useCallback(
        (local: UpdateDocumentInput) => {
            if (!conflict) return
            baseRef.current = conflict.updatedAt
            conflictRef.current = false
            setConflict(null)
            pendingRef.current = { ...local }
            setSaveState('saving')
            flush()
        },
        [conflict, flush],
    )

    // …or drop local changes and load the server's version (remounts the editor).
    const loadTheirs = useCallback(() => {
        if (!conflict) return
        pendingRef.current = null
        useDocuments.getState().replaceActiveDocument(conflict)
    }, [conflict])

    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') flush()
        }
        const onPageHide = () => {
            const patch = pendingRef.current
            if (!patch || conflictRef.current) return
            if (inFlightRef.current) {
                // A save is still running and the page is going away: send the
                // remaining edits without a version check rather than lose them.
                pendingRef.current = null
                patchDocument(documentId, patch, null).catch(() => {})
            } else {
                flush()
            }
        }
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (conflictRef.current && pendingRef.current) {
                e.preventDefault()
                return
            }
            onPageHide()
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        window.addEventListener('beforeunload', onBeforeUnload)
        window.addEventListener('pagehide', onPageHide)
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange)
            window.removeEventListener('beforeunload', onBeforeUnload)
            window.removeEventListener('pagehide', onPageHide)
            // Switching documents: save what's left of this one.
            flush()
        }
    }, [documentId, flush])

    // Resolves once pending edits are saved (or after a short timeout), e.g.
    // before the desktop app restarts to install an update.
    const flushAndWait = useCallback(async () => {
        const deadline = Date.now() + 2_500
        flush()
        while ((inFlightRef.current || (pendingRef.current && !conflictRef.current)) && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 50))
            if (!inFlightRef.current) flush()
        }
    }, [flush])

    useEffect(() => registerSaveFlusher(flushAndWait), [flushAndWait])

    return { saveState, conflict, schedule, flush, keepMine, loadTheirs }
}

function DocumentEditor({ doc }: { doc: Document }) {
    const focusMode = useSettings((s) => s.focusMode)
    const markdownSource = useSettings((s) => s.markdownSource)
    const insertRequest = useDocuments((s) => s.insertRequest)
    const clearInsertRequest = useDocuments((s) => s.clearInsertRequest)
    const [title, setTitle] = useState(doc.title)
    const [content, setContent] = useState(doc.content)
    const editorRef = useRef<MarkdownEditorHandle | null>(null)
    const { saveState, conflict, schedule, flush, keepMine, loadTheirs } = useAutosave(doc)

    const onContentChange = useCallback(
        (next: string) => {
            setContent(next)
            schedule({ content: next })
        },
        [schedule],
    )

    // AI "add to document" requests go through the editor so they land in its
    // undo history (Cmd/Ctrl+Z reverts an insert) and trigger a normal save.
    useEffect(() => {
        if (!insertRequest) return
        const editor = editorRef.current
        if (!editor) return
        if (insertRequest.mode === 'cursor') editor.insertAtCursor(insertRequest.content)
        else if (insertRequest.mode === 'append') editor.append(insertRequest.content)
        else editor.replaceAll(insertRequest.content)
        clearInsertRequest()
    }, [insertRequest, clearInsertRequest])

    return <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">

        <div
            className={`mx-auto flex min-h-0 w-full flex-1 flex-col px-4 pt-8 transition-all ${focusMode ? 'max-w-4xl' : 'max-w-5xl'
                }`}
        >
            {conflict && (
                <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-(--danger)/40 bg-(--surface) px-3 py-2 text-xs text-(--ink)">
                    <span className="flex-1">
                        This document was changed somewhere else (another tab or device). Your latest edits aren&apos;t saved yet.
                    </span>
                    <button onClick={loadTheirs} className="rounded-md border border-(--border) px-2 py-1 hover:bg-(--surface-hover)">
                        Load their version
                    </button>
                    <button onClick={() => keepMine({ title, content })} className="rounded-md bg-(--accent-1) px-2 py-1 font-medium text-white">
                        Keep mine
                    </button>
                </div>
            )}
            <input
                value={title}
                onChange={(e) => {
                    setTitle(e.target.value)
                    schedule({ title: e.target.value })
                }}
                placeholder="Untitled"
                aria-label="Document title"
                maxLength={LIMITS.titleMaxLength}
                className="mb-4 bg-transparent text-[2.25rem] font-semibold leading-tight tracking-[-0.02em] text-(--ink) placeholder:text-(--ink-faint) focus:outline-none"
            />
            <MarkdownEditor
                initialValue={doc.content}
                onChange={onContentChange}
                maxLength={LIMITS.contentMaxLength}
                placeholder="Start writing... (Markdown supported)"
                ariaLabel="Document content"
                handleRef={editorRef}
                livePreview={!markdownSource}
            />
        </div>

        <footer className="flex items-center gap-2.5 mb-2 rounded-full border border-(--border-soft) bg-(--bg-elevated)/80 px-2.5 py-1 text-[11px] text-(--ink) backdrop-blur">
            <span className="flex items-center gap-1.5" role="status">
                <span
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${saveState === 'saving'
                        ? 'animate-pulse-soft bg-(--accent-2)'
                        : saveState === 'error' || saveState === 'conflict'
                            ? 'bg-(--danger)'
                            : 'bg-(--ink)/50'
                        }`}
                />
                {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Not saved'}
            </span>
            {saveState === 'error' && (
                <button onClick={() => flush()} className="font-medium text-(--accent-1) hover:underline">
                    Retry
                </button>
            )}
            <span className="h-3 w-px bg-(--border)" />
            {content.split(/\s+/).filter(Boolean).length} words
        </footer>
    </div>
}

export function Editor() {
    const createDocument = useDocuments((s) => s.createDocument)
    const activeId = useDocuments((s) => s.activeId)
    const activeStatus = useDocuments((s) => s.activeStatus)
    const activeRevision = useDocuments((s) => s.activeRevision)
    const setActiveId = useDocuments((s) => s.setActiveId)
    const activeDoc = useActiveDoc()

    const onCreateDocument = async () => {
        try {
            await createDocument("Untitled")
        } catch (error) {
            console.error('Error creating document:', error)
        }
    }

    if (activeId && activeStatus === 'loading') {
        return <div className="flex flex-1 items-center justify-center text-sm text-(--ink-faint)">Loading document…</div>
    }

    if (activeId && activeStatus === 'error') {
        return <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-(--ink-faint)">
            <p>Couldn&apos;t load this document.</p>
            <Button variant="outline" size="sm" onClick={() => setActiveId(activeId)}>Try again</Button>
        </div>
    }

    if (!activeDoc) {
        return <div className="flex flex-1 flex-col items-center justify-center gap-4 text-(--ink-faint)">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-(--border-soft) bg-(--surface)">
                <SparklesIcon size={20} className="text-(--accent-1)" />
            </div>
            <p className="text-sm">No document open</p>
            <Button onClick={onCreateDocument}>
                Create a document
            </Button>
        </div>
    }

    // Keyed by id + revision: switching documents (or reloading after a
    // conflict) unmounts the previous editor, which flushes its pending save.
    return <DocumentEditor key={`${activeDoc.id}:${activeRevision}`} doc={activeDoc} />
}
