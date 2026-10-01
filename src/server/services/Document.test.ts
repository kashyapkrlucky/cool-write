import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../../generated/prisma/client";

const prisma = vi.hoisted(() => ({
  document: { update: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
}));
vi.mock("../infra/db", () => ({ prisma }));

const { deleteDocument, updateDocument } = await import("./Document");

const notFound = () =>
  new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" });

beforeEach(() => vi.resetAllMocks());

describe("updateDocument", () => {
  const base = new Date("2026-10-01T10:00:00.000Z");

  it("scopes the write to the owner and the expected version", async () => {
    prisma.document.update.mockResolvedValue({ id: "d1" });
    await expect(updateDocument("d1", 7, { content: "x" }, base)).resolves.toEqual({
      status: "updated",
      document: { id: "d1" },
    });
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: "d1", userId: 7, updatedAt: base },
      data: { content: "x" },
    });
  });

  it("omits the version check when no base is given", async () => {
    prisma.document.update.mockResolvedValue({ id: "d1" });
    await updateDocument("d1", 7, { title: "" });
    expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: "d1", userId: 7 }, data: { title: "" } });
  });

  it("reports a conflict with the current document when the version is stale", async () => {
    prisma.document.update.mockRejectedValue(notFound());
    prisma.document.findFirst.mockResolvedValue({ id: "d1", title: "theirs" });
    await expect(updateDocument("d1", 7, { content: "x" }, base)).resolves.toEqual({
      status: "conflict",
      document: { id: "d1", title: "theirs" },
    });
    expect(prisma.document.findFirst).toHaveBeenCalledWith({ where: { id: "d1", userId: 7 } });
  });

  it("reports not_found for another user's (or a missing) document", async () => {
    prisma.document.update.mockRejectedValue(notFound());
    prisma.document.findFirst.mockResolvedValue(null);
    await expect(updateDocument("d1", 7, { content: "x" }, base)).resolves.toEqual({ status: "not_found" });
    await expect(updateDocument("d1", 7, { content: "x" })).resolves.toEqual({ status: "not_found" });
  });

  it("rethrows unexpected database errors", async () => {
    prisma.document.update.mockRejectedValue(new Error("connection lost"));
    await expect(updateDocument("d1", 7, { content: "x" })).rejects.toThrow("connection lost");
  });
});

describe("deleteDocument", () => {
  it("scopes the delete to the owner and returns null when nothing matched", async () => {
    prisma.document.delete.mockRejectedValue(notFound());
    await expect(deleteDocument("d1", 7)).resolves.toBeNull();
    expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: "d1", userId: 7 } });
  });
});
