"use client"

import { useEffect } from 'react'
import { SideBar } from '../../components/web/SideBar'
import { TopBar } from '../../components/web/TopBar'
import { useSettings } from '../../store/useSettings'
import { ChatPanel } from '../../components/web/ChatPanel'
import { Editor } from '../../components/web/Editor'
import { useDocuments } from '../../store/useDocuments'
import { CommandPalette } from '../../components/web/CommandPalette'
import { getIsMac } from '../../utils'
import { getDesktopBridge } from '../../lib/desktop'
import { flushAllSaves } from '../../lib/pendingSaves'


export default function AppHome() {
    const getDocuments = useDocuments((s) => s.getDocuments)
    const theme = useSettings((s) => s.theme)
    const focusMode = useSettings((s) => s.focusMode)
    const chatPanelOpen = useSettings((s) => s.chatPanelOpen)
    const commandPaletteOpen = useSettings((s) => s.commandPaletteOpen)
    const setCommandPaletteOpen = useSettings((s) => s.setCommandPaletteOpen)

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
    }, [theme])

    useEffect(() => {
        getDocuments()
    }, [getDocuments])

    // Desktop app: let it save pending edits before restarting for an update.
    useEffect(() => getDesktopBridge()?.onFlushSaves(flushAllSaves), [])

    // Desktop app: native menu items (File → New Document, View → Focus Mode, …).
    useEffect(
        () =>
            getDesktopBridge()?.onMenuCommand((command) => {
                const settings = useSettings.getState()
                if (command === 'new-document') {
                    useDocuments.getState().createDocument('Untitled').catch((error) => {
                        console.error('Error creating document:', error)
                    })
                } else if (command === 'command-palette') settings.setCommandPaletteOpen(!settings.commandPaletteOpen)
                else if (command === 'toggle-ai') settings.setChatPanelOpen(!settings.chatPanelOpen)
                else if (command === 'toggle-focus') settings.setFocusMode(!settings.focusMode)
                else if (command === 'toggle-theme') settings.toggleTheme()
            }),
        [],
    )

    useEffect(() => {
        const isMac = getIsMac()
        function onKeyDown(e: KeyboardEvent) {
            const mod = isMac ? e.metaKey : e.ctrlKey
            if (!mod) return
            const settings = useSettings.getState()
            if (e.key.toLowerCase() === 'k') {
                e.preventDefault()
                settings.setCommandPaletteOpen(!settings.commandPaletteOpen)
            }
            if (e.key.toLowerCase() === 'j') {
                e.preventDefault()
                settings.setChatPanelOpen(!settings.chatPanelOpen)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    return (
        <div className="relative flex h-screen w-screen overflow-hidden bg-(--bg) text-(--ink)">
            <div className="ambient-glow" />
            <div className="noise-overlay" />
            <div className="relative z-10 flex min-w-0 flex-1">
                {!focusMode && <SideBar />}
                <div className="flex min-w-0 flex-1 flex-col">
                    <TopBar />
                    <Editor />
                </div>
                {chatPanelOpen && <ChatPanel />}
                <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
            </div>
        </div>
    )
}
