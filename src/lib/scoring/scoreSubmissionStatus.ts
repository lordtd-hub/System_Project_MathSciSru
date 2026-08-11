export function isSubmittedScoreStatus(status: string | null | undefined) {
  return status === "SUBMITTED" || status === "LOCKED";
}
