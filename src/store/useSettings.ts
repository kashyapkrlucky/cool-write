import { create } from 'zustand'

import { persist } from 'zustand/middleware'

import type { Theme } from '../types'

interface SettingsState {
    theme: Theme
    focusMode: boolean
    setTheme: (theme: Theme) => void
    toggleTheme: () => void;
    setFocusMode: (on: boolean) => void;
    chatPanelOpen: boolean;
    setChatPanelOpen: (open: boolean) => void;
    commandPaletteOpen: boolean
    setCommandPaletteOpen: (open: boolean) => void;
    // Editor shows raw markdown instead of the live preview.
    markdownSource: boolean
    setMarkdownSource: (on: boolean) => void;
}

export const useSettings = create<SettingsState>()(
    persist(
        (set, get) => ({
            theme: 'light',
            focusMode: false,
            chatPanelOpen: false,
            commandPaletteOpen: false,
            markdownSource: false,
            setTheme: (theme: Theme) => set({ theme }),
            toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
            setFocusMode: (focusMode: boolean) => set({ focusMode }),
            setChatPanelOpen: (chatPanelOpen: boolean) => set({ chatPanelOpen }),
            setCommandPaletteOpen: (commandPaletteOpen: boolean) => set({ commandPaletteOpen }),
            setMarkdownSource: (markdownSource: boolean) => set({ markdownSource }),
        }),
        {
            name: 'settings',
            // Transient UI state (e.g. the command palette) must not survive a reload.
            partialize: (state) => ({
                theme: state.theme,
                focusMode: state.focusMode,
                chatPanelOpen: state.chatPanelOpen,
                markdownSource: state.markdownSource,
            }),
        }
    )
)

