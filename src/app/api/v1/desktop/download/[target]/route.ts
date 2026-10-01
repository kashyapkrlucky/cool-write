import { getChannelManifest, isReleaseTarget, releaseFileUrl } from "../../../../../../server/services/releases"

// Public (no login): redirects to the latest installer for a platform, e.g.
// /api/v1/desktop/download/mac-arm64. Links stay stable across releases.
export async function GET(request: Request, context: { params: Promise<{ target: string }> }) {
    const { target } = await context.params
    if (!isReleaseTarget(target)) {
        return Response.json({ error: "Unknown download target" }, { status: 404 })
    }

    try {
        const manifest = await getChannelManifest("stable")
        const entry = manifest?.files[target]
        if (!manifest || !entry) {
            return Response.json({ error: "No release available for this platform yet" }, { status: 404 })
        }
        return new Response(null, {
            status: 302,
            headers: {
                Location: releaseFileUrl(manifest.version, entry.installer.name, request.url),
                "Cache-Control": "no-store",
            },
        })
    } catch (error) {
        console.error("Failed to resolve desktop download:", error)
        return Response.json({ error: "Failed to resolve download" }, { status: 500 })
    }
}
