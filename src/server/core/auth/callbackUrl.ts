// Only same-site paths are allowed as post-login destinations, so a crafted
// link can't bounce users to another site after they sign in.
export function safeCallbackUrl(value: unknown, fallback = "/web"): string {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
        return fallback
    }
    return value
}
