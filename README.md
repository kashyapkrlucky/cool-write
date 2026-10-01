# Cool Write

A distraction-free markdown editor with an AI chat panel next to your document.
Sign in with Google, write with a live-preview markdown editor, and ask the AI to
draft, rewrite, summarize, or brainstorm, then insert its answer at the cursor.

- **Web:** https://cool-write.vercel.app (Next.js on Vercel, Postgres on Neon)
- **Desktop:** macOS (Apple Silicon + Intel) and Windows apps, downloadable from `/download`

**Stack:** Next.js 16 (App Router) · React 19 · NextAuth (Google) · Prisma 7 +
PostgreSQL · OpenAI · Zustand · CodeMirror 6 · Tailwind CSS 4

## Getting started

Requirements: Node.js ≥ 20.9 (see `.nvmrc`), npm ≥ 10, and a PostgreSQL database.

```bash
npm install
cp .env.example .env      # then fill in the values (see comments in the file)
npm run db:migrate        # create/update your local database schema
npm run dev               # http://localhost:3000
```

For Google sign-in, create an OAuth client and add
`http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run check-types` | Generate Prisma client + route types, then `tsc` |
| `npm test` / `npm run test:watch` | Vitest (unit tests + migration tests on in-process Postgres) |
| `npm run db:migrate` | **Dev only.** Apply migrations and create new ones from schema changes (`prisma migrate dev`) |
| `npm run db:deploy` | **Production.** Apply pending migrations only (`prisma migrate deploy`) |
| `npm run db:reset` | ⚠️ **Drops the database** and re-applies all migrations. Never run against production. |

## Project layout

```
src/
  app/                 Next.js routes: landing, /login, /web (editor), /download, /desktop/authorize, /api/v1/*
  components/          UI (web/ = editor, sidebar, chat panel, command palette)
  server/
    core/              auth/session, request validation, limits
    services/          database access (documents, chat messages, AI quotas, prompts)
    infra/db.ts        Prisma client
    env.ts             environment validation
  store/               Zustand stores (documents, settings)
  generated/prisma/    generated Prisma client (git-ignored; created by `prisma generate`)
prisma/
  schema.prisma        database schema
  migrations/          SQL migrations (+ migrations.test.ts)
desktop/               Electron app (own package.json; see "Desktop app" below)
brand/                 logo source + icon generator (see "Brand assets")
files/                 staged desktop releases (git-ignored; filled by `npm run stage`)
```

## Working with the database

- Change `prisma/schema.prisma`, then run `npm run db:migrate -- --name <change>` to generate a migration.
- **Review generated SQL before committing.** Prisma sometimes expresses a type change as
  `DROP COLUMN` + `ADD COLUMN`, which destroys data. Production has real users, so rewrite such
  migrations to convert in place (see `20261001120000_document_owner_fk_and_chat_role_enum`),
  and add a case to `prisma/migrations.test.ts`.
- Deploy order: run `npm run db:deploy` **before** starting the new app version.

## Limits & safety

- Request bodies are validated with zod (`src/server/core/validation.ts`); limits live in
  `src/types/document.ts` (`LIMITS`) and `src/server/core/limits.ts`.
- AI chat is rate-limited per user (`AI_REQUESTS_PER_MINUTE`, `AI_REQUESTS_PER_DAY`).
- Document saves carry the version the editor last saw; concurrent edits from another tab or
  device return `409` and the editor asks which version to keep.

## Deploying the web app

Vercel deploys `main` automatically. Before pushing a change that includes a migration:

1. Apply it to the production database first: `npm run db:deploy` (with `DATABASE_URL` pointing at production).
   The new code expects the new schema; old code keeps working with additive migrations only.
2. Push to `main` and check https://cool-write.vercel.app after the deploy.

Vercel environment variables (the build fails with a clear message if a required one is missing):

