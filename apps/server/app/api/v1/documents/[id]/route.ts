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

export async function PATCH(_request: Request,
    context: { params: { id: string } } | { params: Promise<{ id: string }> },) {
    try {
        const { id } = await context.params;
        const { title, content } = await _request.json()
        const payload: any = {}
        if (title) {
            payload.title = title
        }
        if (content) {
            payload.content = content
        }
        const updatedDocument = await updateDocument(id, payload)
        return Response.json(updatedDocument)
    } catch (error) {
        return Response.json({ error: "Failed to update document" }, { status: 500 })
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
        await deleteDocument(id)
        return Response.json(id)
    } catch (error) {
        return Response.json({ error: "Failed to delete document" }, { status: 500 })
    }
}
