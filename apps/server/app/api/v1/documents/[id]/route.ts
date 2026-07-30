import { getDocument, updateDocument, deleteDocument } from "../../../../../services/Document"

export async function GET(_request: Request,
    context: { params: { id: string } } | { params: Promise<{ id: string }> },) {
    try {
        const { id } = await context.params;
        const document = await getDocument(id)
        return Response.json(document)
    } catch (error) {
        return Response.json({ error: "Failed to fetch document" }, { status: 500 })
    }
}

export async function PUT(_request: Request,
    context: { params: { id: string } } | { params: Promise<{ id: string }> },) {
    try {
        const { id } = await context.params;
        const body = await _request.json()
        const document = await getDocument(id)
        if (!document) {
            return Response.json({ error: "Document not found" }, { status: 404 })
        }
        updateDocument(id, body)
        return Response.json(document)
    } catch (error) {
        return Response.json({ error: "Failed to fetch document" }, { status: 500 })
    }
}

export async function DELETE(_request: Request,
    context: { params: { id: string } } | { params: Promise<{ id: string }> },) {
    try {
        const { id } = await context.params;
        const document = await getDocument(id)
        if (!document) {
            return Response.json({ error: "Document not found" }, { status: 404 })
        }
        deleteDocument(id)
        return Response.json(document)
    } catch (error) {
        return Response.json({ error: "Failed to fetch document" }, { status: 500 })
    }
}
