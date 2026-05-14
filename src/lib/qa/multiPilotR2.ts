export const MULTI_PILOT_R2_PREFIX = "MULTI-PILOT-R2";
export const MULTI_PILOT_R2_COURSE_TITLE = "MULTI-PILOT-R2 Course Offering";
export const MULTI_PILOT_R2_YEAR_BE = 2570;
export const MULTI_PILOT_R2_TERM_TYPE = "SEMESTER_1" as const;
export const MULTI_PILOT_R2_WAVE2_COURSE_TITLE = "MULTI-PILOT-R2 Wave 2 Course Offering";
export const MULTI_PILOT_R2_WAVE2_YEAR_BE = 2571;
export const MULTI_PILOT_R2_WAVE2_TERM_TYPE = "SEMESTER_1" as const;
export const MULTI_PILOT_R2_WAVE2_PROJECT_COUNT = 12;
export const MULTI_PILOT_R2_REDESIGN_COURSE_TITLE = "MULTI-PILOT-R2 Redesign Regression Course Offering";
export const MULTI_PILOT_R2_REDESIGN_YEAR_BE = 2572;
export const MULTI_PILOT_R2_REDESIGN_TERM_TYPE = "SEMESTER_1" as const;

export type MultiPilotR2Student = {
  index: number;
  key: string;
  label: string;
  email: string;
  studentCode: string;
  firstNameTh: string;
  lastNameTh: string;
};

export type MultiPilotR2Teacher = {
  index: number;
  key: string;
  label: string;
  email: string;
  academicPrefix: string;
  firstNameTh: string;
  lastNameTh: string;
};

export type MultiPilotR2Scenario =
  | "Happy Path"
  | "Delayed Submission"
  | "Missing Evidence"
  | "Schedule Rejection"
  | "Report Revision Loop"
  | "Queue/Conflict Stress";

export type MultiPilotR2Project = {
  index: number;
  projectTitle: string;
  studentLabel: string;
  advisorLabel: string;
  headLabel: string;
  memberLabel: string;
  scenario: MultiPilotR2Scenario;
};

export type MultiPilotR2TeacherRoleSummary = {
  teacherLabel: string;
  advisorCount: number;
  headCount: number;
  memberCount: number;
};

export type MultiPilotR2Wave2Scenario =
  | "Normal"
  | "Late Proposal Recovery"
  | "Progress Recovery"
  | "Schedule Reject/Resubmit"
  | "Report Revision Loop";

