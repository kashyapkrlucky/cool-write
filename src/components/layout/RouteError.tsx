"use client"

import { AlertCircle } from "lucide-react"
import { Button } from "../ui/Button"

interface RouteErrorProps {
    error: Error & { digest?: string }
    reset: () => void
}

export function RouteError({ error, reset }: RouteErrorProps) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
            <AlertCircle className="h-5 w-5" />
            <h2>Something went wrong</h2>
            <p>We apologize for the inconvenience. An error has occurred.</p>
            {process.env.NODE_ENV === "development" && (
                <details className="mt-2 text-sm text-(--ink-dim)">
                    <summary className="mb-1 cursor-pointer">Error details</summary>
                    <pre className="overflow-auto rounded-md bg-(--surface) p-2">
                        {error.toString()}
                    </pre>
                </details>
            )}
            <Button variant="outline" size="sm" onClick={reset} className="mt-2">
                Try again
            </Button>
        </div>
    )
}
