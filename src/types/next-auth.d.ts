import type { GlobalRole } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: GlobalRole;
      roles?: GlobalRole[];
      teacherId?: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appUserId?: string;
    role?: GlobalRole;
    roles?: GlobalRole[];
    teacherId?: string | null;
  }
}
