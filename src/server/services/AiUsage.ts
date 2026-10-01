import { prisma } from "../infra/db"
import { getEnv } from "../env"

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const RETENTION_MS = 2 * DAY_MS

export type AiQuotaResult =
    | { allowed: true }
    | { allowed: false; reason: "minute" | "day"; retryAfterSeconds: number }

// Records an AI request for the user if they are within their per-minute and
// per-day limits. Counting and inserting aren't atomic, so a burst of parallel
// requests can overshoot by a request or two — acceptable for cost control.
export async function consumeAiQuota(userId: number): Promise<AiQuotaResult> {
    const env = getEnv()
    const now = Date.now()

    const [lastMinute, lastDay] = await Promise.all([
        prisma.aiRequest.findMany({
            where: { userId, createdAt: { gte: new Date(now - MINUTE_MS) } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
        }),
        prisma.aiRequest.findMany({
            where: { userId, createdAt: { gte: new Date(now - DAY_MS) } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
            take: env.AI_REQUESTS_PER_DAY,
        }),
    ])

    if (lastDay.length >= env.AI_REQUESTS_PER_DAY) {
        const oldest = lastDay[0]!.createdAt.getTime()
        return { allowed: false, reason: "day", retryAfterSeconds: Math.ceil((oldest + DAY_MS - now) / 1000) }
    }
    if (lastMinute.length >= env.AI_REQUESTS_PER_MINUTE) {
        const oldest = lastMinute[0]!.createdAt.getTime()
        return { allowed: false, reason: "minute", retryAfterSeconds: Math.ceil((oldest + MINUTE_MS - now) / 1000) }
    }

    await prisma.$transaction([
        prisma.aiRequest.create({ data: { userId } }),
        prisma.aiRequest.deleteMany({
            where: { userId, createdAt: { lt: new Date(now - RETENTION_MS) } },
        }),
    ])
    return { allowed: true }
}
