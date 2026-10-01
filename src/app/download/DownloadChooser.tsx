'use client'

import { useEffect, useState } from 'react'
import type { ReleaseTarget } from '../../server/services/releases'
import { detectRecommendedTarget } from '../../components/home/platform'

export interface DownloadOption {
  target: ReleaseTarget
  os: 'mac' | 'windows'
  title: string
  subtitle: string
  available: boolean
  size: string | null
  sha256: string | null
  fileName: string | null
}

// Unsigned builds ($0 budget) need a one-time manual approval
// on first launch; these steps are shown for the chosen platform.
function FirstLaunchGuide({ os }: { os: 'mac' | 'windows' }) {
  if (os === 'mac') {
    return (
      <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-(--ink-dim)">
        <li>Open the downloaded <strong className="text-(--ink)">.dmg</strong> and drag Cool Write into <strong className="text-(--ink)">Applications</strong>.</li>
        <li>Open Cool Write. macOS says it can&apos;t verify the app. Click <strong className="text-(--ink)">Done</strong>.</li>
        <li>Open <strong className="text-(--ink)">System Settings → Privacy &amp; Security</strong>, scroll down, and click <strong className="text-(--ink)">Open Anyway</strong> next to Cool Write. Confirm with your password.</li>
        <li>That&apos;s it: you only do this once. Updates install without asking again.</li>
      </ol>
    )
  }
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-(--ink-dim)">
      <li>Run the downloaded <strong className="text-(--ink)">.exe</strong>. No admin rights needed.</li>
      <li>If Windows shows <em>&ldquo;Windows protected your PC&rdquo;</em>, click <strong className="text-(--ink)">More info → Run anyway</strong>.</li>
      <li>Cool Write installs and opens. Updates install without asking again.</li>
    </ol>
  )
}

export function DownloadChooser({ options }: { options: DownloadOption[] }) {
  const [recommended, setRecommended] = useState<ReleaseTarget | null>(null)
  const [chosen, setChosen] = useState<ReleaseTarget | null>(null)

  useEffect(() => {
    let cancelled = false
    detectRecommendedTarget().then((target) => {
      if (!cancelled) setRecommended(target)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const guideFor = options.find((o) => o.target === (chosen ?? recommended))?.os

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 max-[780px]:grid-cols-1">
        {options.map((option) => {
          const isRecommended = option.target === recommended
          return (
            <div
              key={option.target}
              className={`relative flex flex-col rounded-2xl border bg-(--surface) p-5 shadow-(--shadow-soft) ${isRecommended ? 'border-(--accent-1)' : 'border-(--border)'}`}
            >
              {isRecommended && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-(--accent-1) px-2 py-0.5 text-[11px] font-semibold text-white">
                  Recommended for you
                </span>
              )}
              <div className="mb-1 font-semibold">{option.title}</div>
              <div className="mb-5 text-sm text-(--ink-dim)">{option.subtitle}</div>
              {option.available ? (
                <a
                  href={`/api/v1/desktop/download/${option.target}`}
                  onClick={() => setChosen(option.target)}
                  className={`mt-auto inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${isRecommended ? 'bg-(--ink) text-(--bg)' : 'border border-(--border) text-(--ink) hover:bg-(--surface-hover)'}`}
                >
                  Download{option.size ? ` · ${option.size}` : ''}
                </a>
              ) : (
                <span className="mt-auto inline-flex items-center justify-center rounded-xl border border-dashed border-(--border) px-4 py-2.5 text-sm text-(--ink-faint)">
                  Coming soon
                </span>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-center text-xs text-(--ink-faint)">
        Not sure which Mac you have? Apple menu  → About This Mac: <em>Chip</em> means Apple Silicon, <em>Processor</em> means Intel.
      </p>

      {guideFor && (
        <section className="mt-12 rounded-2xl border border-(--border) bg-(--surface) p-6">
          <h2 className="mb-1 font-semibold">{chosen ? 'Almost there' : 'First time opening Cool Write?'}</h2>
          <p className="mb-4 text-sm text-(--ink-dim)">
            Cool Write is an independent app and isn&apos;t signed with a paid Apple or Microsoft certificate yet, so
            your computer asks you to confirm it once.
          </p>
          <FirstLaunchGuide os={guideFor} />
        </section>
      )}

      <details className="mt-8 text-sm text-(--ink-dim)">
        <summary className="cursor-pointer select-none">Verify your download (SHA-256)</summary>
        <ul className="mt-3 space-y-2">
          {options.filter((o) => o.sha256).map((o) => (
            <li key={o.target} className="break-all font-mono text-xs">
              <span className="font-sans font-medium text-(--ink)">{o.fileName}</span>
              <br />
              {o.sha256}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs">
          On a Mac: <code className="font-mono">shasum -a 256 ~/Downloads/&lt;file&gt;</code> · On Windows:{' '}
          <code className="font-mono">certutil -hashfile &lt;file&gt; SHA256</code>
        </p>
      </details>
    </div>
  )
}
