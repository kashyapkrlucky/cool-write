import { create } from 'zustand'

import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light'
interface SettingsState {
    theme: Theme
    focusMode: boolean
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
    setFocusMode: (on: boolean) => void
    chatPanelOpen: boolean
    setChatPanelOpen: (open: boolean) => void
}

export const useSettings = create<SettingsState>()(
    persist(
        (set, get) => ({
            theme: 'light',
            focusMode: false,
            chatPanelOpen: false,
            setTheme: (theme: Theme) => set({ theme }),
            toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
            setFocusMode: (focusMode: boolean) => set({ focusMode }),
            setChatPanelOpen: (chatPanelOpen: boolean) => set({ chatPanelOpen }),
        }),
        {
            name: 'settings',
        }
    )
)

