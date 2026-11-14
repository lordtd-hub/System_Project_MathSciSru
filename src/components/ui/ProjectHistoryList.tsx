import Link from "next/link";
import { CourseContextBadge } from "./CourseContextBadge";
import { projectStatusLabelTh } from "@/lib/lifecycle/statusLabels";
import type { ProjectStatus } from "@prisma/client";

type Entry = { id: string; currentTitleTh: string | null; status: ProjectStatus;
  student: { studentCode: string; firstNameTh: string; lastNameTh: string };
  academicResult: { status: string; originalGrade: string } | null;
  courseOffering: Parameters<typeof CourseContextBadge>[0]["offering"] };
export function ProjectHistoryList({ projects, search }: { projects: Entry[]; search: string }) {
  return <div className="space-y-4">
    <form method="get" className="panel flex flex-wrap gap-3"><label>ค้นประวัติ<input name="q" defaultValue={search} maxLength={100} placeholder="ชื่อ รหัสนักศึกษา วิชา หรือภาคเรียน" /></label><button className="button-secondary">ค้นหา</button></form>
    <p className="text-sm text-muted">อ่านข้อมูลย้อนหลังเท่านั้น การสะสาง I ในรายวิชาปิดให้ผู้ดูแลระบบบันทึก ผลและเอกสารเดิมยังคงอยู่</p>
    {!projects.length ? <p className="panel">ไม่พบประวัติโครงงานที่มีสิทธิ์ดูตามคำค้นนี้</p> : projects.map(project => <section className="panel space-y-2" key={project.id}>
      <CourseContextBadge offering={project.courseOffering} label="รายวิชาของโครงงานนี้" />
      <p>{project.student.studentCode} {project.student.firstNameTh} {project.student.lastNameTh}</p>
      <h2 className="font-semibold">{project.currentTitleTh ?? "ยังไม่ระบุชื่อโครงงาน"}</h2>
      <p>{projectStatusLabelTh(project.status)}{project.academicResult ? ` · ${project.academicResult.originalGrade} (${project.academicResult.status === "INCOMPLETE" ? "รอสะสาง" : "บันทึกผลแล้ว"})` : ""}</p>
      <Link className="button-secondary" href={`/projects/${project.id}`}>เปิดแฟ้มโครงงาน — อ่านอย่างเดียว</Link>
    </section>)}
    {projects.length === 100 ? <p>แสดงสูงสุด 100 รายการ กรุณาระบุคำค้นให้แคบลง</p> : null}
  </div>;
}
