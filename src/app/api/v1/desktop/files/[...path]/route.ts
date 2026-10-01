import { releaseFileResponse } from "../../../../../../server/services/releases"

// Serves staged builds: streamed from ./files (local driver) or redirected to
// DESKTOP_RELEASES_URL (remote driver, e.g. on Vercel). Also used by the
// desktop app's updater for manifests, signatures and update archives.
export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params
    return releaseFileResponse(path, request)
}

export async function HEAD(request: Request, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params
    return releaseFileResponse(path, request)
}
