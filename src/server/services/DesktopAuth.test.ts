import { beforeEach, describe, expect, it, vi } from "vitest";
import { decode } from "next-auth/jwt";

const prisma = vi.hoisted(() => ({
  desktopAuthCode: { findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  desktopSession: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("../infra/db", () => ({ prisma }));
vi.mock("../env", () => ({ getEnv: () => ({ AUTH_SECRET: "test-secret" }) }));

const {
  exchangeAuthCode,
  isDesktopSessionActive,
  mintSessionCookie,
  refreshDesktopSession,
  revokeDesktopSessionByToken,
  sha256Base64Url,
} = await import("./DesktopAuth");

const user = { id: 7, email: "a@x.com", name: "Ada", image: null };
const verifier = "v".repeat(43);
const device = { platform: "darwin", deviceName: "Laptop", appVersion: "0.1.0" };

beforeEach(() => {
  vi.resetAllMocks();
  prisma.desktopSession.create.mockResolvedValue({ id: "s1" });
});

describe("exchangeAuthCode", () => {
  const record = (overrides = {}) => ({
    id: "c1",
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    codeChallenge: sha256Base64Url(verifier),
    user,
    ...overrides,
  });

  it("looks the code up by hash and starts a session when the PKCE verifier matches", async () => {
    prisma.desktopAuthCode.findUnique.mockResolvedValue(record());
    prisma.desktopAuthCode.updateMany.mockResolvedValue({ count: 1 });

    const grant = await exchangeAuthCode("the-code", verifier, device);

    expect(prisma.desktopAuthCode.findUnique.mock.calls[0]![0].where).toEqual({ codeHash: sha256Base64Url("the-code") });
    expect(grant).toMatchObject({ sessionId: "s1", user });
    // Only the hash of the refresh token is stored.
    const stored = prisma.desktopSession.create.mock.calls[0]![0].data;
    expect(stored.refreshTokenHash).toBe(sha256Base64Url(grant!.refreshToken));
    expect(stored).toMatchObject({ userId: 7, platform: "darwin", deviceName: "Laptop" });
  });

  it("burns the code even when the verifier is wrong", async () => {
    prisma.desktopAuthCode.findUnique.mockResolvedValue(record());
    prisma.desktopAuthCode.updateMany.mockResolvedValue({ count: 1 });
    await expect(exchangeAuthCode("the-code", "w".repeat(43), device)).resolves.toBeNull();
    expect(prisma.desktopAuthCode.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(prisma.desktopSession.create).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown", null],
    ["used", record({ usedAt: new Date() })],
    ["expired", record({ expiresAt: new Date(Date.now() - 1) })],
  ])("rejects an %s code", async (_label, found) => {
    prisma.desktopAuthCode.findUnique.mockResolvedValue(found);
    await expect(exchangeAuthCode("the-code", verifier, device)).resolves.toBeNull();
    expect(prisma.desktopSession.create).not.toHaveBeenCalled();
  });

  it("rejects when a concurrent exchange already used the code", async () => {
    prisma.desktopAuthCode.findUnique.mockResolvedValue(record());
    prisma.desktopAuthCode.updateMany.mockResolvedValue({ count: 0 });
    await expect(exchangeAuthCode("the-code", verifier, device)).resolves.toBeNull();
  });
});

describe("refreshDesktopSession", () => {
  it("rotates the refresh token, keeping the old hash for reuse detection", async () => {
    prisma.desktopSession.findUnique.mockResolvedValueOnce({ id: "s1", revokedAt: null, user });
    prisma.desktopSession.updateMany.mockResolvedValue({ count: 1 });

    const grant = await refreshDesktopSession("old-token", "0.2.0");

    expect(grant?.refreshToken).not.toBe("old-token");
    expect(prisma.desktopSession.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", refreshTokenHash: sha256Base64Url("old-token"), revokedAt: null },
      data: expect.objectContaining({
        refreshTokenHash: sha256Base64Url(grant!.refreshToken),
        previousRefreshTokenHash: sha256Base64Url("old-token"),
        appVersion: "0.2.0",
      }),
    });
  });

  it("revokes the session when an already-rotated token is replayed", async () => {
    prisma.desktopSession.findUnique
      .mockResolvedValueOnce(null) // not a current token
      .mockResolvedValueOnce({ id: "s1", revokedAt: null }); // but a previous one
    await expect(refreshDesktopSession("stolen-token")).resolves.toBeNull();
    expect(prisma.desktopSession.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { revokedAt: expect.any(Date) } });
  });

  it("rejects revoked sessions", async () => {
    prisma.desktopSession.findUnique.mockResolvedValueOnce({ id: "s1", revokedAt: new Date(), user });
    await expect(refreshDesktopSession("token")).resolves.toBeNull();
    expect(prisma.desktopSession.updateMany).not.toHaveBeenCalled();
  });
});

describe("session revocation", () => {
  it("revokes by current or previous token and is reflected by isDesktopSessionActive", async () => {
    prisma.desktopSession.findUnique.mockResolvedValue({ revokedAt: null });
    await expect(isDesktopSessionActive("s-revoke")).resolves.toBe(true);

    prisma.desktopSession.findMany.mockResolvedValue([{ id: "s-revoke" }]);
    await revokeDesktopSessionByToken("token");
    expect(prisma.desktopSession.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["s-revoke"] } },
      data: { revokedAt: expect.any(Date) },
    });

    // The cached "active" answer is dropped immediately on revoke.
    prisma.desktopSession.findUnique.mockResolvedValue({ revokedAt: new Date() });
    await expect(isDesktopSessionActive("s-revoke")).resolves.toBe(false);
  });
});

describe("mintSessionCookie", () => {
  it("produces a NextAuth-compatible cookie tagged with the desktop session", async () => {
    const cookie = await mintSessionCookie({ refreshToken: "r", sessionId: "s1", user }, true);
    expect(cookie.name).toBe("__Secure-next-auth.session-token");
    const token = await decode({ token: cookie.value, secret: "test-secret" });
    expect(token).toMatchObject({ internalUserId: "7", sub: "7", email: "a@x.com", desktopSessionId: "s1" });

    expect((await mintSessionCookie({ refreshToken: "r", sessionId: "s1", user }, false)).name).toBe(
      "next-auth.session-token",
    );
  });
});
