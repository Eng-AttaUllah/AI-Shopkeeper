import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    username: string;
    role: string;
    tokenVersion: number;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      role: string;
    } & DefaultSession["user"];
  }
}

// The JWT callback is typed with @auth/core's JWT interface. Augmenting the
// `next-auth/jwt` re-export alone does not merge into it.
declare module "@auth/core/jwt" {
  interface JWT {
    username: string;
    role: string;
    tokenVersion: number;
  }
}
