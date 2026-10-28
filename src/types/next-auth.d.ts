import type { GlobalRole } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    ownerPasswordVersion?: number;
  }
  interface Session {
    user: {
      id?: string;
      role?: GlobalRole;
      roles?: GlobalRole[];
      teacherId?: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      authMethod?: "google" | "owner-password";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appUserId?: string;
    role?: GlobalRole;
    roles?: GlobalRole[];
    teacherId?: string | null;
    roleSyncedAt?: number;
    ownerPasswordVersion?: number;
    ownerCanonicalEmail?: string | null;
  }
}
