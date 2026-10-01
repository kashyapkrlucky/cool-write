import { createDocument, getDocumentSummaries } from "../../../../server/services/Document"
import { requireApiUser } from "../../../../server/core/auth/session"
import { createDocumentSchema, parseBody, readJson } from "../../../../server/core/validation"
import { DOCUMENT_BODY_MAX_BYTES } from "../../../../server/core/limits"

export async function GET() {
    const { user, response } = await requireApiUser()
    if (!user) return response

    try {
        const documents = await getDocumentSummaries(user.id)
        return Response.json(documents)
    } catch (error) {
        console.error("Failed to fetch documents:", error)
        return Response.json({ error: "Failed to fetch documents" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const { user, response } = await requireApiUser()
    if (!user) return response

    const json = await readJson(request, DOCUMENT_BODY_MAX_BYTES)
    if (!json.ok) return json.response
    const parsed = parseBody(createDocumentSchema, json.body)
    if (!parsed.ok) return parsed.response

    try {
        const document = await createDocument(parsed.data, user.id)
        return Response.json(document, { status: 201 })
    } catch (error) {
        console.error("Failed to create document:", error)
        return Response.json({ error: "Failed to create document" }, { status: 500 })
    }
}
