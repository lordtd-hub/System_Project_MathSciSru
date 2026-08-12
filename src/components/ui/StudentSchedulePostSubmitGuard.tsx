"use client";

import { useEffect } from "react";
import { attemptStorageOperation } from "./StudentRecoverableActionForm";

const SCHEDULE_CONTENT_SELECTOR = "[data-testid=\"student-schedule-page-content\"]";
const POST_SUBMIT_SUCCESSES = new Set(["assessment_evidence_saved", "schedule_saved"]);

export function prepareScheduleRecoveryReload({
  contentPresent,
  clearMarker,
  readMarker,
  writeMarker
}: {
  contentPresent: boolean;
  clearMarker: () => void;
  readMarker: () => string | null;
  writeMarker: () => void;
}) {
  if (contentPresent) {
    attemptStorageOperation(clearMarker);
    return false;
  }

  const previousReload = attemptStorageOperation(readMarker);
  if (!previousReload.ok || previousReload.value) return false;

  const markerSaved = attemptStorageOperation(writeMarker);
  return markerSaved.ok;
}

export function StudentSchedulePostSubmitGuard() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.pathname !== "/student/schedule") return;
    if (!POST_SUBMIT_SUCCESSES.has(url.searchParams.get("success") ?? "")) return;

    const storageKey = `student-schedule-post-submit-reload:${url.pathname}${url.search}`;
    const timer = window.setTimeout(() => {
      const shouldReload = prepareScheduleRecoveryReload({
        contentPresent: Boolean(document.querySelector(SCHEDULE_CONTENT_SELECTOR)),
        clearMarker: () => window.sessionStorage.removeItem(storageKey),
        readMarker: () => window.sessionStorage.getItem(storageKey),
        writeMarker: () => window.sessionStorage.setItem(storageKey, "1")
      });
      if (shouldReload) window.location.reload();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
