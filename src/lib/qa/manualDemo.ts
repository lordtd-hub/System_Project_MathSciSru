export const MANUAL_DEMO_PREFIX = "MANUAL-DEMO";
export const MANUAL_DEMO_COURSE_TITLE = "คู่มือการใช้งานระบบประเมินการนำเสนอโครงงาน";
export const MANUAL_DEMO_YEAR_BE = 2572;
export const MANUAL_DEMO_TERM_TYPE = "SEMESTER_1" as const;

export const manualDemoAdmin = {
  role: "Admin",
  displayName: "ผู้ดูแลระบบสำหรับจัดทำคู่มือ",
  email: "manual.demo.admin@sru.test",
  purpose: "ใช้จัดทำคู่มือผู้ดูแลระบบใน QA"
};

export type ManualDemoStudent = {
  index: number;
  key: string;
  label: string;
  email: string;
  studentCode: string;
  firstNameTh: string;
  lastNameTh: string;
  purpose: string;
};

export const manualDemoStudents: ManualDemoStudent[] = [
  {
    index: 1,
    key: "manual-demo-student-01",
    label: "คู่มือ Student 01",
    email: "manual.demo.student01@sru.test",
    studentCode: "MANSTU01",
    firstNameTh: "นักศึกษาคู่มือ",
    lastNameTh: "ขั้นตอนปกติ",
    purpose: "ใช้ถ่ายคู่มือนักศึกษาเส้นทางปกติ"
  },
  {
    index: 2,
    key: "manual-demo-student-02",
    label: "คู่มือ Student 02",
    email: "manual.demo.student02@sru.test",
    studentCode: "MANSTU02",
    firstNameTh: "นักศึกษาคู่มือ",
    lastNameTh: "แก้ไขรายงาน",
    purpose: "ใช้ถ่ายคู่มือกรณีอาจารย์ขอแก้ไขรายงาน"
  },
  {
    index: 3,
    key: "manual-demo-student-03",
    label: "คู่มือ Student 03",
    email: "manual.demo.student03@sru.test",
    studentCode: "MANSTU03",
    firstNameTh: "นักศึกษาคู่มือ",
    lastNameTh: "รอตารางสอบ",
    purpose: "ใช้ถ่ายคู่มือกรณีรออนุมัติวันสอบ"
  }
];

export type ManualDemoTeacher = {
  index: number;
  key: string;
  label: string;
  email: string;
  realEmail: string | null;
  academicPrefix: string;
  firstNameTh: string;
  lastNameTh: string;
  purpose: string;
};

type ManualDemoTeacherSeed = [academicPrefix: string, firstNameTh: string, lastNameTh: string, realEmail: string | null];

const manualDemoTeacherSeeds: ManualDemoTeacherSeed[] = [
  ["ผศ.", "กันญารัตน์", "หนูชุม", null],
  ["อ.", "กันยากร", "อ่อนรักษ์", null],
  ["ผศ.ดร.", "เกตุกนก", "หนูดี", null],
  ["ผศ.", "จิราพร", "เสนจันทร์", null],
  ["อ.ดร.", "ธนนต์", "ก่อเกียรติสกุล", "thanon.kor@sru.ac.th"],
  ["อ.", "ศุภชัย", "ดำคำ", null],
  ["ผศ.ดร.", "สิทธิโชค", "ทรงสอาด", "sittichoke.son@sru.ac.th"],
  ["ผศ.", "สุจารี", "ดำศรี", null],
  ["อ.ดร.", "อรรถกร", "ศักดา", null],
  ["ผศ.", "อรวรรณ", "สืบเสน", null],
  ["ผศ.", "อัญชุลี", "ณ ตะกั่วทุ่ง", null]
];

export const manualDemoTeachers: ManualDemoTeacher[] = manualDemoTeacherSeeds.map(([academicPrefix, firstNameTh, lastNameTh, realEmail], index) => {
  const n = index + 1;
  const suffix = String(n).padStart(2, "0");
  return {
    index: n,
    key: `manual-demo-teacher-${suffix}`,
    label: `${academicPrefix}${firstNameTh} ${lastNameTh}`,
    email: `manual.demo.teacher${suffix}@sru.test`,
    realEmail,
    academicPrefix,
    firstNameTh,
    lastNameTh,
    purpose: "ใช้ถ่ายคู่มืออาจารย์ใน QA โดยคงชื่ออาจารย์จริงไว้"
  };
});
