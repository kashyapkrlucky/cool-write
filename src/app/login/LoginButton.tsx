"use client"

import { signIn } from "next-auth/react"
import { LogIn } from "lucide-react"

export function LoginButton() {
    return (
        <button
            className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            onClick={() => signIn("google", { callbackUrl: "/web" })}
            type="button"
        >
            <LogIn size={18} />
            Continue with Google
        </button>
    )
}
