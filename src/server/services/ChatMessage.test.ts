import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  chatMessage: { findMany: vi.fn(), createMany: vi.fn() },
}));
vi.mock("../infra/db", () => ({ prisma }));

const { getRecentMessages, saveExchange } = await import("./ChatMessage");

beforeEach(() => vi.resetAllMocks());

describe("getRecentMessages", () => {
  it("returns messages oldest-first, dropping the oldest ones that exceed the budget", async () => {
    // Prisma returns newest first.
    prisma.chatMessage.findMany.mockResolvedValue([
      { role: "assistant", content: "c".repeat(40) },
      { role: "user", content: "b".repeat(40) },
      { role: "assistant", content: "a".repeat(40) },
    ]);
    const messages = await getRecentMessages("d1", 20, 100);
    expect(messages.map((m) => m.content[0])).toEqual(["b", "c"]);
    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documentId: "d1" }, orderBy: { createdAt: "desc" }, take: 20 }),
    );
  });
});

describe("saveExchange", () => {
  it("stores prompt and reply together with strictly increasing timestamps", async () => {
    const promptAt = new Date(Date.now() + 60_000); // even if the clock looks "behind" the prompt
    await saveExchange("d1", "question", promptAt, "answer");
    const { data } = prisma.chatMessage.createMany.mock.calls[0]![0];
    expect(data.map((m: { role: string }) => m.role)).toEqual(["user", "assistant"]);
    expect(data[1].createdAt.getTime()).toBeGreaterThan(data[0].createdAt.getTime());
  });
});
