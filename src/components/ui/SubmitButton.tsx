"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";

export const SUBMIT_AUTO_RECOVERY_DELAY_MS = 15_000;

export function SubmitButton({
  children,
  pendingText = "กำลังบันทึก...",
  className = "",
  disabled,
  confirmMessage,
  name,
  value
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
  confirmMessage?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!pending) return;

    const timer = window.setTimeout(() => window.location.reload(), SUBMIT_AUTO_RECOVERY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
