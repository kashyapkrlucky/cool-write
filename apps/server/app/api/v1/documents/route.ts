import { createDocument, getDocuments } from "../../../../services/Document"

export async function GET() {
    try {
        const documents = await getDocuments()
        return Response.json(documents)
    } catch (error) {
        return Response.json({ error: "Failed to fetch documents" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const document = await createDocument(body)
        return Response.json(document)
    } catch (error) {
        return Response.json({ error: "Failed to create document" }, { status: 500 })
    }
}