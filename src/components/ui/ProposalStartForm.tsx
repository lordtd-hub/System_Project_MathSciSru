"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  initialProposalStartActionResult,
  proposalStartActionMessage,
  type ProposalStartActionResult
} from "@/lib/scoring/proposalStartActionResult";
import { SubmitButton } from "./SubmitButton";

type ProposalStartAction = (
  previousState: ProposalStartActionResult,
  formData: FormData
) => Promise<ProposalStartActionResult>;

export function ProposalStartForm({ action, attemptId }: { action: ProposalStartAction; attemptId: string }) {
  const router = useRouter();
  const [result, formAction] = useActionState(action, initialProposalStartActionResult);
  const message = proposalStartActionMessage(result);

  useEffect(() => {
    if (result.status === "success") {
      router.push(`/teacher/scoring/${encodeURIComponent(result.assignmentId)}`);
    }
  }, [result, router]);

  return (
    <form action={formAction}>
      <input type="hidden" name="attempt_id" value={attemptId} />
      <SubmitButton pendingText="กำลังเปิดแบบประเมิน...">เริ่มประเมิน</SubmitButton>
      {message ? (
        <p className="mt-2 max-w-md text-sm font-medium text-red-700" role="alert" aria-live="polite">
          {message}
        </p>
      ) : null}
    </form>
  );
}
