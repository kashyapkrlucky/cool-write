'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { detectPlatform } from './platform'

type OS = 'mac' | 'windows' | 'linux' | null

const LABELS: Record<Exclude<OS, null>, string> = {
  mac: 'Download for Mac',
  windows: 'Download for Windows',
  linux: 'Download for Linux',
}

const ICONS: Record<Exclude<OS, null>, ReactNode> = {
  mac: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.468 2.11-1.187 2.85-.78.81-2.06 1.44-3.05 1.36-.13-1.1.43-2.24 1.16-2.97.79-.82 2.19-1.44 3.08-1.24zM20.5 17.19c-.5 1.15-.74 1.66-1.38 2.68-.9 1.42-2.16 3.19-3.73 3.2-1.39.02-1.75-.9-3.64-.89-1.89.01-2.29.91-3.68.89-1.57-.02-2.76-1.61-3.66-3.03-2.51-3.94-2.77-8.56-1.22-11.02.9-1.44 2.45-2.4 4.05-2.4 1.63 0 2.65.9 4 .9 1.31 0 2.11-.9 4-.9 1.31 0 2.71.71 3.71 1.94-3.26 1.79-2.73 6.45.55 7.63z" />
    </svg>
  ),
  windows: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M3 5.5 10.5 4.4v7.1H3zm8.4-1.2L21 3v8.5h-9.6zM3 12.5h7.5v7.1L3 18.5zm8.4 0H21V21l-9.6-1.4z" />
    </svg>
  ),
  linux: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12.5 2c-1.9 0-2.9 1.9-3 3.9-.1 1.5.1 2.4-.6 3.7-.6 1.2-1.9 2.6-1.9 4.6 0 1.6.8 2.8 2 3.5-.1.5-.3.9-.6 1.2-.5.6-1.2.9-1.2 1.7 0 1 1.4 1.4 3.3 1.4 1.4 0 2.2-.5 3-.5.8 0 1.6.5 3 .5 1.9 0 3.3-.4 3.3-1.4 0-.8-.7-1.1-1.2-1.7-.3-.3-.5-.7-.6-1.2 1.2-.7 2-1.9 2-3.5 0-2-1.3-3.4-1.9-4.6-.7-1.3-.5-2.2-.6-3.7-.1-2-1.1-3.9-3-3.9-.7 0-1.3.3-1.7.8-.4-.5-1-.8-1.7-.8-.2 0 0 0 0 0z" />
    </svg>
  ),
}

// Links to /download, where the user picks their exact build. On phones the
// desktop app isn't useful, so the button is hidden there.
export function DownloadButton() {
  const [os, setOs] = useState<OS | 'mobile'>(null)

  useEffect(() => {
    setOs(detectPlatform())
  }, [])

  if (os === 'mobile') return null
  const key = os === 'windows' ? 'windows' : 'mac'

  return (
    <a
      href="/download"
      className="inline-flex items-center gap-[0.6rem] rounded-xl border border-(--border) bg-(--surface) px-6 py-[0.78rem] text-[0.95rem] font-semibold text-(--ink) transition-colors hover:bg-(--surface-hover)"
    >
      {ICONS[key]}
      {os === 'linux' ? 'Desktop apps' : LABELS[key]}
    </a>
  )
}
