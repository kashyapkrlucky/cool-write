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
