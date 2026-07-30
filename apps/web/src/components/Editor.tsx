import { useActiveDoc, useDocuments } from '../store/useDocuments'
import { SparklesIcon } from 'lucide-react'
import { Button } from '@repo/ui/Button'
import { useSettings } from '../store/useSettings'
import { useRef } from 'react'

export function Editor() {

    const focusMode = useSettings((s) => s.focusMode)
    const renameDocument = useDocuments((s) => s.renameDocument)
    const updateContent = useDocuments((s) => s.updateContent)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const activeDoc = useActiveDoc()
    if (!activeDoc) {
        return <div className="flex flex-1 flex-col items-center justify-center gap-4 text-(--ink-faint)">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-(--border-soft) bg-(--surface)">
                <SparklesIcon size={20} className="text-(--accent-1)" />
            </div>
            <p className="text-sm">No document open</p>
            <Button>
                Create a document
            </Button>
        </div>
    }
    return <div className="flex flex-1 flex-col items-center justify-center">

        <div
            className={`mx-auto flex w-full flex-1 flex-col overflow-y-auto px-4 pb-8 pt-12 transition-all ${focusMode ? 'max-w-2xl' : 'max-w-3xl'
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
                }}
                placeholder="Start writing…"
                spellCheck
                className="flex-1 resize-none bg-transparent text-[17px] leading-[1.8] text-(--ink) placeholder:text-(--ink-faint) focus:outline-none"
            />
        </div>

    </div>
}