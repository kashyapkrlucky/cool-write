import { describe, expect, it } from "vitest";
import { buildSystemPrompt, documentContext } from "./prompt";
import { AI_CONTEXT_HEAD_CHARS, AI_CONTEXT_TAIL_CHARS } from "../core/limits";

describe("documentContext", () => {
  it("returns short documents unchanged", () => {
    expect(documentContext("hello")).toBe("hello");
  });

  it("keeps the beginning and end of long documents", () => {
    const content =
      "H".repeat(AI_CONTEXT_HEAD_CHARS) + "M".repeat(5_000) + "T".repeat(AI_CONTEXT_TAIL_CHARS);
    const result = documentContext(content);
    expect(result.startsWith("H".repeat(AI_CONTEXT_HEAD_CHARS))).toBe(true);
    expect(result.endsWith("T".repeat(AI_CONTEXT_TAIL_CHARS))).toBe(true);
    expect(result).toContain("5000 characters omitted");
    expect(result).not.toContain("M");
  });
});

describe("buildSystemPrompt", () => {
  it("says when no document is open", () => {
    expect(buildSystemPrompt(null)).toContain("no document currently open");
  });

  it("includes title and content", () => {
    const prompt = buildSystemPrompt({ title: "Plan", content: "Ship it" });
    expect(prompt).toContain('title: "Plan"');
    expect(prompt).toContain("Ship it");
  });

  it("labels empty documents", () => {
    expect(buildSystemPrompt({ title: "Blank", content: "" })).toContain("(empty)");
  });
});
