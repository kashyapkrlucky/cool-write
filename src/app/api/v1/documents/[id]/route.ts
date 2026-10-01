import { getDocument, updateDocument, deleteDocument } from "../../../../../server/services/Document"
import { requireApiUser } from "../../../../../server/core/auth/session"
import { parseBody, readJson, updateDocumentSchema } from "../../../../../server/core/validation"
import { DOCUMENT_BODY_MAX_BYTES } from "../../../../../server/core/limits"

const notFound = () => Response.json({ error: "Document not found" }, { status: 404 })

export async function GET(_request: Request,
    context: { params: { id: string } } | { params: Promise<{ id: string }> },) {
    const { user, response } = await requireApiUser()
    if (!user) return response

    try {
        const { id } = await context.params;
        const document = await getDocument(id, user.id)
        if (!document) return notFound()
        return Response.json(document)
    } catch (error) {
        console.error("Failed to fetch document:", error)
        return Response.json({ error: "Failed to fetch document" }, { status: 500 })
    }
}

export async function PATCH(request: Request,
    context: { params: { id: string } } | { params: Promise<{ id: string }> },) {
    const { user, response } = await requireApiUser()
    if (!user) return response

    const json = await readJson(request, DOCUMENT_BODY_MAX_BYTES)
    if (!json.ok) return json.response
    // Empty strings are valid: users can clear a title or the whole document.
    const parsed = parseBody(updateDocumentSchema, json.body)
    if (!parsed.ok) return parsed.response

    try {
        const { id } = await context.params;
        const { baseUpdatedAt, ...patch } = parsed.data
        const result = await updateDocument(id, user.id, patch, baseUpdatedAt ? new Date(baseUpdatedAt) : undefined)
        if (result.status === "not_found") return notFound()
        if (result.status === "conflict") {
            return Response.json(
                { error: "This document was changed somewhere else", document: result.document },
                { status: 409 },
            )
        }
        return Response.json(result.document)
    } catch (error) {
        console.error("Failed to update document:", error)
        return Response.json({ error: "Failed to update document" }, { status: 500 })
    }
}

export async function DELETE(_request: Request,
    context: { params: { id: string } } | { params: Promise<{ id: string }> },) {
    const { user, response } = await requireApiUser()
    if (!user) return response

    try {
        const { id } = await context.params;
        const deleted = await deleteDocument(id, user.id)
        if (!deleted) return notFound()
        return new Response(null, { status: 204 })
    } catch (error) {
        console.error("Failed to delete document:", error)
        return Response.json({ error: "Failed to delete document" }, { status: 500 })
    }
}