| Variable | |
|---|---|
| `DATABASE_URL`, `AUTH_SECRET` (or `NEXTAUTH_SECRET`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | required |
| `OPENAI_API_KEY` | required for AI chat |
| `AI_REQUESTS_PER_MINUTE`, `AI_REQUESTS_PER_DAY` | optional (defaults 10 / 200) |
| `DESKTOP_RELEASES_URL` | optional; where desktop builds are hosted (see below). Unset = `/download` says "coming soon" |

## Desktop app (`desktop/`)

### What it is

A thin Electron shell around the hosted web app. **It contains no Next.js, API, or database code and no
secrets**: it opens `https://cool-write.vercel.app/web` in a native window, so every web deploy reaches desktop
users immediately. The app itself only adds:

- **Sign-in through the system browser** (Google blocks sign-in inside embedded windows): the app opens
  `/desktop/authorize`, the browser hands a one-time code back via `coolwrite://` (PKCE-protected), and the app
  exchanges it for a session. The refresh token is kept in the OS keychain; signing out revokes it server-side.
- **Auto-update** from Ed25519-signed release manifests, with an **Update** button in the top bar.
- Native menus and shortcuts, a right-click menu with spelling suggestions, remembered window size, an offline
  screen, crash recovery, local logs, and a "What's new" dialog after updates.

The installer is ~120 MB, almost all of it the bundled Chromium runtime. A new desktop version is only needed when
the shell changes (sign-in, updater, menus, icons), not for web changes.

### Develop

```bash
cd desktop
npm install
npm start          # runs against http://localhost:3000 — start `npm run dev` in the repo root first
```

In dev on macOS the browser can't hand sign-in back to an unpackaged app; use **"Browser didn't bring you back?"**
on the sign-in screen and paste the code shown in the browser.

### Release a new version

1. Bump `"version"` in `desktop/package.json`. **Published versions are immutable** (browsers cache them
   forever), so every changed build needs a new number; the stage script refuses to overwrite one.
2. Build (both work on a Mac; no Windows machine needed):
   ```bash
   COOL_WRITE_ORIGIN=https://cool-write.vercel.app npm run dist:mac   # Apple Silicon + Intel .dmg/.zip
   COOL_WRITE_ORIGIN=https://cool-write.vercel.app npm run dist:win   # Windows installer
   ```
3. Sign and stage into `files/<version>/`, then make it the live release:
   ```bash
   UPDATE_SIGNING_KEY_FILE=/path/to/update-signing-key.pem npm run stage -- --promote --notes "What changed"
   ```
4. Publish to GitHub Releases (from the repo root). The versioned release holds the files; the `stable`
   release holds only the signed pointer that tells installed apps which version is current:
   ```bash
   gh release create <version> files/<version>/* --title "Cool Write <version>" --notes "What changed" --latest
   gh release upload stable files/stable/manifest.json files/stable/manifest.json.sig --clobber
   ```
   Locally, `npm run dev` serves `files/` directly.

Installed apps pick up the new version within 4 hours (or immediately via **Check for Updates…**).

### Update signing key

- `desktop/update-public-key.pem` is committed and built into every app; it only *verifies* releases.
- The **private key never goes in git**. Keep it backed up (e.g. a password manager): if it's lost, installed apps
  can't accept new updates and users must reinstall; if it leaks, someone could sign a fake update.
- On a new machine, restore it from the backup and point `UPDATE_SIGNING_KEY_FILE` at it. Never run
  `npm run keys:generate` again; it's a one-time setup and refuses to overwrite an existing key.

### Downloads and hosting

`/download` and `/api/v1/desktop/download/<mac-arm64|mac-x64|win-x64>` serve the live release; installed apps fetch
manifests and updates from `/api/v1/desktop/files/…`. Both read the `files/` tree through
`src/server/services/releases.ts`:

- **Local driver** (default): streams `files/` from disk, with resumable downloads. Used in dev.
- **Remote driver** (production): Vercel has no persistent disk, so builds live on this repo's GitHub Releases
  (tag `<version>` per release, plus tag `stable` for the signed pointer) and Vercel sets
  `DESKTOP_RELEASES_URL=https://github.com/kashyapkrlucky/cool-write/releases/download`. The same URLs then
  redirect there. Never delete the `stable` release.

### Unsigned builds

There's no paid Apple/Microsoft certificate yet: Mac builds are ad-hoc signed and Windows builds are unsigned.
Users confirm the app once on first launch (macOS: System Settings → Privacy & Security → **Open Anyway**;
Windows: **More info → Run anyway**), and the `/download` page walks them through it. Updates install without
asking again.

### Troubleshooting

- Logs: macOS `~/Library/Logs/Cool Write` (Help → Open Logs Folder).
- macOS sign-in link opens the wrong copy after local builds: unregister the build-folder copies with
  `/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -u "desktop/release/mac-arm64/Cool Write.app"`.

## Brand assets

`brand/generate-icons.mjs` holds the logo design and generates every asset from it: the favicon (`src/app/icon.svg`,
`public/favicon.ico`), the Apple touch icon, `public/logo.svg`, and the desktop icons (`desktop/build/icon.png` for
macOS, `icon.ico` for Windows). Edit it and run `node brand/generate-icons.mjs`.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:

- **web:** lint, type check, tests, a production build, and `npm audit` (blocks on critical advisories).
- **desktop:** type check and bundle (installers are built locally; see "Release a new version").

The build uses placeholder env values; nothing connects to external services.

## License

[MIT](LICENSE) © 2026 Lucky Kashyap
