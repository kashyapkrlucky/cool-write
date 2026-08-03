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

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
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
            account?.provider === "google" ? account.providerAccountId : null,
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
            account?.provider === "google"
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
