"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertNoDuplicateTeacherEmail, normalizeTeacherEmail } from "@/lib/admin/teacherEmail";
import { seedBaselineTeacherProfiles } from "@/lib/admin/teacherBaseline";
import { validateCourseOfferingInput } from "@/lib/admin/courseOffering";
import { courseLevelRoundTypes, defaultCourseRoundName, defaultCourseRoundWeight, isRoundClosed } from "@/lib/assessments/courseRounds";
import { buildCloseAssessmentRoundData } from "@/lib/assessments/roundClosure";
import { termDisplayName } from "@/lib/terms/display";
import { generatedStudentEmail, hasImportErrors, validateStudentImportRows } from "@/lib/validators/studentImport";
import { summarizeProposalScores } from "@/lib/scoring/proposalSummary";
import { getCompletionEligibility } from "@/lib/lifecycle/completionEligibility";
import { adminConfirmProjectTransition, proposalFinalDecisionTransition } from "@/lib/lifecycle/transitions";

async function requireAdminUserId() {
  const session = await auth();
  if (session?.user.role !== "ADMIN" || !session.user.id) {
    throw new Error("ไม่อนุญาตให้เข้าถึง");
  }
  return session.user.id;
}

export async function openCourseOffering(formData: FormData) {
  const adminUserId = await requireAdminUserId();
  const parsed = validateCourseOfferingInput({
    yearBe: formData.get("year_be"),
    termType: formData.get("term_type"),
    courseTitle: formData.get("course_title")
  });
  if (!parsed.ok) redirect(`/admin/import-students?error=${parsed.error}`);
  const { yearBe, termType, courseTitle, termDisplayName: displayName } = parsed.data;

  const academicYear = await prisma.academicYear.upsert({
    where: { yearBe },
    update: { active: true },
    create: { yearBe, active: true }
  });
  const term = await prisma.term.upsert({
    where: { academicYearId_termType: { academicYearId: academicYear.id, termType } },
    update: { displayName, status: "ACTIVE" },
    create: { academicYearId: academicYear.id, termType, displayName, status: "ACTIVE" }
  });

  const existingOffering = await prisma.courseOffering.findFirst({ where: { termId: term.id, courseTitle } });
  if (existingOffering) redirect("/admin/import-students?error=course_offering_duplicate");

  const offering = await prisma.courseOffering.create({
    data: { termId: term.id, courseTitle, status: "ACTIVE" }
  });

  for (const roundType of courseLevelRoundTypes) {
    await prisma.assessmentRound.upsert({
      where: { courseOfferingId_roundType: { courseOfferingId: offering.id, roundType } },
      update: { name: defaultCourseRoundName(roundType), courseWeight: defaultCourseRoundWeight(roundType), rawScoreMax: 100 },
      create: {
        courseOfferingId: offering.id,
        roundType,
        name: defaultCourseRoundName(roundType),
        courseWeight: defaultCourseRoundWeight(roundType),
        rawScoreMax: 100,
        showEvaluatorNameToStudent: false
      }
    });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: adminUserId,
      action: "COURSE_OFFERING_OPENED",
      entityType: "CourseOffering",
      entityId: offering.id,
      afterJson: { yearBe, termType, courseTitle }
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/import-students");
  revalidatePath("/admin/students");
  revalidatePath("/admin/rounds");
  redirect(`/admin/import-students?success=course_offering_opened&course_offering_id=${offering.id}`);
}

export async function createAcademicSetup(formData: FormData) {
  return openCourseOffering(formData);
  await requireAdminUserId();
  const yearBe = Number(formData.get("year_be"));
  const termType = String(formData.get("term_type"));
  if (!yearBe || !["SEMESTER_1", "SEMESTER_2", "SUMMER"].includes(termType)) {
    throw new Error("ข้อมูลภาคเรียนไม่ถูกต้อง");
  }

  const academicYear = await prisma.academicYear.upsert({
    where: { yearBe },
    update: { active: true },
    create: { yearBe, active: true }
  });
  const term = await prisma.term.upsert({
    where: {
      academicYearId_termType: {
        academicYearId: academicYear.id,
        termType: termType as "SEMESTER_1"
      }
    },
    update: { displayName: termDisplayName(termType as "SEMESTER_1", yearBe), status: "ACTIVE" },
    create: {
      academicYearId: academicYear.id,
      termType: termType as "SEMESTER_1",
      displayName: termDisplayName(termType as "SEMESTER_1", yearBe),
      status: "ACTIVE"
    }
  });

  const existingOffering = await prisma.courseOffering.findFirst({
    where: { termId: term.id, courseTitle: "Mathematical Project Course" }
  });
  const offering = existingOffering
    ? await prisma.courseOffering.update({ where: { id: existingOffering!.id }, data: { status: "ACTIVE" } })
    : await prisma.courseOffering.create({ data: { termId: term.id, status: "ACTIVE" } });

  for (const roundType of courseLevelRoundTypes) {
    await prisma.assessmentRound.upsert({
      where: { courseOfferingId_roundType: { courseOfferingId: offering.id, roundType } },
      update: { name: defaultCourseRoundName(roundType), courseWeight: defaultCourseRoundWeight(roundType), rawScoreMax: 100 },
      create: {
        courseOfferingId: offering.id,
        roundType,
        name: defaultCourseRoundName(roundType),
        courseWeight: defaultCourseRoundWeight(roundType),
        rawScoreMax: 100,
        showEvaluatorNameToStudent: false
      }
    });
  }

  revalidatePath("/admin");
  redirect("/admin?success=project_advisor_confirmed");
}

export async function importStudents(formData: FormData) {
  const adminUserId = await requireAdminUserId();
  const courseOfferingId = String(formData.get("course_offering_id"));
  const csv = String(formData.get("csv") ?? "");

  const offering = await prisma.courseOffering.findUnique({ where: { id: courseOfferingId }, select: { id: true } });
  if (!offering) redirect("/admin/import-students?error=course_offering_missing");

  const rows = csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const [student_code, first_name_th, last_name_th] = line.split(",").map((part) => part.trim());
      return { student_code, first_name_th, last_name_th };
    });
  if (!rows.length) redirect("/admin/import-students?error=student_import_empty");

  const existingProjects = await prisma.project.findMany({
    where: { courseOfferingId },
    include: { student: true }
  });
  const existingStudents = await prisma.student.findMany({ select: { studentCode: true, generatedEmail: true } });
  const preview = validateStudentImportRows(
    rows,
    new Set(existingProjects.map((project) => project.student.studentCode)),
    new Set(existingStudents.map((student) => student.generatedEmail))
  );

  if (hasImportErrors(preview)) {
    throw new Error(preview.flatMap((row) => row.errors.map((error) => `แถว ${row.rowNumber}: ${error}`)).join("\n"));
  }

  for (const row of preview) {
    const student = await prisma.student.upsert({
      where: { studentCode: row.student_code },
      update: {
        firstNameTh: row.first_name_th,
        lastNameTh: row.last_name_th,
        generatedEmail: generatedStudentEmail(row.student_code)
      },
      create: {
        studentCode: row.student_code,
        firstNameTh: row.first_name_th,
        lastNameTh: row.last_name_th,
        generatedEmail: generatedStudentEmail(row.student_code)
      }
    });

    await prisma.project.upsert({
      where: { courseOfferingId_studentId: { courseOfferingId, studentId: student.id } },
      update: {},
      create: { courseOfferingId, studentId: student.id, status: "STUDENT_PROFILE" }
    });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: adminUserId,
      action: "STUDENT_IMPORT",
      entityType: "CourseOffering",
      entityId: courseOfferingId,
      afterJson: { importedCount: preview.length }
    }
  });

  revalidatePath("/admin/import-students");
  revalidatePath("/admin/students");
  revalidatePath("/student");
  redirect(`/admin/import-students?success=students_imported&course_offering_id=${courseOfferingId}`);
}

