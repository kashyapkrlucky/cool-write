import { prisma } from "../infra/db"
import { Prisma } from "../../generated/prisma/client"
import { CreateDocumentInput, DOCUMENT_PREVIEW_LENGTH, UpdateDocumentInput } from "../../types"

// Prisma throws P2025 when an update/delete `where` matches no row — here that
// means the document doesn't exist, belongs to another user, or (for updates
// with a base version) was changed since the client last saw it.
function isNotFound(error: unknown) {
   return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
}

type DocumentSummaryRow = {
   id: string
   title: string
   preview: string
   createdAt: Date
   updatedAt: Date
}

// The sidebar only needs a short preview, so full contents never leave the
// database for the list view.
export const getDocumentSummaries = (userId: number) => {
   return prisma.$queryRaw<DocumentSummaryRow[]>`
      SELECT "id", "title", left("content", ${DOCUMENT_PREVIEW_LENGTH}) AS "preview", "createdAt", "updatedAt"
      FROM "Document"
      WHERE "userId" = ${userId}
      ORDER BY "updatedAt" DESC
   `
}

export const getDocument = (id: string, userId: number) => {
   return prisma.document.findFirst({ where: { id, userId } })
}

export const createDocument = (data: CreateDocumentInput, userId: number) => {
   return prisma.document.create({ data: { title: data.title, content: data.content, userId } })
}

export type UpdateDocumentResult =
   | { status: "updated"; document: Awaited<ReturnType<typeof prisma.document.update>> }
   | { status: "not_found" }
   | { status: "conflict"; document: NonNullable<Awaited<ReturnType<typeof getDocument>>> }

// Ownership (and, when `baseUpdatedAt` is given, the expected version) is
// enforced in the same statement as the write, so a route can't forget the
// check and two editors can't silently overwrite each other.
export const updateDocument = async (
   id: string,
   userId: number,
   data: UpdateDocumentInput,
   baseUpdatedAt?: Date,
): Promise<UpdateDocumentResult> => {
   try {
      const document = await prisma.document.update({
         where: { id, userId, ...(baseUpdatedAt ? { updatedAt: baseUpdatedAt } : {}) },
         data,
      })
      return { status: "updated", document }
   } catch (error) {
      if (!isNotFound(error)) throw error
      if (!baseUpdatedAt) return { status: "not_found" }
      const current = await getDocument(id, userId)
      return current ? { status: "conflict", document: current } : { status: "not_found" }
   }
}

export const deleteDocument = async (id: string, userId: number) => {
   try {
      return await prisma.document.delete({ where: { id, userId } })
   } catch (error) {
      if (isNotFound(error)) return null
      throw error
   }
}
