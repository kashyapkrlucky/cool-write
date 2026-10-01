import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  aiRequest: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("../infra/db", () => ({ prisma }));
vi.mock("../env", () => ({ getEnv: () => ({ AI_REQUESTS_PER_MINUTE: 2, AI_REQUESTS_PER_DAY: 3 }) }));

const { consumeAiQuota } = await import("./AiUsage");

const NOW = new Date("2026-10-01T12:00:00.000Z").getTime();
const at = (msAgo: number) => ({ createdAt: new Date(NOW - msAgo) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

// findMany is called twice: [last minute, last day].
function usage(lastMinute: { createdAt: Date }[], lastDay: { createdAt: Date }[]) {
  prisma.aiRequest.findMany.mockResolvedValueOnce(lastMinute).mockResolvedValueOnce(lastDay);
}

describe("consumeAiQuota", () => {
  it("allows and records a request under both limits", async () => {
    usage([at(10_000)], [at(10_000)]);
    await expect(consumeAiQuota(7)).resolves.toEqual({ allowed: true });
    expect(prisma.aiRequest.create).toHaveBeenCalledWith({ data: { userId: 7 } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("blocks at the per-minute limit with a retry time from the oldest request", async () => {
    usage([at(45_000), at(5_000)], [at(45_000), at(5_000)]);
    await expect(consumeAiQuota(7)).resolves.toEqual({ allowed: false, reason: "minute", retryAfterSeconds: 15 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks at the daily limit (checked before the minute limit)", async () => {
    const hour = 60 * 60_000;
    usage([], [at(23 * hour), at(2 * hour), at(hour)]);
    await expect(consumeAiQuota(7)).resolves.toEqual({ allowed: false, reason: "day", retryAfterSeconds: 3600 });
  });
});