export async function confirmProjectAdvisor(formData: FormData) {
  const adminUserId = await requireAdminUserId();
  const projectId = String(formData.get("project_id"));
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const transition = adminConfirmProjectTransition(project.status);
  if (project.status !== "PENDING_ADMIN") throw new Error("โปรเจคนี้ยังไม่พร้อมให้ Admin ยืนยัน");

  await prisma.$transaction([
    prisma.project.update({ where: { id: projectId }, data: { status: transition.to } }),
    prisma.projectStatusHistory.create({
      data: {
        projectId,
        fromStatus: transition.from,
        toStatus: transition.to,
        reason: transition.reason,
        actorUserId: adminUserId
      }
    }),
    prisma.projectTimelineEvent.create({
      data: {
        projectId,
        eventType: "ADMIN_CONFIRMED_PROJECT_ADVISOR",
        eventTitle: "ผู้ดูแลระบบยืนยันโปรเจคและอาจารย์ที่ปรึกษา",
        actorUserId: adminUserId,
        relatedEntityType: "Project",
        relatedEntityId: projectId
      }
    })
  ]);

  revalidatePath("/admin");
}

export async function reviewTeacherClaim(formData: FormData) {
  const adminUserId = await requireAdminUserId();
  const claimId = String(formData.get("claim_id"));
  const decision = String(formData.get("decision"));
  const adminNote = String(formData.get("admin_note") ?? "");

  const claim = await prisma.teacherAccountClaim.findUniqueOrThrow({
    where: { id: claimId },
    include: { teacher: true, user: true }
  });
  if (claim.status !== "PENDING") throw new Error("คำขอผูกบัญชีนี้ถูกพิจารณาแล้ว");

  if (decision === "APPROVED") {
    await prisma.$transaction([
      prisma.teacher.update({
        where: { id: claim.teacherId },
        data: { userId: claim.userId, email: claim.claimedEmail }
      }),
      prisma.user.update({
        where: { id: claim.userId },
        data: { globalRole: "TEACHER" }
      }),
      prisma.teacherAccountClaim.update({
        where: { id: claimId },
        data: {
          status: "APPROVED",
          reviewedByAdminId: adminUserId,
          reviewedAt: new Date(),
          adminNote
        }
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: adminUserId,
          action: "TEACHER_CLAIM_APPROVED",
          entityType: "TeacherAccountClaim",
          entityId: claimId,
          afterJson: { teacherId: claim.teacherId, email: claim.claimedEmail }
        }
      })
    ]);
  } else {
    await prisma.teacherAccountClaim.update({
      where: { id: claimId },
      data: {
        status: "REJECTED",
        reviewedByAdminId: adminUserId,
        reviewedAt: new Date(),
        adminNote
      }
    });
    await prisma.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: "TEACHER_CLAIM_REJECTED",
        entityType: "TeacherAccountClaim",
        entityId: claimId
      }
    });
  }

  revalidatePath("/admin/claims");
  redirect("/admin/claims?success=teacher_claim_reviewed");
}

