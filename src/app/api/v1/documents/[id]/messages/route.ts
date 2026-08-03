import { getDocument } from "../../../../../../server/services/Document"
import { getMessages } from "../../../../../../server/services/ChatMessage"
import { requireApiUser } from "../../../../../../server/core/auth/session"

export async function GET(_request: Request,
    context: { params: { id: string } } | { params: Promise<{ id: string }> },) {
    const { user, response } = await requireApiUser()
    if (!user) return response

    try {
        const { id } = await context.params;
        const document = await getDocument(id, user.id)
        if (!document) {
            return Response.json({ error: "Document not found" }, { status: 404 })
        }
        const messages = await getMessages(id)
        return Response.json(messages)
    } catch (error) {
        return Response.json({ error: "Failed to fetch messages" }, { status: 500 })
    }
}
