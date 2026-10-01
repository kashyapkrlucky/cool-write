import { revokeDesktopSessionByToken } from "../../../../../server/services/DesktopAuth"
import { desktopLogoutSchema, parseBody, readJson } from "../../../../../server/core/validation"

// Desktop app: revoke this install's session. Always 204, so the response
// doesn't reveal whether a token was valid.
export async function POST(request: Request) {
    const json = await readJson(request, 4 * 1024)
    if (!json.ok) return json.response
    const parsed = parseBody(desktopLogoutSchema, json.body)
    if (!parsed.ok) return parsed.response

    try {
        await revokeDesktopSessionByToken(parsed.data.refreshToken)
    } catch (error) {
        console.error("Desktop logout failed:", error)
        return Response.json({ error: "Logout failed" }, { status: 500 })
    }
    return new Response(null, { status: 204 })
}
