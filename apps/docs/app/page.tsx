import styles from './page.module.css'
import { DownloadButton } from './components/DownloadButton'

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
    <div className={styles.page}>
      <div className={styles.ambientGlow} />
      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>CW</span>
            Cool Write
          </div>
          <nav className={styles.nav}>
            <a href="#features">Features</a>
            <a href="#download">Download</a>
            <a className={styles.navCta} href="#download">
              Open app
            </a>
          </nav>
        </header>

        <section className={styles.hero}>
          <span className={styles.badge}>
            <span className={styles.badgeDot} />
            Now in early access
          </span>
          <h1 className={styles.title}>
            The <span className="gradient-text">writing surface</span>
            <br />
            built around AI
          </h1>
          <p className={styles.subtitle}>
            Cool Write pairs a fast, distraction-free editor with an AI chat panel right
            next to your document — so drafting, rewriting, and thinking happen in the
            same place.
          </p>
          <div className={styles.ctaRow}>
            <a className={styles.primaryCta} href="#download">
              Open in browser
            </a>
            <DownloadButton />
          </div>

          <div className={styles.previewFrame}>
            <div className={styles.previewChrome}>
              <span className={styles.previewDot} />
              <span className={styles.previewDot} />
              <span className={styles.previewDot} />
            </div>
            <div className={styles.previewBody}>App preview coming soon</div>
          </div>
        </section>

        <section id="features" className={styles.features}>
          <h2 className={styles.sectionHeading}>Everything you need, nothing you don&apos;t</h2>
          <p className={styles.sectionSubheading}>
            A minimal editor with a few sharp tools built in — no clutter, no setup.
          </p>
          <div className={styles.grid}>
            {features.map((feature) => (
              <div className={styles.card} key={feature.title}>
                <div className={styles.cardIcon}>{feature.icon}</div>
                <div className={styles.cardTitle}>{feature.title}</div>
                <div className={styles.cardText}>{feature.text}</div>
              </div>
            ))}
          </div>
        </section>

        <footer id="download" className={styles.footer}>
          <div className={styles.footerInner}>
            <span>© {new Date().getFullYear()} Cool Write</span>
            <div className={styles.footerLinks}>
              <a href="#features">Features</a>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
