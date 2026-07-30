import { useActiveDoc, useDocuments } from '../store/useDocuments'
import { SparklesIcon } from 'lucide-react'
import { Button } from '@repo/ui/Button'
import { useSettings } from '../store/useSettings'
import { useEffect, useRef, useState } from 'react'

export function Editor() {

    const focusMode = useSettings((s) => s.focusMode)

    const [syncing, setSyncing] = useState(false)
    const renameDocument = useDocuments((s) => s.renameDocument)
    const setActiveId = useDocuments((s) => s.setActiveId)
    const updateContent = useDocuments((s) => s.updateContent)
    const createDocument = useDocuments((s) => s.createDocument)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)


    const onCreateDocument = async () => {
        const newDocId = await createDocument("Untitled")
        if (newDocId) {
            setActiveId(newDocId.id)
        }
    }

    function markDirty() {
        setSyncing(true)
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
        syncTimerRef.current = setTimeout(() => setSyncing(false), 750)
    }

    useEffect(() => {
        return () => {
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
        }
    }, [])

    const activeDoc = useActiveDoc()
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
    return <div className="flex flex-1 flex-col items-center justify-center">

        <div
            className={`mx-auto flex w-full flex-1 flex-col overflow-y-auto px-4 pb-8 pt-12 transition-all ${focusMode ? 'max-w-3xl' : 'max-w-4xl'
                }`}
        >
            <input
                value={activeDoc.title}
                onChange={(e) => {
                    renameDocument(activeDoc.id, e.target.value)
                }}
                placeholder="Untitled"
                className="mb-4 bg-transparent text-[2.25rem] font-semibold leading-tight tracking-[-0.02em] text-(--ink) placeholder:text-(--ink-faint) focus:outline-none"
            />
            <textarea
                ref={textareaRef}
                value={activeDoc.content}
                onChange={(e) => {
                    updateContent(activeDoc.id, e.target.value)
                    markDirty()
                }}
                placeholder="Start writing…"
                spellCheck
                className="flex-1 resize-none text-sm leading-[1.8] text-(--ink) placeholder:text-(--ink-faint) focus:outline-none p-4 rounded-sm bg-white"
            />
        </div>

        <footer className="pointer-events-none flex  items-center gap-2.5 rounded-full border border-(--border-soft) bg-(--bg-elevated)/80 px-2.5 py-1 text-[11px] text-(--ink-faint) backdrop-blur">
            <span className="flex items-center gap-1.5">
                <span
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${syncing ? 'animate-pulse-soft bg-(--accent-2)' : 'bg-(--ink-faint)/50'
                        }`}
                />
                {syncing ? 'Saving…' : 'Saved'}
            </span>
            <span className="h-3 w-px bg-(--border)" />
            {activeDoc.content.split(/\s+/).filter(Boolean).length} words
        </footer>
    </div>
}