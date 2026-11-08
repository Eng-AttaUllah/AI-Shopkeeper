import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import type { AuthUser } from "@/lib/credentials";
import { verifyCredentials } from "@/lib/credentials";
import { prisma } from "@/lib/db";

const secret = process.env.AUTH_SECRET;

if (!secret || secret === "replace-with-a-long-random-string") {
  throw new Error(
    "AUTH_SECRET is not set to a real secret. Add a long random value to .env (for example: openssl rand -hex 32).",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,
  // The app is reached by IP address on the shop's local network.
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
    updateAge: 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Shopkeeper",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: (credentials) => verifyCredentials(credentials),
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const signedIn = user as AuthUser;
        token.username = signedIn.username;
        token.accountType = signedIn.accountType;
        token.tokenVersion = signedIn.tokenVersion;
        return token;
      }

      if (!token.sub) {
        return null;
      }

      // Re-read the user so a password change (tokenVersion increment) or a
      // deleted user invalidates an existing signed cookie.
      const current = await prisma.user.findUnique({
        where: { id: token.sub },
        select: {
          username: true,
          accountType: true,
          tokenVersion: true,
        },
      });

      if (!current || current.tokenVersion !== token.tokenVersion) {
        return null;
      }

      token.username = current.username;
      token.accountType = current.accountType;

      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.username = token.username;
        session.user.accountType = token.accountType;
      }

      return session;
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        if (new URL(url).origin === new URL(baseUrl).origin) {
          return url;
        }
      } catch {
        // A malformed callback URL falls back to the app root.
      }

      return baseUrl;
    },
  },
});
