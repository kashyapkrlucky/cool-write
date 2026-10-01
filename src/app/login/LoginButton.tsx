"use client"

import { signIn } from "next-auth/react"
import { LogIn } from "lucide-react"

export function LoginButton({ callbackUrl }: { callbackUrl: string }) {
    return (
        <button
            className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-(--border) bg-(--surface) px-4 text-sm font-semibold text-(--ink) transition hover:bg-(--surface-hover)"
            onClick={() => signIn("google", { callbackUrl })}
            type="button"
        >
            <LogIn size={18} />
            Continue with Google
        </button>
    )
}
