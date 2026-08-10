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
          return;
        }

        const form = event.currentTarget.form;
        if (!form) return;

        event.preventDefault();
        if (!form.noValidate && !form.reportValidity()) return;

        const button = event.currentTarget;
        const originalText = button.textContent;
        let recoveryTimer: number | null = null;
        const restoreButton = () => {
          if (recoveryTimer !== null) window.clearTimeout(recoveryTimer);
          button.disabled = Boolean(disabled);
          button.setAttribute("aria-disabled", String(Boolean(disabled)));
          button.textContent = originalText;
        };

        let submitterInput: HTMLInputElement | null = null;
        if (name) {
          submitterInput = document.createElement("input");
          submitterInput.type = "hidden";
          submitterInput.name = name;
          submitterInput.value = value ?? "";
          form.appendChild(submitterInput);
        }

        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
        button.textContent = pendingText;
        window.addEventListener("pageshow", restoreButton, { once: true });
        recoveryTimer = window.setTimeout(
          () => window.location.replace(window.location.href),
          SUBMIT_AUTO_RECOVERY_DELAY_MS
        );

        try {
          // A native POST avoids the intermittent App Router transition stall
          // while preserving the existing Server Action and 303 redirect.
          HTMLFormElement.prototype.submit.call(form);
        } catch (error) {
          window.removeEventListener("pageshow", restoreButton);
          submitterInput?.remove();
          restoreButton();
          throw error;
        }
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
