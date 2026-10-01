
import { CodeIcon, EyeIcon, FilePlus2Icon, FileTextIcon, Maximize2Icon, Minimize2Icon, PanelRightIcon, SearchIcon, SunIcon, MoonIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '../../store/useSettings';
import { useDocuments } from '../../store/useDocuments';
import type { Command } from '../../types';

interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
}

const MAX_DOCUMENT_RESULTS = 8

export function CommandPalette({ open, onClose }: CommandPaletteProps) {

    const theme = useSettings((s) => s.theme)
    const focusMode = useSettings((s) => s.focusMode)
    const markdownSource = useSettings((s) => s.markdownSource)
    const documents = useDocuments((s) => s.documents)
    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState(0)
    const listRef = useRef<HTMLDivElement>(null)

    const commands: Command[] = useMemo(
        () => [
            {
                id: 'new-document',
                label: 'New document',
                icon: <FilePlus2Icon size={15} />,
                action: () => {
                    useDocuments.getState().createDocument('Untitled').catch((error) => {
                        console.error('Error creating document:', error)
                    })
                },
            },
            {
                id: 'toggle-ai',
                label: 'Toggle Ask AI panel',
                icon: <PanelRightIcon size={15} />,
                action: () => {
                    const { chatPanelOpen, setChatPanelOpen } = useSettings.getState()
                    setChatPanelOpen(!chatPanelOpen)
                },
            },
            {
                id: 'focus-mode',
                label: focusMode ? 'Exit focus mode' : 'Enter focus mode',
                icon: focusMode ? <Minimize2Icon size={15} /> : <Maximize2Icon size={15} />,
                action: () => useSettings.getState().setFocusMode(!focusMode),
            },
            {
                id: 'toggle-markdown-source',
                label: markdownSource ? 'Hide markdown source (live preview)' : 'Show markdown source',
                icon: markdownSource ? <EyeIcon size={15} /> : <CodeIcon size={15} />,
                action: () => useSettings.getState().setMarkdownSource(!markdownSource),
            },
            {
                id: 'toggle-theme',
                label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
                icon: theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />,
                action: () => useSettings.getState().setTheme(theme === 'dark' ? 'light' : 'dark'),
            },
        ],
        [focusMode, theme, markdownSource],
    )

    const documentCommands: Command[] = useMemo(
        () =>
            documents.map((doc) => ({
                id: `doc:${doc.id}`,
                label: doc.title || 'Untitled',
                hint: 'Open',
                icon: <FileTextIcon size={15} />,
                action: () => useDocuments.getState().setActiveId(doc.id),
            })),
        [documents],
    )

    const results = useMemo(() => {
        const q = query.trim().toLowerCase()
        const matches = (c: Command) => !q || c.label.toLowerCase().includes(q)
        return [
            ...commands.filter(matches),
            ...documentCommands.filter(matches).slice(0, MAX_DOCUMENT_RESULTS),
        ]
    }, [commands, documentCommands, query]);

    useEffect(() => {
        if (open) setQuery('')
    }, [open]);

    useEffect(() => {
        setSelected(0)
    }, [query, open]);

    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
    }, [selected])

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    if (!open) return null;

    const run = (cmd: Command | undefined) => {
        if (!cmd) return
        cmd.action()
        onClose()
    }

    const firstDocumentIndex = results.findIndex((c) => c.id.startsWith('doc:'))

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh] backdrop-blur-sm animate-fade-in"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}>
            <div className="glass gradient-border w-full max-w-lg animate-scale-in overflow-hidden rounded-2xl border border-(--border) shadow-(--shadow-pop)">
                <div className="flex items-center gap-2.5 border-b border-(--border-soft) px-4 py-3">
                    <SearchIcon size={15} className="text-(--accent-1)" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                                e.preventDefault()
                                setSelected((i) => (results.length ? (i + 1) % results.length : 0))
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault()
                                setSelected((i) => (results.length ? (i - 1 + results.length) % results.length : 0))
                            } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                e.preventDefault()
                                run(results[selected])
                            }
                        }}
                        placeholder="Search commands and documents…"
                        aria-label="Search commands and documents"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="command-palette-results"
                        aria-activedescendant={results[selected] ? `command-${results[selected].id}` : undefined}
                        className="w-full bg-transparent text-sm text-(--ink) placeholder:text-(--ink-faint) focus:outline-none"
                    />
                </div>
                <div ref={listRef} id="command-palette-results" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
                    {results.length === 0 && (
                        <p className="px-3 py-6 text-center text-xs text-(--ink-faint)">No matches</p>
                    )}
                    {results.map((cmd, index) => (
                        <div key={cmd.id}>
                            {index === firstDocumentIndex && (
                                <p className="px-3 pb-1 pt-2 text-[11px] font-medium text-(--ink-faint)">Documents</p>
                            )}
                            <button
                                id={`command-${cmd.id}`}
                                data-index={index}
                                role="option"
                                aria-selected={index === selected}
                                onMouseMove={() => setSelected(index)}
                                onClick={() => run(cmd)}
                                className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-(--ink) ${index === selected ? 'bg-(--surface-hover)' : ''}`}
                            >
                                <span className="flex h-6 w-6 items-center justify-center rounded-md text-(--ink-dim) transition-colors group-hover:text-(--accent-1)">
                                    {cmd.icon}
                                </span>
                                <span className="truncate">{cmd.label}</span>
                                {cmd.hint && <span className="ml-auto text-[11px] text-(--ink-faint)">{cmd.hint}</span>}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
