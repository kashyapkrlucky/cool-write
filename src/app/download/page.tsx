import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getChannelManifest, RELEASE_TARGETS, type ReleaseTarget } from '../../server/services/releases'
import { DownloadChooser, type DownloadOption } from './DownloadChooser'

export const metadata: Metadata = {
  title: 'Download Cool Write for Mac and Windows',
  description: 'Download the Cool Write desktop app for macOS (Apple Silicon or Intel) or Windows.',
}

// The live version changes whenever a release is promoted.
export const dynamic = 'force-dynamic'

const TARGET_INFO: Record<ReleaseTarget, { os: 'mac' | 'windows'; title: string; subtitle: string }> = {
  'mac-arm64': { os: 'mac', title: 'Mac — Apple Silicon', subtitle: 'M1, M2, M3, M4 and newer' },
  'mac-x64': { os: 'mac', title: 'Mac — Intel', subtitle: 'Macs with an Intel processor' },
  'win-x64': { os: 'windows', title: 'Windows', subtitle: 'Windows 10 and 11, 64-bit' },
}

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`
}

export default async function DownloadPage() {
  const manifest = await getChannelManifest('stable')

  const options: DownloadOption[] = RELEASE_TARGETS.map((target) => {
    const installer = manifest?.files[target]?.installer
    return {
      target,
      ...TARGET_INFO[target],
      available: Boolean(installer),
      size: installer ? formatSize(installer.size) : null,
      sha256: installer?.sha256 ?? null,
      fileName: installer?.name ?? null,
    }
  })

  const releasedAt = manifest
    ? new Date(manifest.releasedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-150 overflow-hidden">
        <div className="absolute left-[-12vw] top-[-18vw] h-[45vw] w-[45vw] rounded-full blur-[90px] bg-[radial-gradient(circle,var(--glow-1),transparent_70%)]" />
      </div>

      <div className="relative z-10">
        <header className="mx-auto flex max-w-275 items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2 text-[1.05rem] font-semibold">
            <Image src="/logo.svg" alt="" width={24} height={24} unoptimized />
            Cool Write
          </Link>
          <a
            href="/login"
            className="whitespace-nowrap rounded-full border border-(--border) bg-(--surface) px-4 py-2 text-sm font-medium text-(--ink) transition-colors hover:bg-(--surface-hover)"
          >
            Open in browser
          </a>
        </header>

        <main className="mx-auto max-w-240 px-6 pb-24 pt-12">
          <h1 className="mb-3 text-center text-[clamp(2rem,4.5vw,2.8rem)] font-[650] tracking-[-0.02em]">
            Download Cool Write
          </h1>
          <p className="mx-auto mb-12 max-w-140 text-center text-(--ink-dim)">
            {manifest
              ? `Version ${manifest.version} · released ${releasedAt}. Pick the build for your computer.`
              : 'The desktop app is on its way. In the meantime, Cool Write works in any modern browser.'}
          </p>

          {manifest ? (
            <DownloadChooser options={options} />
          ) : (
            <div className="text-center">
              <a
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-(--ink) px-6 py-[0.8rem] text-[0.95rem] font-semibold text-(--bg)"
              >
                Open in browser
              </a>
            </div>
          )}

          {manifest?.notes && (
            <section className="mt-14">
              <h2 className="mb-2 text-sm font-semibold">What&apos;s new in {manifest.version}</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-(--ink-dim)">{manifest.notes}</p>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