export async function updateTeacherEmail(formData: FormData) {
  const adminUserId = await requireAdminUserId();
  const teacherId = String(formData.get("teacher_id") ?? "");
  if (!teacherId) throw new Error("ไม่พบโปรไฟล์อาจารย์ที่ต้องการแก้ไข");

  const normalizedEmail = normalizeTeacherEmail(formData.get("email"));
  const teacher = await prisma.teacher.findUniqueOrThrow({ where: { id: teacherId } });
  const duplicate = normalizedEmail
    ? await prisma.teacher.findFirst({
        where: {
          id: { not: teacherId },
          email: { equals: normalizedEmail, mode: "insensitive" }
        },
        select: { id: true }
      })
    : null;

  assertNoDuplicateTeacherEmail({ normalizedEmail, duplicateTeacherId: duplicate?.id });

  await prisma.$transaction([
    prisma.teacher.update({
      where: { id: teacherId },
      data: { email: normalizedEmail }
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: "TEACHER_EMAIL_UPDATED",
        entityType: "Teacher",
        entityId: teacherId,
        beforeJson: { email: teacher.email },
        afterJson: { email: normalizedEmail }
      }
    })
  ]);

  revalidatePath("/admin/teachers");
  redirect("/admin/teachers?success=บันทึกอีเมลอาจารย์เรียบร้อยแล้ว กรุณาให้อาจารย์ logout/login ใหม่เพื่อ refresh สิทธิ์");
}

export async function seedTeacherBaselineFromAdmin() {
  const adminUserId = await requireAdminUserId();
  const result = await seedBaselineTeacherProfiles(prisma, process.env.INITIAL_ADMIN_EMAIL);
  const teacherCount = await prisma.teacher.count();

  await prisma.auditLog.create({
    data: {
      actorUserId: adminUserId,
      action: "TEACHER_BASELINE_SEEDED",
      entityType: "Teacher",
      entityId: "baseline",
      afterJson: {
        sourceRows: result.sourceRows,
        teacherCount,
        initialAdminLinked: result.initialAdminLinked
      }
    }
  });

  revalidatePath("/admin/teachers");
  revalidatePath("/admin");
  redirect("/admin/teachers?success=teacher_baseline_seeded");
}

