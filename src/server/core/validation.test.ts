import { describe, expect, it } from "vitest";
import { chatRequestSchema, createDocumentSchema, parseBody, readJson, updateDocumentSchema } from "./validation";
import { LIMITS } from "../../types";

async function errorOf(result: { ok: boolean; response?: Response }) {
  expect(result.ok).toBe(false);
  return { status: result.response!.status, body: await result.response!.json() };
}

describe("updateDocumentSchema", () => {
  it("allows clearing title and content to empty strings", () => {
    expect(parseBody(updateDocumentSchema, { title: "", content: "" })).toEqual({
      ok: true,
      data: { title: "", content: "" },
    });
  });

  it("rejects an empty patch", async () => {
    expect(await errorOf(parseBody(updateDocumentSchema, {}))).toEqual({
      status: 400,
      body: { error: "Nothing to update" },
    });
  });

  it("rejects unknown fields (no mass assignment of userId/id)", async () => {
    const { status } = await errorOf(parseBody(updateDocumentSchema, { title: "a", userId: 2 }));
    expect(status).toBe(400);
  });

  it("enforces the title length limit", async () => {
    const { body } = await errorOf(
      parseBody(updateDocumentSchema, { title: "x".repeat(LIMITS.titleMaxLength + 1) }),
    );
    expect(body.error).toMatch(/^title:/);
  });

  it("accepts an ISO baseUpdatedAt and rejects garbage", async () => {
    expect(parseBody(updateDocumentSchema, { content: "a", baseUpdatedAt: "2026-10-01T10:00:00.123Z" }).ok).toBe(true);
    expect((await errorOf(parseBody(updateDocumentSchema, { content: "a", baseUpdatedAt: "yesterday" }))).status).toBe(400);
  });
});

describe("createDocumentSchema", () => {
  it("defaults the title", () => {
    expect(parseBody(createDocumentSchema, {})).toEqual({ ok: true, data: { title: "Untitled" } });
  });

  it("rejects a client-chosen id", async () => {
    expect((await errorOf(parseBody(createDocumentSchema, { id: "x" }))).status).toBe(400);
  });
});

describe("chatRequestSchema", () => {
  it("trims the prompt and accepts a null documentId", () => {
    expect(parseBody(chatRequestSchema, { prompt: "  hi  ", documentId: null })).toEqual({
      ok: true,
      data: { prompt: "hi", documentId: null },
    });
  });

  it("rejects blank and oversized prompts", async () => {
    expect((await errorOf(parseBody(chatRequestSchema, { prompt: "   " }))).status).toBe(400);
    expect(
      (await errorOf(parseBody(chatRequestSchema, { prompt: "x".repeat(LIMITS.promptMaxLength + 1) }))).status,
    ).toBe(400);
  });
});

describe("readJson", () => {
  const request = (body: string, headers: Record<string, string> = {}) =>
    new Request("http://test.local", { method: "POST", body, headers });

  it("parses a valid body", async () => {
    expect(await readJson(request('{"a":1}'), 100)).toEqual({ ok: true, body: { a: 1 } });
  });

  it("returns 400 for invalid JSON", async () => {
    expect((await errorOf(await readJson(request("{nope"), 100))).status).toBe(400);
  });

  it("returns 413 when Content-Length is over the limit, without reading", async () => {
    expect((await errorOf(await readJson(request("{}", { "content-length": "101" }), 100))).status).toBe(413);
  });

  it("returns 413 when the actual body is over the limit", async () => {
    expect((await errorOf(await readJson(request(JSON.stringify({ a: "x".repeat(200) })), 100))).status).toBe(413);
  });

  it("measures bytes, not characters", async () => {
    // 40 × "é" is 40 characters but 80 bytes of UTF-8.
    expect((await errorOf(await readJson(request(JSON.stringify("é".repeat(40))), 60))).status).toBe(413);
  });
});
