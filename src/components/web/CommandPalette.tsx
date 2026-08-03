
import { Maximize2Icon, Minimize2Icon, PanelRightIcon, SearchIcon, SunIcon, MoonIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../store/useSettings';
import type { Command } from '../../types';

interface CommandPaletteProps {
    open: boolean;  
    onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {

    const { theme, setTheme, focusMode, setFocusMode, chatPanelOpen, setChatPanelOpen } = useSettings();
    const [query, setQuery] = useState('')
    const commands: Command[] = useMemo(
        () => [
            {
                id: 'toggle-ai',
                label: 'Toggle Ask AI panel',
                icon: <PanelRightIcon size={15} />,
                action: () => setChatPanelOpen(!chatPanelOpen),
            },
            {
                id: 'focus-mode',
                label: focusMode ? 'Exit focus mode' : 'Enter focus mode',
                icon: focusMode ? <Minimize2Icon size={15} /> : <Maximize2Icon size={15} />,
                action: () => setFocusMode(!focusMode),
            },
            {
                id: 'toggle-theme',
                label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
                icon: theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />,
                action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
            },
        ],
        [focusMode, theme, setFocusMode, setTheme],
    )

    const filtered = useMemo(() => {
        if (!query.trim()) return commands
        const q = query.toLowerCase()
        return commands.filter((c) => c.label.toLowerCase().includes(q))
    }, [commands, query]);

    useEffect(() => {
        if (open) setQuery('')
    }, [open]);

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    if (!open) return null;

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
                        placeholder="Search commands and documents…"
                        className="w-full bg-transparent text-sm text-(--ink) placeholder:text-(--ink-faint) focus:outline-none"
                    />
                </div>
                <div className="max-h-80 overflow-y-auto p-1.5">
                    {filtered.length === 0 && (
                        <p className="px-3 py-6 text-center text-xs text-(--ink-faint)">No matches</p>
                    )}
                    {filtered.map((cmd) => (
                        <button
                            key={cmd.id}
                            onClick={() => {
                                cmd.action()
                                onClose()
                            }}
                            className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-(--ink) hover:bg-(--surface-hover)"
                        >
                            <span className="flex h-6 w-6 items-center justify-center rounded-md text-(--ink-dim) transition-colors group-hover:text-(--accent-1)">
                                {cmd.icon}
                            </span>
                            {cmd.label}
                            {cmd.hint && <span className="ml-auto text-[11px] text-(--ink-faint)">{cmd.hint}</span>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}