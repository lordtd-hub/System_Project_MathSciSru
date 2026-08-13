"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ProposalLifecycleActionResult } from "@/lib/proposals/proposalLifecycleActionResult";

const idleProposalLifecycleActionResult: ProposalLifecycleActionResult = { status: "idle" };

export type ProposalLifecycleFormAction = (
  previousState: ProposalLifecycleActionResult,
  formData: FormData
) => Promise<ProposalLifecycleActionResult>;

export function ProposalLifecycleActionForm({
  action,
  children,
  className
}: {
  action: ProposalLifecycleFormAction;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const handledRequestId = useRef<string | null>(null);
  const [result, formAction] = useActionState(action, idleProposalLifecycleActionResult);

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
            ? "rounded-md border border-success/30 bg-success/10 p-3 text-sm text-ink"
            : "rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-ink"}
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
