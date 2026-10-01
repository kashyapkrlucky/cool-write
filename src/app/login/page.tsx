import { redirect } from "next/navigation"
import { getCurrentUser } from "../../server/core/auth/session"
import { safeCallbackUrl } from "../../server/core/auth/callbackUrl"
import { LoginButton } from "./LoginButton"
import Image from "next/image"

const APP_NAME = "Cool Write"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
    const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl)
    const user = await getCurrentUser()
    if (user) {
        redirect(callbackUrl)
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-(--bg) px-4 text-(--ink)">
            <section className="w-full max-w-md rounded-2xl border border-(--border) bg-(--surface) p-6 shadow-(--shadow-soft)">
                <div className="mb-8 flex items-center gap-3">
                    <Image src="/logo.svg" alt="Cool Write" width={48} height={48} unoptimized />
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-(--ink-dim)">
                            {APP_NAME}
                        </p>
                        <h1 className="text-2xl font-semibold tracking-tight text-(--ink)">
                            Sign in with Google
                        </h1>
                    </div>
                </div>

                <p className="mb-6 text-sm leading-6 text-(--ink-dim)">
                    Sign in with your Google account to start writing. Your documents are
                    private to your account.
                </p>

                <LoginButton callbackUrl={callbackUrl} />
            </section>
        </main>
    )
}
