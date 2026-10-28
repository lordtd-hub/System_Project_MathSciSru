import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { decodeDevSession, devSessionToAuthSession, DEV_SESSION_COOKIE, isDevLoginEnabled } from "@/lib/auth/devSession";
import { hasUsableCachedRole } from "@/lib/auth/jwtRoleCache";
import { isQaLoginEnabled } from "@/lib/auth/qaLogin";
import { emailDomain, resolveLoginRole } from "@/lib/auth/roleResolution";
import { getAuthRuntimeConfiguration, getAuthSecret, getGoogleOAuthCredentials, getInitialAdminEmail } from "@/lib/config/env";
import { createNavTimer } from "@/lib/diagnostics/navTiming";
import { authenticateOwnerPassword, getOwnerPasswordSession } from "@/lib/auth/ownerPassword";

const googleOAuth = getGoogleOAuthCredentials();

const nextAuth = NextAuth({
  session: { strategy: "jwt" },
  secret: getAuthSecret(),
  providers: [
    ...(googleOAuth.clientId && googleOAuth.clientSecret ? [Google({
      clientId: googleOAuth.clientId,
      clientSecret: googleOAuth.clientSecret
    })] : []),
    Credentials({
      id: "owner-password",
      name: "รหัสผ่านเจ้าของระบบ",
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(credentials) {
        try { return await authenticateOwnerPassword(credentials.email, credentials.password); }
        catch { return null; } // Fail closed without logging credential-bearing errors.
      }
    })
  ],
  callbacks: {
    async signIn({ user, profile, account }) {
      if (account?.provider === "owner-password") {
        return Boolean(await getOwnerPasswordSession(user.id, user.ownerPasswordVersion));
      }
      if (account?.provider !== "google") return false;
      if (profile?.email_verified !== true) return false;
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
      if (user) {
        if (typeof user.ownerPasswordVersion === "number") {
          token.ownerPasswordVersion = user.ownerPasswordVersion;
          token.appUserId = user.id;
        } else {
          delete token.ownerPasswordVersion;
          delete token.ownerCanonicalEmail;
        }
      }
      if (typeof token.ownerPasswordVersion === "number") {
        // Apply the rollback guard even if revocation races initial JWT creation.
        token.email = typeof token.appUserId === "string" ? `owner-password:${token.appUserId}` : "owner-password:revoked";
        delete token.roleSyncedAt;
        delete token.ownerCanonicalEmail;
        const owner = await getOwnerPasswordSession(token.appUserId, token.ownerPasswordVersion);
        if (owner) {
          token.appUserId = owner.id;
          token.role = owner.globalRole;
          token.teacherId = owner.teacher?.active ? owner.teacher.id : null;
          token.roles = token.teacherId ? [owner.globalRole, "TEACHER"] : [owner.globalRole];
          // A rollback to the former email-based JWT callback must not treat a
          // password JWT as a normal Google session. Keep canonical email only
          // in the private marker and expose it through the session callback.
          token.ownerCanonicalEmail = owner.email;
        } else {
          delete token.appUserId;
          delete token.role;
          delete token.roles;
          delete token.teacherId;
          delete token.roleSyncedAt;
        }
        return token;
      }
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
      session.user.authMethod = typeof token.ownerPasswordVersion === "number" ? "owner-password" : "google";
      if (typeof token.ownerPasswordVersion === "number") {
        session.user.email = typeof token.ownerCanonicalEmail === "string" ? token.ownerCanonicalEmail : "";
      }
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

  if (!getAuthRuntimeConfiguration().ready) return null;

  const realSession = await nextAuth.auth();
  return realSession?.user?.role ? realSession : null;
}

export const auth = cache(resolveAuthSession);
