import type { GlobalRole } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: GlobalRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
