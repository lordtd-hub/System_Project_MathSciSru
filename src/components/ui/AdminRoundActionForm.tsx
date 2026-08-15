"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { AdminRoundActionResult } from "@/lib/assessments/adminRoundActionResult";

const idleAdminRoundActionResult: AdminRoundActionResult = { status: "idle" };

export type AdminRoundFormAction = (
  previousState: AdminRoundActionResult,
  formData: FormData
) => Promise<AdminRoundActionResult>;

export function AdminRoundActionForm({
  action,
  children,
  className
}: {
  action: AdminRoundFormAction;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const handledRequestId = useRef<string | null>(null);
  const [result, formAction] = useActionState(action, idleAdminRoundActionResult);

  useEffect(() => {
    if (result.status !== "success" || handledRequestId.current === result.requestId) return;
    handledRequestId.current = result.requestId;
    router.refresh();
  }, [result, router]);

  return (
    <form action={formAction} className={className}>
      {children}
      {result.status !== "idle" ? (
        <div
          className={result.status === "success"
            ? "mt-3 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-ink"
            : "mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-ink"}
          role={result.status === "success" ? "status" : "alert"}
        >
          <div>{result.message}</div>
          {result.status === "unexpected" ? (
            <div className="mt-1 text-xs text-muted">รหัสอ้างอิง: {result.requestId}</div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
