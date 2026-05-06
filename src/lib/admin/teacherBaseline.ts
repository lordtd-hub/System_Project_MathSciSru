import type { PrismaClient } from "@prisma/client";

export type BaselineTeacherRow = {
  academicPrefix: string;
  firstNameTh: string;
  lastNameTh: string;
  email: string | null;
  department: string;
  teacherType: string;
  active: boolean;
  canEvaluateProposal: boolean;
  isInitialAdmin: boolean;
};

export const baselineTeacherRows: BaselineTeacherRow[] = [
  { academicPrefix: "ผศ.ดร.", firstNameTh: "สิทธิโชค", lastNameTh: "ทรงสอาด", email: null, department: "Mathematics", teacherType: "INTERNAL", active: true, canEvaluateProposal: true, isInitialAdmin: true },
  { academicPrefix: "ผศ.", firstNameTh: "กันญารัตน์", lastNameTh: "หนูชุม", email: null, department: "Mathematics", teacherType: "INTERNAL", active: true, canEvaluateProposal: true, isInitialAdmin: false },
  { academicPrefix: "อ.", firstNameTh: "กันยากร", lastNameTh: "อ่อนรักษ์", email: null, department: "Mathematics", teacherType: "INTERNAL", active: true, canEvaluateProposal: true, isInitialAdmin: false },
  { academicPrefix: "ผศ.ดร.", firstNameTh: "เกตุกนก", lastNameTh: "หนูดี", email: null, department: "Mathematics", teacherType: "INTERNAL", active: true, canEvaluateProposal: true, isInitialAdmin: false },
  { academicPrefix: "ผศ.", firstNameTh: "จิราพร", lastNameTh: "เสนจันทร์", email: null, department: "Mathematics", teacherType: "INTERNAL", active: true, canEvaluateProposal: true, isInitialAdmin: false },
  { academicPrefix: "อ.ดร.", firstNameTh: "ธนนต์", lastNameTh: "ก่อเกียรติสกุล", email: null, department: "Mathematics", teacherType: "INTERNAL", active: true, canEvaluateProposal: true, isInitialAdmin: false },
  { academicPrefix: "อ.", firstNameTh: "ศุภชัย", lastNameTh: "ดำคำ", email: null, department: "Mathematics", teacherType: "INTERNAL", active: true, canEvaluateProposal: true, isInitialAdmin: false },
  { academicPrefix: "ผศ.", firstNameTh: "สุจารี", lastNameTh: "ดำศรี", email: null, department: "Mathematics", teacherType: "INTERNAL", active: true, canEvaluateProposal: true, isInitialAdmin: false },
  { academicPrefix: "อ.ดร.", firstNameTh: "อรรถกร", lastNameTh: "ศักดา", email: null, department: "Mathematics", teacherType: "INTERNAL", active: true, canEvaluateProposal: true, isInitialAdmin: false },
  { academicPrefix: "ผศ.", firstNameTh: "อรวรรณ", lastNameTh: "สืบเสน", email: null, department: "Mathematics", teacherType: "INTERNAL", active: true, canEvaluateProposal: true, isInitialAdmin: false },
  { academicPrefix: "ผศ.", firstNameTh: "อัญชุลี", lastNameTh: "ณ ตะกั่วทุ่ง", email: null, department: "Mathematics", teacherType: "INTERNAL", active: true, canEvaluateProposal: true, isInitialAdmin: false }
];

export const normalizeBaselineTeacherEmail = (value: string | null | undefined) => {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
};

function resolveSeedEmail(row: BaselineTeacherRow, initialAdminEmail: string | null | undefined) {
  if (row.isInitialAdmin) return normalizeBaselineTeacherEmail(initialAdminEmail) ?? row.email;
  return normalizeBaselineTeacherEmail(row.email);
}

async function assertTeacherEmailAvailable(prisma: PrismaClient, row: BaselineTeacherRow, email: string | null) {
  if (!email) return;

  const conflict = await prisma.teacher.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      NOT: {
        academicPrefix: row.academicPrefix,
        firstNameTh: row.firstNameTh,
        lastNameTh: row.lastNameTh
      }
    },
    select: { academicPrefix: true, firstNameTh: true, lastNameTh: true, email: true }
  });

  if (conflict) {
    throw new Error(`Teacher email conflict for ${email}: already used by ${conflict.academicPrefix}${conflict.firstNameTh} ${conflict.lastNameTh}`);
  }
}

export async function seedBaselineTeacherProfiles(prisma: PrismaClient, initialAdminEmail: string | null | undefined) {
  let initialAdminLinked = false;

  for (const row of baselineTeacherRows) {
    const seedEmail = resolveSeedEmail(row, initialAdminEmail);
    await assertTeacherEmailAvailable(prisma, row, seedEmail);

    const existing = await prisma.teacher.findUnique({
      where: {
        academicPrefix_firstNameTh_lastNameTh: {
          academicPrefix: row.academicPrefix,
          firstNameTh: row.firstNameTh,
          lastNameTh: row.lastNameTh
        }
      },
      select: { email: true }
    });

    const emailData = seedEmail ? { email: seedEmail } : {};
    if (row.isInitialAdmin && seedEmail) initialAdminLinked = true;

    await prisma.teacher.upsert({
      where: {
        academicPrefix_firstNameTh_lastNameTh: {
          academicPrefix: row.academicPrefix,
          firstNameTh: row.firstNameTh,
          lastNameTh: row.lastNameTh
        }
      },
      create: {
        academicPrefix: row.academicPrefix,
        firstNameTh: row.firstNameTh,
        lastNameTh: row.lastNameTh,
        email: seedEmail,
        department: row.department,
        isInternal: row.teacherType.toUpperCase() === "INTERNAL",
        active: row.active,
        canEvaluateProposal: row.canEvaluateProposal
      },
      update: {
        department: row.department,
        isInternal: row.teacherType.toUpperCase() === "INTERNAL",
        active: row.active,
        canEvaluateProposal: row.canEvaluateProposal,
        ...(existing?.email ? {} : emailData)
      }
    });
  }

  return { sourceRows: baselineTeacherRows.length, initialAdminLinked };
}