export async function closeProposalRound(formData: FormData) {
  const adminUserId = await requireAdminUserId();
  const roundId = String(formData.get("round_id"));
  const round = await prisma.assessmentRound.findUniqueOrThrow({ where: { id: roundId } });
  if (isRoundClosed(round.status)) throw new Error("รอบ Proposal ปิดแล้ว");
  const attempts = await prisma.assessmentAttempt.findMany({
    where: { assessmentRoundId: roundId },
    select: { id: true, projectId: true }
  });

  await prisma.assessmentRound.update({ where: { id: roundId }, data: buildCloseAssessmentRoundData(adminUserId) });
  await Promise.all(
    attempts.map((attempt) =>
      prisma.projectTimelineEvent.create({
        data: {
          projectId: attempt.projectId,
          eventType: "PROPOSAL_CLOSED",
          eventTitle: "ปิดรอบประเมิน Proposal",
          relatedEntityType: "AssessmentRound",
          relatedEntityId: roundId
        }
      })
    )
  );

  revalidatePath("/admin/proposals");
  redirect("/admin/proposals?success=proposal_round_closed");
}

export async function openCourseRound(formData: FormData) {
  await requireAdminUserId();
  const courseOfferingId = String(formData.get("course_offering_id"));
  const roundType = String(formData.get("round_type")) as "PROGRESS_1" | "PROGRESS_2" | "FINAL_PRESENTATION" | "PROPOSAL";
  if (!courseLevelRoundTypes.includes(roundType)) throw new Error("รอบสอบไม่ถูกต้อง");

  await prisma.assessmentRound.upsert({
    where: { courseOfferingId_roundType: { courseOfferingId, roundType } },
    update: {
      name: defaultCourseRoundName(roundType),
      status: roundType === "PROPOSAL" ? "SCORING_OPEN" : "SUBMISSION_OPEN",
      submissionOpenAt: new Date(),
      closedAt: null,
      closedByAdminId: null,
      courseWeight: defaultCourseRoundWeight(roundType),
      rawScoreMax: 100
    },
    create: {
      courseOfferingId,
      roundType,
      name: defaultCourseRoundName(roundType),
      status: roundType === "PROPOSAL" ? "SCORING_OPEN" : "SUBMISSION_OPEN",
      submissionOpenAt: new Date(),
      courseWeight: defaultCourseRoundWeight(roundType),
      rawScoreMax: 100
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/rounds");
  redirect(`/admin/rounds?success=${roundType === "PROGRESS_1" ? "progress_1_opened" : "round_opened"}`);
}

export async function closeCourseRound(formData: FormData) {
  const adminUserId = await requireAdminUserId();
  const roundId = String(formData.get("round_id"));
  const round = await prisma.assessmentRound.findUniqueOrThrow({ where: { id: roundId } });
  if (isRoundClosed(round.status)) throw new Error("รอบสอบนี้ปิดแล้ว");

  await prisma.assessmentRound.update({ where: { id: roundId }, data: buildCloseAssessmentRoundData(adminUserId) });

  revalidatePath("/admin");
  revalidatePath("/admin/rounds");
  redirect(`/admin/rounds?success=${round.roundType === "PROGRESS_1" ? "progress_1_closed" : "round_closed"}`);
}

export async function saveFinalDecision(formData: FormData) {
  const adminUserId = await requireAdminUserId();
  const attemptId = String(formData.get("attempt_id"));
  const finalDecision = String(formData.get("final_decision")) as "PASS" | "PASS_WITH_REVISION" | "NOT_PASS";
  const reason = String(formData.get("final_decision_reason") ?? "");

  const attempt = await prisma.assessmentAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      project: true,
      evaluatorAssignments: {
        include: {
          scoreSubmission: {
            include: { proposalDecision: true }
          }
        }
      }
    }
  });

  const summary = summarizeProposalScores(
    attempt.evaluatorAssignments.length,
    attempt.evaluatorAssignments
      .map((assignment) => assignment.scoreSubmission)
      .filter(Boolean)
      .map((score) => ({
        totalScore: Number(score!.totalScore),
        status: score!.status,
        decision: score!.proposalDecision?.decision
      }))
  );

  await prisma.projectProposalResult.upsert({
    where: { assessmentAttemptId: attemptId },
    update: {
      averageScore: summary.averageScore,
      submittedCount: summary.submittedCount,
      missingCount: summary.missingCount,
      passCount: summary.passCount,
      revisionCount: summary.revisionCount,
      notPassCount: summary.notPassCount,
      finalDecision,
      finalDecisionReason: reason || null,
      decidedByAdminId: adminUserId,
      decidedAt: new Date()
    },
    create: {
      assessmentAttemptId: attemptId,
      projectId: attempt.projectId,
      averageScore: summary.averageScore,
      submittedCount: summary.submittedCount,
      missingCount: summary.missingCount,
      passCount: summary.passCount,
      revisionCount: summary.revisionCount,
      notPassCount: summary.notPassCount,
      finalDecision,
      finalDecisionReason: reason || null,
      decidedByAdminId: adminUserId
    }
  });

  const lifecycleDecision = finalDecision === "PASS" ? "PASS" : finalDecision === "NOT_PASS" ? "FAIL" : "REVISE";
  const transition = proposalFinalDecisionTransition(lifecycleDecision, "DRAFT", attempt.project.status);
  await prisma.$transaction([
    prisma.project.update({
      where: { id: attempt.projectId },
      data: { status: transition.to }
    }),
    prisma.projectStatusHistory.create({
      data: {
        projectId: attempt.projectId,
        fromStatus: transition.from,
        toStatus: transition.to,
        reason: transition.reason,
        actorUserId: adminUserId,
        metadataJson: { finalDecision }
      }
    })
  ]);

  await prisma.projectTimelineEvent.create({
    data: {
      projectId: attempt.projectId,
      eventType: "ADMIN_FINAL_DECISION",
      eventTitle: "ผู้ดูแลระบบบันทึกผล Proposal",
      eventDescription: finalDecision,
      actorUserId: adminUserId,
      relatedEntityType: "AssessmentAttempt",
      relatedEntityId: attemptId
    }
  });

  revalidatePath("/admin/proposals");
  redirect("/admin/proposals?success=final_decision_saved");
}

