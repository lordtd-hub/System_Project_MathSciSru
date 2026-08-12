"use client";

import { useEffect } from "react";
import { attemptStorageOperation } from "./StudentRecoverableActionForm";

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
        attemptStorageOperation(() => window.sessionStorage.removeItem(storageKey));
        return;
      }
      const previousReload = attemptStorageOperation(() => window.sessionStorage.getItem(storageKey));
      if (previousReload.ok && previousReload.value) return;

      attemptStorageOperation(() => window.sessionStorage.setItem(storageKey, "1"));
      window.location.reload();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
