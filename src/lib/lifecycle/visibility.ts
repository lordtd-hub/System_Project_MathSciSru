export type ProposalCommentForStudent = {
  teacherName: string;
  comment: string | null;
  vote: "PASS" | "REVISE" | "FAIL";
};

export type ProposalStudentVisibility = {
  showScore: false;
  showTeacherNames: true;
  comments: ProposalCommentForStudent[];
};

export function getProposalStudentVisibility(comments: ProposalCommentForStudent[]): ProposalStudentVisibility {
  return {
    showScore: false,
    showTeacherNames: true,
    comments
  };
}
