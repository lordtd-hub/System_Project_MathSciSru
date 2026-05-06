export type TeacherNameParts = {
  academicPrefix: string;
  firstNameTh: string;
  lastNameTh: string;
};

export function teacherDisplayName(teacher: TeacherNameParts): string {
  return `${teacher.academicPrefix}${teacher.firstNameTh} ${teacher.lastNameTh}`.trim();
}
