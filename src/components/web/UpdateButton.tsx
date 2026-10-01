import { useEffect, useState } from 'react'
import { ArrowDownCircleIcon, DownloadIcon } from 'lucide-react'
import { getDesktopBridge, type DesktopUpdateStatus } from '../../lib/desktop'

// Desktop app only: shows download progress, then an "Update" button once the
// new version is downloaded and verified. Clicking it saves pending edits and
// restarts into the new version. Renders nothing in a browser.
export function UpdateButton() {
    const [status, setStatus] = useState<DesktopUpdateStatus | null>(null)
    const [installing, setInstalling] = useState(false)

    useEffect(() => {
        const desktop = getDesktopBridge()
        if (!desktop) return
        let active = true
        desktop.getUpdateStatus().then((current) => {
            if (active) setStatus(current)
        })
        const unsubscribe = desktop.onUpdateStatus(setStatus)
        return () => {
            active = false
            unsubscribe()
        }
    }, [])

    if (status?.state === 'downloading') {
        return (
            <span className="flex items-center gap-1.5 px-2 text-[11px] text-(--ink-faint)" title={`Downloading Cool Write ${status.version}`}>
                <DownloadIcon size={12} className="animate-pulse-soft" />
                Updating… {status.percent}%
            </span>
        )
    }

    if (status?.state !== 'ready') return null

    const manual = status.mode === 'manual'
    return (
        <button
            type="button"
            disabled={installing}
            onClick={() => {
                setInstalling(!manual)
                void getDesktopBridge()?.installUpdate().catch(() => setInstalling(false))
            }}
            title={manual ? status.reason : status.notes || `Restart to install Cool Write ${status.version}`}
            className="lift mr-1 flex items-center gap-1.5 rounded-full bg-(--accent-1) px-3 py-1 text-xs font-semibold text-white disabled:opacity-70"
        >
            <ArrowDownCircleIcon size={13} />
            {installing ? 'Restarting…' : manual ? `Get ${status.version}` : `Update to ${status.version}`}
        </button>
    )
}
