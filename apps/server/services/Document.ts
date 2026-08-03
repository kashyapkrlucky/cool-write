import { prisma } from "../infra/db"
import { CreateDocumentInput, UpdateDocumentInput } from "@repo/types"

export const getDocuments = (userId: string) => {
   return prisma.document.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } })
}

export const getDocument = (id: string, userId: string) => {
   return prisma.document.findFirst({ where: { id, userId } })
}

export const createDocument = (data: CreateDocumentInput, userId: string) => {
   return prisma.document.create({ data: { ...data, userId } })
}

export const updateDocument = (id: string, data: UpdateDocumentInput) => {
   return prisma.document.update({ where: { id }, data })
}

export const deleteDocument = (id: string) => {
   return prisma.document.delete({ where: { id } })
}
