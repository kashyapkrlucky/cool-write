import Image from 'next/image'
import { DownloadButton } from '../components/home/DownloadButton'

const features = [
  {
    title: 'Ask AI, right in the doc',
    text: 'A chat panel sits beside your writing so you can draft, rewrite, and research without breaking flow.',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5 5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Z" />
        <path d="M8 21h8M12 18v3" />
      </svg>
    ),
  },
  {
    title: 'Quick actions, Cmd+K',
    text: 'A command palette for jumping between documents, running actions, and navigating without touching the mouse.',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M8 9l2 2-2 2M13 13h3" />
      </svg>
    ),
  },
  {
    title: 'Focus mode',
    text: 'Hide everything but the page. One toggle strips away the chrome so it is just you and the document.',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
      </svg>
    ),
  },
  {
    title: 'Documents that stay in sync',
    text: 'Every rename, edit, and delete is saved instantly — pick up exactly where you left off, on any device.',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </svg>
    ),
  },
  {
    title: 'Light & dark, done right',
    text: 'A theme that adapts to how you work, day or night, without ever feeling like an afterthought.',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    title: 'Built for keyboard people',
    text: 'Shortcuts for the things you do most, so your hands never have to leave the keys.',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12" />
      </svg>
    ),
  },
]

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-225 overflow-hidden">
        <div className="absolute left-[-12vw] top-[-18vw] h-[55vw] w-[55vw] rounded-full blur-[90px] bg-[radial-gradient(circle,var(--glow-1),transparent_70%)]" />
        <div className="absolute bottom-[-22vw] right-[-14vw] h-[55vw] w-[55vw] rounded-full blur-[90px] bg-[radial-gradient(circle,var(--glow-2),transparent_70%)]" />
      </div>

      <div className="relative z-10">
        <header className="mx-auto flex max-w-275 items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2 text-[1.05rem] font-semibold">
            <Image src="/logo.png" alt="Cool Write" width={24} height={24} />
            Cool Write
          </div>
          <nav className="flex items-center gap-7 text-sm text-(--ink-dim)">
            <a href="#features" className="max-[560px]:hidden hover:text-(--ink)">
              Features
            </a>
            <a href="#download" className="max-[560px]:hidden hover:text-(--ink)">
              Download
            </a>
            <a
              href="/login"
              className="whitespace-nowrap rounded-full border border-(--border) bg-(--surface) px-4 py-2 font-medium text-(--ink) transition-colors hover:bg-(--surface-hover)"
            >
              Open app
            </a>
          </nav>
        </header>

        <section className="mx-auto flex max-w-195 flex-col items-center px-6 pb-16 pt-22 text-center">
          <span className="mb-7 inline-flex items-center gap-[0.4rem] rounded-full border border-(--border) bg-(--surface) px-[0.9rem] py-[0.35rem] text-[0.8rem] text-(--ink-dim) shadow-(--shadow-soft)">
            <span className="h-1.5 w-1.5 rounded-full bg-(--accent-2)" />
            Now in early access
          </span>
          <h1 className="mb-5 text-[clamp(2.4rem,5.5vw,3.6rem)] font-[650] leading-[1.08] tracking-[-0.02em]">
            The <span className="gradient-text">writing surface</span>
            <br />
            built around AI
          </h1>
          <p className="mb-10 max-w-150 text-[1.15rem] leading-[1.6] text-(--ink-dim)">
            Cool Write pairs a fast, distraction-free editor with an AI chat panel right
            next to your document — so drafting, rewriting, and thinking happen in the
            same place.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-[0.85rem]">
            <a
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-(--ink) px-6 py-[0.8rem] text-[0.95rem] font-semibold text-(--bg) shadow-(--shadow-pop) transition-transform hover:-translate-y-px"
            >
              Open in browser
            </a>
            <DownloadButton />
          </div>

          <div className="mt-16 w-full max-w-240 overflow-hidden rounded-2xl border border-(--border) bg-(--surface) shadow-(--shadow-pop)">
            <div className="flex items-center gap-[0.4rem] border-b border-(--border-soft) px-[0.9rem] py-[0.7rem]">
              <span className="h-2.25 w-2.25 rounded-full bg-(--border)" />
              <span className="h-2.25 w-2.25 rounded-full bg-(--border)" />
              <span className="h-2.25 w-2.25 rounded-full bg-(--border)" />
            </div>
            <div className="flex aspect-16/8.5 items-center justify-center bg-[radial-gradient(circle_at_20%_20%,var(--glow-1),transparent_45%),radial-gradient(circle_at_80%_80%,var(--glow-2),transparent_45%)] text-[0.85rem] text-(--ink-faint)">
              App preview coming soon
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-275 px-6 pb-24 pt-12">
          <h2 className="mb-3 text-center text-[1.9rem] font-[650] tracking-[-0.01em]">
            Everything you need, nothing you don&apos;t
          </h2>
          <p className="mx-auto mb-12 max-w-130 text-center text-(--ink-dim)">
            A minimal editor with a few sharp tools built in — no clutter, no setup.
          </p>
          <div className="grid grid-cols-3 gap-5 max-[780px]:grid-cols-1">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-(--border) bg-(--surface) p-6 shadow-(--shadow-soft)"
              >
                <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,var(--glow-1),var(--glow-2))] text-(--accent-1)">
                  {feature.icon}
                </div>
                <div className="mb-[0.4rem] font-semibold">{feature.title}</div>
                <div className="text-sm leading-[1.55] text-(--ink-dim)">{feature.text}</div>
              </div>
            ))}
          </div>
        </section>

        <footer id="download" className="border-t border-(--border-soft) px-6 py-8">
          <div className="mx-auto flex max-w-275 items-center justify-between text-sm text-(--ink-faint) max-[560px]:flex-col max-[560px]:gap-3 max-[560px]:text-center">
            <span>© {new Date().getFullYear()} Cool Write</span>
            <div className="flex gap-5">
              <a href="#features" className="hover:text-(--ink-dim)">Features</a>
              <a href="#" className="hover:text-(--ink-dim)">Privacy</a>
              <a href="#" className="hover:text-(--ink-dim)">Terms</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
