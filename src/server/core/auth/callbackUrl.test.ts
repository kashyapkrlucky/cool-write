import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "./callbackUrl";

describe("safeCallbackUrl", () => {
  it.each([
    ["/desktop/authorize?state=a&code_challenge=b", "/desktop/authorize?state=a&code_challenge=b"],
    ["/web", "/web"],
    ["https://evil.example", "/web"],
    ["//evil.example", "/web"],
    ["/\\evil.example", "/web"],
    ["javascript:alert(1)", "/web"],
    [undefined, "/web"],
  ])("%s → %s", (input, expected) => {
    expect(safeCallbackUrl(input)).toBe(expected);
  });
});
