// Bridge exposed by the Electron preload (desktop/src/preload.ts) as
// `window.coolWrite`. Undefined in a normal browser.
export interface CoolWriteDesktopBridge {
    isDesktop: true
    platform: string
    getAppVersion: () => Promise<string>
    retry: () => Promise<void>
    // Revokes this install's desktop session and returns to the app's sign-in screen.
    signOut: () => Promise<void>
    getUpdateStatus: () => Promise<DesktopUpdateStatus>
    onUpdateStatus: (callback: (status: DesktopUpdateStatus) => void) => () => void
    checkForUpdates: () => Promise<DesktopUpdateStatus>
    installUpdate: () => Promise<void>
    onFlushSaves: (flush: () => Promise<void>) => () => void
    onMenuCommand: (callback: (command: string) => void) => () => void
}

// Mirrors desktop/src/updater/index.ts.
export type DesktopUpdateStatus =
    | { state: 'disabled'; reason: string }
    | { state: 'idle' }
    | { state: 'checking' }
    | { state: 'up-to-date'; version: string }
    | { state: 'downloading'; version: string; percent: number }
    | { state: 'ready'; version: string; notes?: string; mode: 'install' | 'manual'; reason?: string }
    | { state: 'error'; message: string }

export function getDesktopBridge(): CoolWriteDesktopBridge | undefined {
    if (typeof window === 'undefined') return undefined
    return (window as Window & { coolWrite?: CoolWriteDesktopBridge }).coolWrite
}