export type MultiPilotR2Wave2Project = MultiPilotR2Project & {
  wave2Code: string;
  wave2Scenario: MultiPilotR2Wave2Scenario;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export const multiPilotR2Students: MultiPilotR2Student[] = Array.from({ length: 40 }, (_, index) => {
  const n = index + 1;
  const suffix = pad2(n);
  return {
    index: n,
    key: `multi-r2-student-${suffix}`,
    label: `${MULTI_PILOT_R2_PREFIX} Student ${suffix}`,
    email: `multi.pilot.r2.student${suffix}@sru.test`,
    studentCode: `R2STU${suffix}`,
    firstNameTh: `${MULTI_PILOT_R2_PREFIX} Student`,
    lastNameTh: suffix
  };
});

export const multiPilotR2Teachers: MultiPilotR2Teacher[] = Array.from({ length: 11 }, (_, index) => {
  const n = index + 1;
  const suffix = pad2(n);
  return {
    index: n,
    key: `multi-r2-teacher-${suffix}`,
    label: `${MULTI_PILOT_R2_PREFIX} Teacher ${suffix}`,
    email: `multi.pilot.r2.teacher${suffix}@sru.test`,
    academicPrefix: "QA ",
    firstNameTh: `${MULTI_PILOT_R2_PREFIX} Teacher`,
    lastNameTh: suffix
  };
});

export const multiPilotR2Admin = {
  role: "Admin",
  displayName: `${MULTI_PILOT_R2_PREFIX} Admin`,
  email: "multi.pilot.r2.admin@sru.test",
  purpose: "Course-scale QA pilot administration"
};

export function getMultiPilotR2Scenario(projectIndex: number): MultiPilotR2Scenario {
  if (projectIndex <= 10) return "Happy Path";
  if (projectIndex <= 18) return "Delayed Submission";
  if (projectIndex <= 24) return "Missing Evidence";
  if (projectIndex <= 30) return "Schedule Rejection";
  if (projectIndex <= 36) return "Report Revision Loop";
  return "Queue/Conflict Stress";
}

export const multiPilotR2Projects: MultiPilotR2Project[] = multiPilotR2Students.map((student, index) => {
  const n = index + 1;
  const suffix = pad2(n);
  const teacherCount = multiPilotR2Teachers.length;
  const advisor = multiPilotR2Teachers[index % teacherCount];
  const head = multiPilotR2Teachers[(index + 3) % teacherCount];
  const member = multiPilotR2Teachers[(index + 7) % teacherCount];

  return {
    index: n,
    projectTitle: `${MULTI_PILOT_R2_PREFIX} Project ${suffix}`,
    studentLabel: student.label,
    advisorLabel: advisor.label,
    headLabel: head.label,
    memberLabel: member.label,
    scenario: getMultiPilotR2Scenario(n)
  };
});

export function getMultiPilotR2Wave2Scenario(projectIndex: number): MultiPilotR2Wave2Scenario {
  if (projectIndex <= 8) return "Normal";
  if (projectIndex === 9) return "Late Proposal Recovery";
  if (projectIndex === 10) return "Progress Recovery";
  if (projectIndex === 11) return "Schedule Reject/Resubmit";
  return "Report Revision Loop";
}

export const multiPilotR2Wave2Projects: MultiPilotR2Wave2Project[] = multiPilotR2Projects
  .slice(0, MULTI_PILOT_R2_WAVE2_PROJECT_COUNT)
  .map((project) => ({
    ...project,
    wave2Code: `W2-${pad2(project.index)}`,
    projectTitle: `${MULTI_PILOT_R2_PREFIX} Wave 2 Project ${pad2(project.index)}`,
    wave2Scenario: getMultiPilotR2Wave2Scenario(project.index)
  }));

export const multiPilotR2WavePlan = [
  { wave: "Wave 1", students: 5, teachers: 4, projects: 5, goal: "workflow and role-overlap bugs" },
  { wave: "Wave 2", students: 15, teachers: 8, projects: 15, goal: "queue/dashboard/performance realism" },
  { wave: "Wave 3", students: 40, teachers: 11, projects: 40, goal: "near-real course-scale readiness" },
  { wave: "Peak Moment Test", students: 40, teachers: 11, projects: 40, goal: "concurrent submit/score/export behavior" }
] as const;

export function getMultiPilotR2TeacherRoleSummary(): MultiPilotR2TeacherRoleSummary[] {
  return multiPilotR2Teachers.map((teacher) => ({
    teacherLabel: teacher.label,
    advisorCount: multiPilotR2Projects.filter((project) => project.advisorLabel === teacher.label).length,
    headCount: multiPilotR2Projects.filter((project) => project.headLabel === teacher.label).length,
    memberCount: multiPilotR2Projects.filter((project) => project.memberLabel === teacher.label).length
  }));
}

export function getMultiPilotR2ScenarioCounts() {
  return multiPilotR2Projects.reduce<Record<MultiPilotR2Scenario, number>>((counts, project) => {
    counts[project.scenario] = (counts[project.scenario] ?? 0) + 1;
    return counts;
  }, {
    "Happy Path": 0,
    "Delayed Submission": 0,
    "Missing Evidence": 0,
    "Schedule Rejection": 0,
    "Report Revision Loop": 0,
    "Queue/Conflict Stress": 0
  });
}

export function getMultiPilotR2Wave2ScenarioCounts() {
  return multiPilotR2Wave2Projects.reduce<Record<MultiPilotR2Wave2Scenario, number>>((counts, project) => {
    counts[project.wave2Scenario] = (counts[project.wave2Scenario] ?? 0) + 1;
    return counts;
  }, {
    "Normal": 0,
    "Late Proposal Recovery": 0,
    "Progress Recovery": 0,
    "Schedule Reject/Resubmit": 0,
    "Report Revision Loop": 0
  });
}