export async function assignProjectCommittee(formData: FormData) {
  const adminUserId = await requireAdminUserId();
  const projectId = String(formData.get("project_id"));
  const headTeacherId = String(formData.get("head_teacher_id") ?? "");
  const memberTeacherIds = formData.getAll("member_teacher_id").map(String).filter(Boolean);
  if (!headTeacherId) throw new Error("กรุณาเลือก HEAD");
  if (!memberTeacherIds.length) throw new Error("กรุณาเลือก MEMBER อย่างน้อย 1 คน");

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      advisorRequests: {
        where: { status: "APPROVED" },
        orderBy: { reviewedAt: "desc" },
        take: 1
      }
    }
  });
  if (project.status !== "TOPIC_APPROVED") throw new Error("แต่งตั้งกรรมการได้เฉพาะโปรเจคที่หัวข้อผ่านแล้ว");
  const advisorTeacherId = project.advisorRequests[0]?.advisorTeacherId;
  if (!advisorTeacherId) throw new Error("ไม่พบที่ปรึกษาที่อนุมัติแล้ว");
  if (headTeacherId === advisorTeacherId || memberTeacherIds.includes(advisorTeacherId)) {
    throw new Error("Advisor ไม่ควรเป็น HEAD/MEMBER ในโปรเจคเดียวกัน");
  }
  if (memberTeacherIds.includes(headTeacherId)) throw new Error("HEAD และ MEMBER ต้องไม่ซ้ำกัน");

  await prisma.$transaction([
    prisma.committeeAssignment.upsert({
      where: { projectId_teacherId_role: { projectId, teacherId: advisorTeacherId, role: "ADVISOR" } },
      update: { active: true, appointedByUserId: adminUserId },
      create: { projectId, teacherId: advisorTeacherId, role: "ADVISOR", appointedByUserId: adminUserId }
    }),
    prisma.committeeAssignment.upsert({
      where: { projectId_teacherId_role: { projectId, teacherId: headTeacherId, role: "HEAD" } },
      update: { active: true, appointedByUserId: adminUserId },
      create: { projectId, teacherId: headTeacherId, role: "HEAD", appointedByUserId: adminUserId }
    }),
    ...memberTeacherIds.map((teacherId) =>
      prisma.committeeAssignment.upsert({
        where: { projectId_teacherId_role: { projectId, teacherId, role: "MEMBER" } },
        update: { active: true, appointedByUserId: adminUserId },
        create: { projectId, teacherId, role: "MEMBER", appointedByUserId: adminUserId }
      })
    ),
    prisma.project.update({ where: { id: projectId }, data: { status: "IN_PROGRESS" } }),
    prisma.projectStatusHistory.create({
      data: {
        projectId,
        fromStatus: "TOPIC_APPROVED",
        toStatus: "IN_PROGRESS",
        reason: "COMMITTEE_ASSIGNED",
        actorUserId: adminUserId
      }
    }),
    prisma.projectTimelineEvent.create({
      data: {
        projectId,
        eventType: "COMMITTEE_ASSIGNED",
        eventTitle: "แต่งตั้งกรรมการสอบโครงงาน",
        actorUserId: adminUserId,
        relatedEntityType: "Project",
        relatedEntityId: projectId
      }
    })
  ]);

  revalidatePath("/admin/committee");
  revalidatePath("/admin");
  redirect("/admin/committee?success=committee_saved");
}

