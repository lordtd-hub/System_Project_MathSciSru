"use client";

import { useEffect } from "react";

const SCHEDULE_CONTENT_SELECTOR = "[data-testid=\"student-schedule-page-content\"]";
const POST_SUBMIT_SUCCESSES = new Set(["assessment_evidence_saved", "schedule_saved"]);

export function StudentSchedulePostSubmitGuard() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.pathname !== "/student/schedule") return;
    if (!POST_SUBMIT_SUCCESSES.has(url.searchParams.get("success") ?? "")) return;

    const storageKey = `student-schedule-post-submit-reload:${url.pathname}${url.search}`;
    const timer = window.setTimeout(() => {
      if (document.querySelector(SCHEDULE_CONTENT_SELECTOR)) {
        window.sessionStorage.removeItem(storageKey);
        return;
      }
      if (window.sessionStorage.getItem(storageKey)) return;

      window.sessionStorage.setItem(storageKey, "1");
      window.location.reload();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
