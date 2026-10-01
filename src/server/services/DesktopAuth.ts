import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { encode } from "next-auth/jwt"
import { prisma } from "../infra/db"
import { getEnv } from "../env"

// Desktop sign-in:
//  1. The app opens /desktop/authorize in the system browser with a random
//     `state` and a PKCE `code_challenge` (SHA-256 of a secret verifier).
//  2. The signed-in browser gets a single-use code bound to that challenge and
//     hands it back to the app via coolwrite://auth/callback.
//  3. The app exchanges code + verifier for a refresh token (kept in the OS
//     keychain) and a regular NextAuth session cookie for its window.
// Only hashes of codes and refresh tokens are stored.

export const AUTH_CODE_TTL_MS = 5 * 60_000
export const DESKTOP_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

export const STATE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/
// base64url(SHA-256) is always 43 characters.
export const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function sha256Base64Url(value: string) {
    return createHash("sha256").update(value).digest("base64url")
}

function randomToken() {
    return randomBytes(32).toString("base64url")
}

function safeEqual(a: string, b: string) {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    return left.length === right.length && timingSafeEqual(left, right)
}

export async function createAuthCode(userId: number, codeChallenge: string) {
    const code = randomToken()
    const now = new Date()
    await prisma.$transaction([
        // Housekeeping: drop this user's expired or used codes.
        prisma.desktopAuthCode.deleteMany({
            where: { userId, OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
        }),
        prisma.desktopAuthCode.create({
            data: {
                codeHash: sha256Base64Url(code),
                codeChallenge,
                userId,
                expiresAt: new Date(now.getTime() + AUTH_CODE_TTL_MS),
            },
        }),
    ])
    return code
}

type SessionUser = { id: number; email: string; name: string | null; image: string | null }

export type DesktopGrant = {
    refreshToken: string
    sessionId: string
    user: SessionUser
}

interface DeviceInfo {
    deviceName?: string | null
    platform: string
    appVersion?: string | null
}

async function startSession(user: SessionUser, device: DeviceInfo): Promise<DesktopGrant> {
    const refreshToken = randomToken()
    const session = await prisma.desktopSession.create({
        data: {
            userId: user.id,
            refreshTokenHash: sha256Base64Url(refreshToken),
            deviceName: device.deviceName ?? null,
            platform: device.platform,
            appVersion: device.appVersion ?? null,
        },
    })
    return { refreshToken, sessionId: session.id, user }
}

const userSelect = { id: true, email: true, name: true, image: true } as const

export async function exchangeAuthCode(code: string, codeVerifier: string, device: DeviceInfo): Promise<DesktopGrant | null> {
    const record = await prisma.desktopAuthCode.findUnique({
        where: { codeHash: sha256Base64Url(code) },
        include: { user: { select: userSelect } },
    })
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) return null

    // Burn the code before checking the verifier, so a wrong guess can't be retried.
    const burned = await prisma.desktopAuthCode.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
    })
    if (burned.count !== 1) return null
    if (!safeEqual(sha256Base64Url(codeVerifier), record.codeChallenge)) return null

    return startSession(record.user, device)
}

// Rotates the refresh token. Presenting an already-rotated token means a copy
// leaked (or was replayed), so the whole session is revoked.
export async function refreshDesktopSession(refreshToken: string, appVersion?: string | null): Promise<DesktopGrant | null> {
    const hash = sha256Base64Url(refreshToken)
    const current = await prisma.desktopSession.findUnique({
        where: { refreshTokenHash: hash },
        include: { user: { select: userSelect } },
    })

    if (!current) {
        const reused = await prisma.desktopSession.findUnique({ where: { previousRefreshTokenHash: hash } })
        if (reused && !reused.revokedAt) {
            await prisma.desktopSession.update({ where: { id: reused.id }, data: { revokedAt: new Date() } })
            forgetSessionStatus(reused.id)
        }
        return null
    }
    if (current.revokedAt) return null

    const nextToken = randomToken()
    const rotated = await prisma.desktopSession.updateMany({
        where: { id: current.id, refreshTokenHash: hash, revokedAt: null },
        data: {
            refreshTokenHash: sha256Base64Url(nextToken),
            previousRefreshTokenHash: hash,
            lastUsedAt: new Date(),
            ...(appVersion ? { appVersion } : {}),
        },
    })
    if (rotated.count !== 1) return null

    return { refreshToken: nextToken, sessionId: current.id, user: current.user }
}

export async function revokeDesktopSessionByToken(refreshToken: string) {
    const hash = sha256Base64Url(refreshToken)
    const sessions = await prisma.desktopSession.findMany({
        where: { OR: [{ refreshTokenHash: hash }, { previousRefreshTokenHash: hash }], revokedAt: null },
        select: { id: true },
    })
    if (sessions.length === 0) return
    await prisma.desktopSession.updateMany({
        where: { id: { in: sessions.map((s) => s.id) } },
        data: { revokedAt: new Date() },
    })
    sessions.forEach((s) => forgetSessionStatus(s.id))
}

// NextAuth runs the jwt callback on every session read; a short cache keeps
// revocation checks from hitting the database on each request.
const STATUS_CACHE_MS = 60_000
const statusCache = new Map<string, { active: boolean; checkedAt: number }>()

function forgetSessionStatus(id: string) {
    statusCache.delete(id)
}

export async function isDesktopSessionActive(id: string): Promise<boolean> {
    const cached = statusCache.get(id)
    if (cached && Date.now() - cached.checkedAt < STATUS_CACHE_MS) return cached.active
    const session = await prisma.desktopSession.findUnique({ where: { id }, select: { revokedAt: true } })
    const active = Boolean(session && !session.revokedAt)
    statusCache.set(id, { active, checkedAt: Date.now() })
    return active
}

// A regular NextAuth session cookie for the desktop window, tagged with the
// desktop session so revoking it signs the window out (see auth/options.ts).
export async function mintSessionCookie(grant: DesktopGrant, secure: boolean) {
    const value = await encode({
        secret: getEnv().AUTH_SECRET,
        maxAge: DESKTOP_COOKIE_MAX_AGE_SECONDS,
        token: {
            sub: String(grant.user.id),
            internalUserId: String(grant.user.id),
            email: grant.user.email,
            name: grant.user.name,
            picture: grant.user.image,
            desktopSessionId: grant.sessionId,
        },
    })
    return {
        // Must match NextAuth v4's default cookie names.
        name: secure ? "__Secure-next-auth.session-token" : "next-auth.session-token",
        value,
        expiresAt: Math.floor(Date.now() / 1000) + DESKTOP_COOKIE_MAX_AGE_SECONDS,
        secure,
    }
}
