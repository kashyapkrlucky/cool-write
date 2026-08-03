import { prisma } from "../infra/db"

export type ChatRole = "user" | "assistant"

export const getMessages = (documentId: string) => {
    return prisma.chatMessage.findMany({ where: { documentId }, orderBy: { createdAt: 'asc' } })
}

export const createMessage = (documentId: string, role: ChatRole, content: string) => {
    return prisma.chatMessage.create({ data: { documentId, role, content } })
}
