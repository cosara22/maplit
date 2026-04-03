// NextAuth.js セッション型拡張
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import NextAuth from "next-auth";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { JWT } from "next-auth/jwt";

type UserRole = "admin" | "manager" | "staff";

declare module "next-auth" {
  interface User {
    tenantId: string;
    role: UserRole;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      tenantId: string;
      role: UserRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId: string;
    role: UserRole;
  }
}
