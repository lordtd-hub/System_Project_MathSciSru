import Link from "next/link";
import { auth } from "@/auth";
import { selectAcademicContext } from "@/app/term-selection-actions";
import { getCourseOfferingChoices, getStudentProjectChoices, selectedOfferingId } from "@/lib/terms/selection";
import { getTeacherOfferingChoices } from "@/lib/terms/teacherSelection";
import { hasApprovedTeacherCapability } from "@/lib/auth/capabilities";
import { AcademicContextPicker } from "./AcademicContextPicker";
import { CourseContextBadge, courseStatusText } from "./CourseContextBadge";

export async function AcademicContextBar({ contextRole }: { contextRole?: "ADMIN" | "TEACHER" | "STUDENT" }) {
  const session = await auth();
  if (!session?.user.id) return null;
  const user = session.user;
  const mode = contextRole ?? (user.role === "ADMIN" ? "ADMIN" : user.role === "STUDENT" ? "STUDENT" : "TEACHER");
  const student = mode === "STUDENT" && user.role === "STUDENT" && user.email ? await getStudentProjectChoices(user.email) : null;
  const teacher = mode === "TEACHER" && hasApprovedTeacherCapability(user) ? await getTeacherOfferingChoices(session.user.id) : null;
  const admin = mode === "ADMIN" && user.role === "ADMIN" ? await getCourseOfferingChoices() : null;
  if (!student && !teacher && !admin) return null;
  const staff = teacher?.offerings ?? admin ?? [];
  const choices = student ? student.projects.map(project => ({ id: project.id, yearBe: project.courseOffering.term.academicYear.yearBe,
    label: [project.courseOffering.term.displayName, project.courseOffering.courseCode ?? project.courseOffering.courseTitle, project.courseOffering.section].filter(Boolean).join(" · ")
  })) : staff.map(offering => ({ id: offering.id, yearBe: offering.term.academicYear.yearBe,
    label: [offering.term.displayName, offering.courseCode ?? offering.courseTitle, offering.section, courseStatusText(offering.status)].filter(Boolean).join(" · ")
  }));
  const selected = student?.selected?.id ?? teacher?.selected?.id ?? (admin ? await selectedOfferingId() : undefined);
  const current = student?.selected?.courseOffering ?? teacher?.selected ?? teacher?.current ?? admin?.find(offering => offering.id === selected);
  return <section className="mb-4" aria-label="บริบทรายวิชาปัจจุบัน">
    {current ? <CourseContextBadge offering={current} label={student ? "รายวิชาที่กำลังเรียน" : "บริบทการจัดการปัจจุบัน"} /> : null}
    {choices.length && (mode === "ADMIN" || choices.length > 1) ? <div className="panel mb-3"><AcademicContextPicker key={selected} choices={choices} selectedId={selected ?? ""} action={selectAcademicContext} contextRole={mode} allowHistoricalSearch={mode === "ADMIN"} /></div> : null}
    {student && !student.selected ? <p className="panel mb-3">ยังไม่มีรายวิชาที่เปิดและลงทะเบียนอยู่ ไม่เลือกวิชาปิดแทนโดยอัตโนมัติ</p> : null}
    {teacher && !teacher.selected ? <p className="panel mb-3">{teacher.current ? "ยังไม่มีโครงงานหรือบทบาทของท่านในรายวิชาปัจจุบัน" : "ขณะนี้ไม่มีรายวิชาเปิด"} ไม่ย้อนกลับไปจัดการวิชาปิด</p> : null}
    {student?.history.length ? <Link className="button-secondary" href="/student/history">ประวัติโครงงาน / ผล I</Link> : null}
    {teacher ? <Link className="button-secondary" href="/teacher/advisor-history">งานที่เคยเป็นที่ปรึกษา — อ่านอย่างเดียว</Link> : null}
  </section>;
}
