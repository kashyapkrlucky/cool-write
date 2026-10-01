"use client"

import { useEffect, useState } from "react"

export function OpenDesktopApp({ deepLink, code }: { deepLink: string; code: string }) {
    const [showCode, setShowCode] = useState(false)
    const [copied, setCopied] = useState(false)

    // Try once automatically; browsers usually show an "Open Cool Write?" prompt.
    useEffect(() => {
        window.location.href = deepLink
    }, [deepLink])

    return (
        <div className="flex flex-col gap-4">
            <a
                href={deepLink}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-(--ink) px-4 text-sm font-semibold text-(--bg)"
            >
                Open Cool Write
            </a>

            {showCode ? (
                <div className="rounded-lg border border-(--border) p-3">
                    <p className="mb-2 text-xs leading-5 text-(--ink-dim)">
                        Paste this code into the Cool Write app <strong>on this computer</strong>. It works once and expires in 5
                        minutes. Never share it with anyone.
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded bg-(--surface-hover) px-2 py-1 font-mono text-xs">{code}</code>
                        <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(code).then(() => setCopied(true))}
                            className="rounded-md border border-(--border) px-2 py-1 text-xs hover:bg-(--surface-hover)"
                        >
                            {copied ? "Copied" : "Copy"}
                        </button>
                    </div>
                </div>
            ) : (
                <button type="button" onClick={() => setShowCode(true)} className="text-xs text-(--ink-dim) underline">
                    App didn&apos;t open? Use a sign-in code instead
                </button>
            )}
        </div>
    )
}
