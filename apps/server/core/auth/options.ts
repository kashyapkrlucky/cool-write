import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "../../infra/db";

function getAuthSecret() {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    undefined
  );
}

export function getWebAppUrl() {
  return process.env.WEB_APP_URL?.trim() || "http://localhost:5173";
}

// The web app and this API are deployed on different domains, which makes
// every auth request cross-site. Cookies default to SameSite=Lax, which
// browsers refuse to send on cross-site POSTs (the sign-in CSRF cookie) and
// cross-site fetch/XHR (the session cookie read by the SPA). SameSite=None
// fixes both, but requires Secure, so it's only safe to turn on once the API
// itself is actually served over https.
const useSecureCookies = (
  process.env.NEXTAUTH_URL ??
  process.env.AUTH_URL ??
  ""
).startsWith("https://");

const crossSiteCookieOptions = {
  httpOnly: true,
  sameSite: useSecureCookies ? ("none" as const) : ("lax" as const),
  path: "/",
  secure: useSecureCookies,
};

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  useSecureCookies,
  cookies: {
    sessionToken: {
      name: `${useSecureCookies ? "__Secure-" : ""}next-auth.session-token`,
      options: crossSiteCookieOptions,
    },
    callbackUrl: {
      name: `${useSecureCookies ? "__Secure-" : ""}next-auth.callback-url`,
      options: crossSiteCookieOptions,
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: crossSiteCookieOptions,
    },
    state: {
      name: `${useSecureCookies ? "__Secure-" : ""}next-auth.state`,
      options: { ...crossSiteCookieOptions, maxAge: 60 * 15 },
    },
    pkceCodeVerifier: {
      name: `${useSecureCookies ? "__Secure-" : ""}next-auth.pkce.code_verifier`,
      options: { ...crossSiteCookieOptions, maxAge: 60 * 15 },
    },
    nonce: {
      name: `${useSecureCookies ? "__Secure-" : ""}next-auth.nonce`,
      options: crossSiteCookieOptions,
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  secret: getAuthSecret(),
  callbacks: {
    async signIn() {
      return true;
    },
    async redirect({ url, baseUrl }) {
      const webAppUrl = getWebAppUrl();
      if (url.startsWith("/")) return `${webAppUrl}${url}`;
      if (new URL(url).origin === webAppUrl) return url;
      if (new URL(url).origin === baseUrl) return url;
      return webAppUrl;
    },
    async jwt({ token, account, profile }) {
      if (!token.email && profile?.email) {
        token.email = profile.email;
      }

      if (!token.email) {
        return token;
      }

      // Only touch the database on the actual sign-in event (when `account`
      // is present). This callback also fires on every subsequent session
      // read, and re-running the upsert there let concurrent requests race
      // to `create` the same brand-new user, tripping the unique constraint
      // and failing sign-in for first-time users only.
      if (!account) {
        return token;
      }

      const dbUser = await prisma.user.upsert({
        where: { email: token.email },
        create: {
          email: token.email,
          name: token.name ?? profile?.name ?? null,
          image:
            typeof token.picture === "string"
              ? token.picture
              : typeof profile?.image === "string"
                ? profile.image
                : null,
          googleSubject:
            account.provider === "google" ? account.providerAccountId : null,
        },
        update: {
          name: token.name ?? profile?.name ?? undefined,
          image:
            typeof token.picture === "string"
              ? token.picture
              : typeof profile?.image === "string"
                ? profile.image
                : undefined,
          googleSubject:
            account.provider === "google"
              ? account.providerAccountId
              : undefined,
        },
      });

      const internalUserId = String(dbUser.id);
      token.internalUserId = internalUserId;
      token.name = dbUser.name ?? token.name;
      token.picture = dbUser.image ?? token.picture;

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.internalUserId) {
        session.user.id = token.internalUserId;
      }

      return session;
    },
  },
};
