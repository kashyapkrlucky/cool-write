import { z } from "zod";
import { LIMITS } from "../../types";

// Rejects bodies above `maxBytes` before parsing (when Content-Length is
// present) and after reading (when it isn't), so oversized payloads never
// reach JSON.parse or the database.
export async function readJson(request: Request, maxBytes: number): Promise<
  { ok: true; body: unknown } | { ok: false; response: Response }
> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: Response.json({ error: "Request body too large" }, { status: 413 }) };
  }
  const text = await request.text().catch(() => null);
  if (text === null) {
    return { ok: false, response: Response.json({ error: "Invalid request body" }, { status: 400 }) };
  }
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, response: Response.json({ error: "Request body too large" }, { status: 413 }) };
  }
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: Response.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
}

export function parseBody<T>(schema: z.ZodType<T>, body: unknown):
  { ok: true; data: T } | { ok: false; response: Response } {
  const result = schema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  const issue = result.error.issues[0];
  const field = issue?.path.join(".");
  const message = issue ? (field ? `${field}: ${issue.message}` : issue.message) : "Invalid request";
  return { ok: false, response: Response.json({ error: message }, { status: 400 }) };
}

const title = z.string().max(LIMITS.titleMaxLength, `must be at most ${LIMITS.titleMaxLength} characters`);
const content = z.string().max(LIMITS.contentMaxLength, `must be at most ${LIMITS.contentMaxLength} characters`);

export const createDocumentSchema = z.strictObject({
  title: title.default("Untitled"),
  content: content.optional(),
});

export const updateDocumentSchema = z
  .strictObject({
    title: title.optional(),
    content: content.optional(),
    // The `updatedAt` the client last saw. When present, the update only applies
    // if the document hasn't changed since; otherwise the API answers 409.
    baseUpdatedAt: z.iso.datetime().optional(),
  })
  .refine((body) => body.title !== undefined || body.content !== undefined, {
    message: "Nothing to update",
  });

export const chatRequestSchema = z.strictObject({
  prompt: z
    .string()
    .trim()
    .min(1, "Missing prompt")
    .max(LIMITS.promptMaxLength, `must be at most ${LIMITS.promptMaxLength} characters`),
  documentId: z.string().min(1).max(64).nullish(),
});

const opaqueToken = z.string().regex(/^[A-Za-z0-9_-]{20,128}$/, "invalid token");
const deviceFields = {
  deviceName: z.string().trim().max(100).nullish(),
  platform: z.enum(["darwin", "win32", "linux"]),
  appVersion: z.string().max(40).nullish(),
};

export const desktopTokenSchema = z.strictObject({
  code: opaqueToken,
  // PKCE verifier: 43–128 characters of base64url (RFC 7636).
  codeVerifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/, "invalid code verifier"),
  ...deviceFields,
});

export const desktopRefreshSchema = z.strictObject({
  refreshToken: opaqueToken,
  appVersion: deviceFields.appVersion,
});

export const desktopLogoutSchema = z.strictObject({
  refreshToken: opaqueToken,
});
