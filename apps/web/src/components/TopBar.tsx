import { CommandIcon, Minimize2Icon, Maximize2Icon, SunIcon, MoonIcon, PanelRightIcon } from 'lucide-react'

import { useSettings } from '../store/useSettings'
import { IconButton } from '@repo/ui/IconButton'

interface TopBarProps {
    onOpenPalette: () => void
}


export const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent)

export const modKey = isMac ? '⌘' : 'Ctrl'

export function TopBar({ onOpenPalette }: TopBarProps) {

    const theme = useSettings((s) => s.theme)
    const toggleTheme = useSettings((s) => s.toggleTheme)
    const focusMode = useSettings((s) => s.focusMode)
    const setFocusMode = useSettings((s) => s.setFocusMode)
    const chatPanelOpen = useSettings((s) => s.chatPanelOpen)
    const setChatPanelOpen = useSettings((s) => s.setChatPanelOpen)
    
    return (
        <header className="drag-region glass flex h-12 shrink-0 items-center justify-between border-b border-(--border) px-3">
            <div className="no-drag flex items-center gap-1.5">
                <button
                    onClick={onOpenPalette}
                    className="lift flex items-center gap-2 rounded-lg border border-(--border-soft) bg-(--surface) px-2.5 py-1.5 text-xs text-(--ink-faint) hover:bg-(--surface-hover) hover:text-(--ink-dim)"
                >
                    <CommandIcon size={12} />
                    Quick actions
                    <kbd className="rounded border border-(--border) bg-(--bg-elevated) px-1 font-mono text-[10px]">
                        {modKey}K
                    </kbd>
                </button>
            </div>

            <div className="no-drag flex items-center gap-1">
                <IconButton label={focusMode ? 'Exit focus mode' : 'Focus mode'} onClick={() => setFocusMode(!focusMode)} active={focusMode}>
                    {focusMode ? <Minimize2Icon size={16} /> : <Maximize2Icon size={16} />}
                </IconButton>
                <IconButton label="Toggle theme" onClick={toggleTheme}>
                    {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
                </IconButton>
                <IconButton label="Ask AI" onClick={() => setChatPanelOpen(!chatPanelOpen)} active={chatPanelOpen}>
                    <PanelRightIcon size={16} />
                </IconButton>
            </div>
        </header>
    )
}