type DashboardProject = {
  id: string;
  courseOfferingId: string;
  studentId: string;
  updatedAt: Date;
};

export function getCurrentDashboardProjects<TProject extends DashboardProject>(projects: TProject[]) {
  const latestByStudentCourse = new Map<string, TProject>();
  for (const project of projects) {
    const key = `${project.courseOfferingId}:${project.studentId}`;
    const existing = latestByStudentCourse.get(key);
    if (!existing || project.updatedAt.getTime() > existing.updatedAt.getTime()) {
      latestByStudentCourse.set(key, project);
    }
  }
  return [...latestByStudentCourse.values()];
}

export function findDuplicateActiveProjectGroups<TProject extends DashboardProject>(projects: TProject[]) {
  const groups = new Map<string, TProject[]>();
  for (const project of projects) {
    const key = `${project.courseOfferingId}:${project.studentId}`;
    groups.set(key, [...(groups.get(key) ?? []), project]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}
