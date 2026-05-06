import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { decodeDevSession, devSessionToAuthSession, DEV_SESSION_COOKIE, isDevLoginEnabled } from "@/lib/auth/devSession";
import { resolveLoginRole } from "@/lib/auth/roleResolution";
import { assertProductionRuntimeEnv, getAuthSecret, getGoogleOAuthCredentials, getInitialAdminEmail } from "@/lib/config/env";

assertProductionRuntimeEnv();

const googleOAuth = getGoogleOAuthCredentials();

const nextAuth = NextAuth({
  session: { strategy: "jwt" },
  secret: getAuthSecret(),
  providers: [
    Google({
      clientId: googleOAuth.clientId,
      clientSecret: googleOAuth.clientSecret
    })
  ],
  callbacks: {
    async signIn({ user, profile }) {
      const rawEmail = user.email;
      const sub = profile?.sub;
      if (!rawEmail || !sub) return false;
      const email = rawEmail.trim().toLowerCase();

      const importedStudents = await prisma.student.findMany({ select: { studentCode: true } });
      const linkedTeachers = await prisma.teacher.findMany({
        where: { email: { not: null }, userId: { not: null }, active: true },
        select: { email: true }
      });
      const resolution = resolveLoginRole(
        { email, sub, name: user.name },
        {
          initialAdminEmail: getInitialAdminEmail(),
          importedStudentCodes: new Set(importedStudents.map((student) => student.studentCode)),
          linkedTeacherEmails: new Set(
            linkedTeachers.flatMap((teacher) => (teacher.email ? [teacher.email.trim().toLowerCase()] : []))
          )
        }
      );

      if (resolution.role === "DENIED") return false;

      const appUser = await prisma.user.upsert({
        where: { email },
        update: {
          googleSub: sub,
          emailDomain: resolution.emailDomain,
          name: user.name,
          globalRole: resolution.role,
          lastLoginAt: new Date()
        },
        create: {
          googleSub: sub,
          email,
          emailDomain: resolution.emailDomain,
          name: user.name,
          globalRole: resolution.role,
          lastLoginAt: new Date()
        }
      });
      if ((resolution.role === "ADMIN" || resolution.role === "TEACHER") && resolution.emailDomain === "sru.ac.th") {
        await prisma.teacher.updateMany({
          where: {
            email,
            active: true,
            OR: [{ userId: null }, { userId: appUser.id }]
          },
          data: { userId: appUser.id }
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      const email = user?.email ?? token.email;
      if (email) {
        const normalizedEmail = email.trim().toLowerCase();
        const appUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            globalRole: true,
            active: true,
            teacher: { select: { id: true, active: true } }
          }
        });
        if (appUser?.active) {
          token.appUserId = appUser.id;
          token.role = appUser.globalRole;
          const teacherId = appUser.teacher?.active ? appUser.teacher.id : null;
          token.teacherId = teacherId;
          token.roles = teacherId && appUser.globalRole !== "TEACHER" ? [appUser.globalRole, "TEACHER"] : [appUser.globalRole];
        } else {
          delete token.appUserId;
          delete token.role;
          delete token.teacherId;
          delete token.roles;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.appUserId === "string") {
        session.user.id = token.appUserId;
      }
      session.user.role = token.role as typeof session.user.role;
      session.user.roles = Array.isArray(token.roles) ? (token.roles as typeof session.user.roles) : session.user.role ? [session.user.role] : [];
      session.user.teacherId = typeof token.teacherId === "string" ? token.teacherId : null;
      return session;
    }
  },
  pages: {
    signIn: "/login"
  }
});

export const { handlers, signIn, signOut } = nextAuth;

export async function auth() {
  if (isDevLoginEnabled()) {
    const cookieStore = await cookies();
    const devPayload = decodeDevSession(cookieStore.get(DEV_SESSION_COOKIE)?.value);
    if (devPayload) return devSessionToAuthSession(devPayload);
  }

  const realSession = await nextAuth.auth();
  return realSession?.user?.role ? realSession : null;
}
