import { mintSessionCookie, type DesktopGrant } from "../services/DesktopAuth"

// Shared response for token exchange and refresh: the rotated refresh token for
// the app's keychain, plus a NextAuth session cookie for its window. Tokens
// travel only in the JSON body (never cookies/URLs) and must not be cached.
export async function desktopGrantResponse(grant: DesktopGrant, request: Request) {
    const secure = new URL(request.url).protocol === "https:"
    const cookie = await mintSessionCookie(grant, secure)
    return Response.json(
        {
            refreshToken: grant.refreshToken,
            sessionCookie: cookie,
            user: { name: grant.user.name, email: grant.user.email, image: grant.user.image },
        },
        { headers: { "Cache-Control": "no-store" } },
    )
}
