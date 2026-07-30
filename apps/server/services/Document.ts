import { prisma } from "../infra/db"
import { CreateDocumentInput, UpdateDocumentInput } from "@repo/types"

export const getDocuments = () => {
   return prisma.document.findMany({ orderBy: { updatedAt: 'desc' } })
}

export const getDocument = (id: string) => {
   return prisma.document.findUnique({ where: { id } })
}

export const createDocument = (data: CreateDocumentInput) => {
   return prisma.document.create({ data })
}

export const updateDocument = (id: string, data: UpdateDocumentInput) => {
   return prisma.document.update({ where: { id }, data })
}

export const deleteDocument = (id: string) => {
   return prisma.document.delete({ where: { id } })
}