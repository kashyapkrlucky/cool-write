import { redirect } from "next/navigation"
import { getCurrentUser } from "../../server/core/auth/session"
import { LoginButton } from "./LoginButton"
import Image from "next/image"

const APP_NAME = "Cool Write"

export default async function LoginPage() {
    const user = await getCurrentUser()
    if (user) {
        redirect("/web")
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
            <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-8 flex items-center gap-3">
                    <Image src="/logo.png" alt="Cool Write" width={48} height={48} />
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {APP_NAME}
                        </p>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                            Sign in with Google
                        </h1>
                    </div>
                </div>

                <p className="mb-6 text-sm leading-6 text-slate-600">
                    Google is the only sign-in method for this private workspace. Your app
                    data is scoped to your email.
                </p>

                <LoginButton />
            </section>
        </main>
    )
}
