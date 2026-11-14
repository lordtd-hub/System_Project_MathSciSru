"use client";
import { useActionState, type ReactNode } from "react";
import type { AcademicActionResult } from "@/lib/terms/errors";
export function AcademicResultActionForm({ action, children, className }: {
  action: (previous: AcademicActionResult, data: FormData) => Promise<AcademicActionResult>; children: ReactNode; className?: string;
}) {
  const [state, submit, pending] = useActionState<AcademicActionResult, FormData>(action, { status: "idle", message: "" });
  return <form action={submit} className={className}>
    {state.message ? <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "app-alert alert-warning" : "app-alert alert-success"}>{state.message}</p> : null}
    <fieldset disabled={pending} className="contents">{children}</fieldset>
  </form>;
}
