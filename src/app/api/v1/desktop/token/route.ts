import { exchangeAuthCode } from "../../../../../server/services/DesktopAuth"
import { desktopTokenSchema, parseBody, readJson } from "../../../../../server/core/validation"
import { desktopGrantResponse } from "../../../../../server/core/desktopGrantResponse"

// Desktop app: exchange the one-time code from coolwrite://auth/callback (plus
// its PKCE verifier) for a desktop session. No cookie auth — nothing to CSRF.
export async function POST(request: Request) {
    const json = await readJson(request, 4 * 1024)
    if (!json.ok) return json.response
    const parsed = parseBody(desktopTokenSchema, json.body)
    if (!parsed.ok) return parsed.response

    try {
        const { code, codeVerifier, ...device } = parsed.data
        const grant = await exchangeAuthCode(code, codeVerifier, device)
        if (!grant) {
            return Response.json({ error: "This sign-in link is invalid or has expired. Please try again." }, { status: 400 })
        }
        return desktopGrantResponse(grant, request)
    } catch (error) {
        console.error("Desktop token exchange failed:", error)
        return Response.json({ error: "Sign-in failed" }, { status: 500 })
    }
}
