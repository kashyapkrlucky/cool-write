import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://localhost/db",
  AUTH_SECRET: "secret",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "client-secret",
};

describe("parseEnv", () => {
  it("applies defaults", () => {
    const env = parseEnv(valid);
    expect(env).toMatchObject({
      OPENAI_MODEL: "gpt-4o-mini",
      AI_REQUESTS_PER_MINUTE: 10,
      AI_REQUESTS_PER_DAY: 200,
    });
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it("accepts NEXTAUTH_SECRET as a fallback for AUTH_SECRET", () => {
    const { AUTH_SECRET: _unused, ...rest } = valid;
    expect(parseEnv({ ...rest, NEXTAUTH_SECRET: "legacy" }).AUTH_SECRET).toBe("legacy");
  });

  it("treats blank optional values as missing", () => {
    expect(parseEnv({ ...valid, OPENAI_API_KEY: "   " }).OPENAI_API_KEY).toBeUndefined();
  });

  it("coerces numeric limits", () => {
    expect(parseEnv({ ...valid, AI_REQUESTS_PER_DAY: "50" }).AI_REQUESTS_PER_DAY).toBe(50);
  });

  it("lists every problem in one error", () => {
    expect(() => parseEnv({ AUTH_SECRET: "" })).toThrowError(
      /DATABASE_URL[\s\S]*GOOGLE_CLIENT_ID[\s\S]*GOOGLE_CLIENT_SECRET/,
    );
  });

  it("requires a secret", () => {
    const { AUTH_SECRET: _unused, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrowError(/AUTH_SECRET/);
  });
});