export async function releaseFeedback(formData: FormData) {
  const adminUserId = await requireAdminUserId();
  const attemptId = String(formData.get("attempt_id"));
  const attempt = await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } });

  await prisma.scoreRelease.upsert({
    where: { assessmentAttemptId: attemptId },
    update: { showFeedback: true, releasedByAdminId: adminUserId, releasedAt: new Date() },
    create: {
      assessmentAttemptId: attemptId,
      projectId: attempt.projectId,
      showFeedback: true,
      showScore: false,
      releasedByAdminId: adminUserId
    }
  });
  await prisma.projectTimelineEvent.create({
    data: {
      projectId: attempt.projectId,
      eventType: "FEEDBACK_RELEASED",
      eventTitle: "เปิด feedback ให้นักศึกษาเห็น",
      actorUserId: adminUserId,
      relatedEntityType: "AssessmentAttempt",
      relatedEntityId: attemptId
    }
  });

  revalidatePath("/admin/proposals");
  redirect("/admin/proposals?success=feedback_released");
}

export async function completeProjectCloseout(formData: FormData) {
  const adminUserId = await requireAdminUserId();
  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) throw new Error("ไม่พบ project ที่ต้องการปิดงาน");

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  if (project.status === "COMPLETED") {
    throw new Error("โครงงานนี้เสร็จสมบูรณ์แล้ว");
  }

  const eligibility = await getCompletionEligibility(projectId);
  if (!eligibility.eligible) {
    throw new Error(`ยังปิดงานไม่ได้: ${eligibility.missingRequirements.join(", ")}`);
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.project.updateMany({
      where: { id: projectId, status: "ADVISOR_SCORING" },
      data: { status: "COMPLETED" }
    });
    if (updated.count !== 1) throw new Error("โครงงานนี้ถูกปิดงานไปแล้วหรือสถานะเปลี่ยนไป กรุณารีเฟรชหน้า");

    await tx.projectStatusHistory.create({
      data: {
        projectId,
        fromStatus: project.status,
        toStatus: "COMPLETED",
        reason: "ADMIN_MARKED_COMPLETED",
        actorUserId: adminUserId,
        metadataJson: {
          progress1Score: eligibility.hasProgress1Score,
          progress2Score: eligibility.hasProgress2Score,
          finalPresentationScore: eligibility.hasFinalPresentationScore,
          reportApproved: eligibility.hasReachedReportApproved,
          advisorScore: eligibility.hasAdvisorScore
        }
      }
    });
    await tx.projectTimelineEvent.create({
      data: {
        projectId,
        eventType: "PROJECT_COMPLETED",
        eventTitle: "โครงงานเสร็จสมบูรณ์",
        eventDescription: "ผู้ดูแลระบบตรวจสอบเงื่อนไขครบแล้วและปิดงานเป็น COMPLETED",
        actorUserId: adminUserId,
        relatedEntityType: "Project",
        relatedEntityId: projectId
      }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: "PROJECT_COMPLETED",
        entityType: "Project",
        entityId: projectId,
        afterJson: { status: "COMPLETED" }
      }
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/closeout");
  revalidatePath("/student");
  redirect("/admin/closeout?success=project_completed");
}
