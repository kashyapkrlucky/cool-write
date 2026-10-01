import type { Metadata } from "next"
import Image from "next/image"
import { redirect } from "next/navigation"
import { getCurrentUser } from "../../../server/core/auth/session"
import { CODE_CHALLENGE_PATTERN, createAuthCode, STATE_PATTERN } from "../../../server/services/DesktopAuth"
import { OpenDesktopApp } from "./OpenDesktopApp"

export const metadata: Metadata = { title: "Sign in to the Cool Write app" }
export const dynamic = "force-dynamic"

type Params = { state?: string; code_challenge?: string; code_challenge_method?: string }

function Card({ children }: { children: React.ReactNode }) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-(--bg) px-4 text-(--ink)">
            <section className="w-full max-w-md rounded-2xl border border-(--border) bg-(--surface) p-6 shadow-(--shadow-soft)">
                <div className="mb-6 flex items-center gap-3">
                    <Image src="/logo.svg" alt="" width={40} height={40} unoptimized />
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-(--ink-dim)">Cool Write</p>
                </div>
                {children}
            </section>
        </main>
    )
}

// Step 1 of desktop sign-in: the app opens this page in the
// system browser. After Google sign-in, it issues a single-use code bound to the
// app's PKCE challenge and hands it back via coolwrite://auth/callback.
export default async function DesktopAuthorizePage({ searchParams }: { searchParams: Promise<Params> }) {
    const params = await searchParams
    const valid =
        typeof params.state === "string" && STATE_PATTERN.test(params.state) &&
        typeof params.code_challenge === "string" && CODE_CHALLENGE_PATTERN.test(params.code_challenge) &&
        params.code_challenge_method === "S256"

    if (!valid) {
        return (
            <Card>
                <h1 className="mb-2 text-xl font-semibold">This sign-in link isn&apos;t valid</h1>
                <p className="text-sm leading-6 text-(--ink-dim)">
                    Go back to the Cool Write app and click <strong>Sign in</strong> again.
                </p>
            </Card>
        )
    }

    const user = await getCurrentUser()
    if (!user) {
        const self = `/desktop/authorize?${new URLSearchParams({
            state: params.state!,
            code_challenge: params.code_challenge!,
            code_challenge_method: "S256",
        })}`
        redirect(`/login?callbackUrl=${encodeURIComponent(self)}`)
    }

    const code = await createAuthCode(user.id, params.code_challenge!)
    const deepLink = `coolwrite://auth/callback?${new URLSearchParams({ code, state: params.state! })}`

    return (
        <Card>
            <h1 className="mb-2 text-xl font-semibold">Open the Cool Write app</h1>
            <p className="mb-6 text-sm leading-6 text-(--ink-dim)">
                Signed in as <strong className="text-(--ink)">{user.email ?? user.name}</strong>. Your browser may ask to
                open Cool Write — allow it to finish signing in.
            </p>
            <OpenDesktopApp deepLink={deepLink} code={code} />
        </Card>
    )
}
