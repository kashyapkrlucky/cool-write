import { refreshDesktopSession } from "../../../../../server/services/DesktopAuth"
import { desktopRefreshSchema, parseBody, readJson } from "../../../../../server/core/validation"
import { desktopGrantResponse } from "../../../../../server/core/desktopGrantResponse"

// Desktop app: trade the stored refresh token for a fresh session cookie and a
// rotated refresh token (called on every launch).
export async function POST(request: Request) {
    const json = await readJson(request, 4 * 1024)
    if (!json.ok) return json.response
    const parsed = parseBody(desktopRefreshSchema, json.body)
    if (!parsed.ok) return parsed.response

    try {
        const grant = await refreshDesktopSession(parsed.data.refreshToken, parsed.data.appVersion)
        if (!grant) return Response.json({ error: "Session expired" }, { status: 401 })
        return desktopGrantResponse(grant, request)
    } catch (error) {
        console.error("Desktop session refresh failed:", error)
        return Response.json({ error: "Refresh failed" }, { status: 500 })
    }
}
