import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { decodeDevSession, devSessionToAuthSession, DEV_SESSION_COOKIE, isDevLoginEnabled } from "@/lib/auth/devSession";
import { hasUsableCachedRole } from "@/lib/auth/jwtRoleCache";
import { isQaLoginEnabled } from "@/lib/auth/qaLogin";
import { emailDomain, resolveLoginRole } from "@/lib/auth/roleResolution";
import { assertProductionRuntimeEnv, getAuthSecret, getGoogleOAuthCredentials, getInitialAdminEmail } from "@/lib/config/env";
import { createNavTimer } from "@/lib/diagnostics/navTiming";

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
      const domain = emailDomain(email);
      const studentCode = domain === "student.sru.ac.th" ? email.split("@")[0] : null;

      const [importedStudent, linkedTeacher] = await Promise.all([
        studentCode
          ? prisma.student.findUnique({
              where: { studentCode },
              select: { studentCode: true }
            })
          : Promise.resolve(null),
        domain === "sru.ac.th"
          ? prisma.teacher.findFirst({
              where: { email, userId: { not: null }, active: true },
              select: { email: true }
            })
          : Promise.resolve(null)
      ]);
      const resolution = resolveLoginRole(
        { email, sub, name: user.name },
        {
          initialAdminEmail: getInitialAdminEmail(),
          importedStudentCodes: studentCode ? new Set(importedStudent ? [importedStudent.studentCode] : []) : undefined,
          linkedTeacherEmails: domain === "sru.ac.th" ? new Set(linkedTeacher?.email ? [linkedTeacher.email.trim().toLowerCase()] : []) : undefined
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
        if (!user && hasUsableCachedRole(token)) {
          return token;
        }
        const normalizedEmail = email.trim().toLowerCase();
        const timer = createNavTimer("auth.jwt");
        const appUser = await timer.measure("role_lookup", () => prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            globalRole: true,
            active: true,
            teacher: { select: { id: true, active: true } }
          }
        }));
        timer.end("jwt_ready");
        if (appUser?.active) {
          token.appUserId = appUser.id;
          token.role = appUser.globalRole;
          const teacherId = appUser.teacher?.active ? appUser.teacher.id : null;
          token.teacherId = teacherId;
          token.roles = teacherId && appUser.globalRole !== "TEACHER" ? [appUser.globalRole, "TEACHER"] : [appUser.globalRole];
          token.roleSyncedAt = Date.now();
        } else {
          delete token.appUserId;
          delete token.role;
          delete token.teacherId;
          delete token.roles;
          delete token.roleSyncedAt;
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

async function resolveAuthSession() {
  if (isDevLoginEnabled() || isQaLoginEnabled()) {
    const cookieStore = await cookies();
    const devPayload = decodeDevSession(cookieStore.get(DEV_SESSION_COOKIE)?.value);
    if (devPayload) return devSessionToAuthSession(devPayload);
  }

  const realSession = await nextAuth.auth();
  return realSession?.user?.role ? realSession : null;
}

export const auth = cache(resolveAuthSession);
