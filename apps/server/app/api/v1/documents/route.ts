import { createDocument, getDocuments } from "../../../../services/Document"
import { requireApiUser } from "../../../../core/auth/session"

export async function GET() {
    const { user, response } = await requireApiUser()
    if (!user) return response

    try {
        const documents = await getDocuments(user.id)
        return Response.json(documents)
    } catch (error) {
        return Response.json({ error: "Failed to fetch documents" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const { user, response } = await requireApiUser()
    if (!user) return response

    try {
        const body = await request.json()
        const document = await createDocument(body, user.id)
        return Response.json(document)
    } catch (error) {
        return Response.json({ error: "Failed to create document" }, { status: 500 })
    }
}
