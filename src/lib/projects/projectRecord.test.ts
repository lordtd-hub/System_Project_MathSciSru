import { describe, expect, it } from "vitest";
import { canViewerSeeAttemptScore, canViewProjectRecord } from "./projectRecord";

function baseProject() {
  return {
    student: { generatedEmail: "student01@student.sru.ac.th" },
    advisorRequests: [{ advisorTeacherId: "teacher-advisor", status: "APPROVED" }],
    committeeAssignments: [{ teacherId: "teacher-committee", active: true }],
    scheduleProposals: [{ approvals: [{ teacherId: "teacher-schedule" }] }],
    attempts: [{ evaluatorAssignments: [{ teacherId: "teacher-evaluator" }] }],
    reportVersions: [{ reviews: [{ reviewerTeacherId: "teacher-report" }] }],
    advisorScore: { advisorTeacherId: "teacher-score" }
  };
}

describe("canViewProjectRecord", () => {
  it("allows admins to view any project", () => {
    expect(canViewProjectRecord(baseProject(), { role: "ADMIN", email: "admin@sru.test" }).allowed).toBe(true);
  });

  it("allows a student to view only their own project", () => {
    expect(canViewProjectRecord(baseProject(), { role: "STUDENT", email: "student01@student.sru.ac.th" })).toEqual({
      allowed: true,
      viewerRole: "STUDENT"
    });
    expect(canViewProjectRecord(baseProject(), { role: "STUDENT", email: "other@student.sru.ac.th" }).allowed).toBe(false);
  });

  it("allows related teachers through existing project relationships", () => {
    for (const teacherId of ["teacher-advisor", "teacher-committee", "teacher-schedule", "teacher-evaluator", "teacher-report", "teacher-score"]) {
      expect(canViewProjectRecord(baseProject(), { role: "TEACHER", teacherId, email: `${teacherId}@sru.test` })).toEqual({
        allowed: true,
        viewerRole: "TEACHER"
      });
    }
  });

  it("denies unrelated or unlinked teachers", () => {
    expect(canViewProjectRecord(baseProject(), { role: "TEACHER", teacherId: "teacher-other", email: "other@sru.test" }).allowed).toBe(false);
    expect(canViewProjectRecord(baseProject(), { role: "TEACHER", email: "missing-profile@sru.test" }).allowed).toBe(false);
  });

  it.each(["PENDING", "REJECTED", "CANCELLED"])("does not grant project access from a %s advisor request", (status) => {
    const project = baseProject();
    project.advisorRequests = [{ advisorTeacherId: "teacher-blocked", status }];
    expect(canViewProjectRecord(project, {
      role: "TEACHER",
      teacherId: "teacher-blocked",
      email: "teacher-blocked@sru.test"
    }).allowed).toBe(false);
  });

  it("denies missing viewers", () => {
    expect(canViewProjectRecord(baseProject(), null).allowed).toBe(false);
  });

  it("never exposes raw Proposal scores to students even when visibility is misconfigured", () => {
    expect(canViewerSeeAttemptScore("STUDENT", "PROPOSAL", true)).toBe(false);
    expect(canViewerSeeAttemptScore("STUDENT", "PROGRESS_1", true)).toBe(true);
    expect(canViewerSeeAttemptScore("TEACHER", "PROPOSAL", false)).toBe(true);
  });
});
