import type { ReactNode } from "react"
import { requirePageUser } from "../../server/core/auth/session"

export default async function AppLayout({ children }: { children: ReactNode }) {
    await requirePageUser()
    return <>{children}</>
}
