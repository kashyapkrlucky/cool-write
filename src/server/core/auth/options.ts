import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "../../infra/db";
import { getEnv } from "../../env";
import { isDesktopSessionActive } from "../../services/DesktopAuth";

const env = getEnv();

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  secret: env.AUTH_SECRET,
  logger: {
    // A revoked desktop session is expected (sign out, token reuse); log it as
    // one line instead of NextAuth's full error dump.
    error(code, metadata) {
      if (code === "JWT_SESSION_ERROR" && metadata instanceof Error && metadata.message === "Desktop session revoked") {
        console.info("[auth] Rejected a revoked desktop session");
        return;
      }
      console.error(`[next-auth][error][${code}]`, metadata);
    },
  },
  callbacks: {
    // Sign-up is open to any Google account (deliberate product decision);
    // abuse is contained by per-user AI rate limits, not by restricting sign-in.
    async signIn() {
      return true;
    },
    async jwt({ token, account, profile }) {
      // Desktop app sessions can be revoked (sign out, lost device, token
      // reuse). Throwing here makes NextAuth drop the session and clear the
      // cookie, so the window is signed out on its next request.
      if (token.desktopSessionId && !(await isDesktopSessionActive(token.desktopSessionId))) {
        throw new Error("Desktop session revoked");
      }

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
