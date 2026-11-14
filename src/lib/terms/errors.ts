export class AcademicWorkflowError extends Error {}
export type AcademicActionResult = { status: "idle" | "success" | "error"; message: string };
