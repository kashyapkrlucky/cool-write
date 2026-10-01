import { useEffect, useState } from 'react'

type NavigatorWithUAData = Navigator & { userAgentData?: { platform?: string } }

// Evaluated lazily (not at module load) so the server render and the first
// client render agree; call only from event handlers or effects.
export function getIsMac(): boolean {
    if (typeof navigator === 'undefined') return false
    const nav = navigator as NavigatorWithUAData
    const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent
    return /Mac|iPhone|iPad/i.test(platform)
}

// Renders "Ctrl" on the server and first paint, then swaps to "⌘" on Macs,
// avoiding a hydration mismatch.
export function useModKey(): string {
    const [modKey, setModKey] = useState('Ctrl')
    useEffect(() => {
        if (getIsMac()) setModKey('⌘')
    }, [])
    return modKey
}
