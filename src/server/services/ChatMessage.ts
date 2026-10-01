import { prisma } from "../infra/db"

export type ChatRole = "user" | "assistant"

export const getMessages = (documentId: string) => {
    return prisma.chatMessage.findMany({ where: { documentId }, orderBy: { createdAt: 'asc' } })
}

// Most recent messages for model context, oldest first, keeping as many of the
// latest turns as fit in `maxChars`.
export const getRecentMessages = async (documentId: string, limit: number, maxChars: number) => {
    const newestFirst = await prisma.chatMessage.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { role: true, content: true },
    })
    const kept: typeof newestFirst = []
    let total = 0
    for (const message of newestFirst) {
        total += message.content.length
        if (total > maxChars) break
        kept.push(message)
    }
    return kept.reverse()
}

// Saves a prompt and its reply together, only once a reply exists, so failed
// requests don't leave dangling user messages in the history. Timestamps are
// explicit because rows in one transaction would otherwise share `now()`.
export const saveExchange = (documentId: string, prompt: string, promptAt: Date, reply: string) => {
    return prisma.chatMessage.createMany({
        data: [
            { documentId, role: "user", content: prompt, createdAt: promptAt },
            { documentId, role: "assistant", content: reply, createdAt: new Date(Math.max(Date.now(), promptAt.getTime() + 1)) },
        ],
    })
}
