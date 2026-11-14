"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Native disclosure semantics: Tab navigation, Enter/Space, plus Escape to return focus. */
export function CompactDisclosure({ label, children, className = "", panelClassName = "" }: {
  label: string; children: ReactNode; className?: string; panelClassName?: string;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const pathname = usePathname();
  useEffect(() => { if (details.current) details.current.open = false; }, [pathname]);
  useEffect(() => {
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && details.current?.open && !details.current.contains(event.target)) details.current.open = false;
    }
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, []);

  return <details ref={details} className={`compact-disclosure ${className}`} onBlur={event => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
  }} onKeyDown={event => {
    if (event.key === "Escape" && details.current?.open) {
      event.preventDefault();
      event.stopPropagation();
      details.current.open = false;
      summary.current?.focus();
    }
  }}>
    <summary ref={summary} className="compact-disclosure-trigger">
      {label}<span className="compact-disclosure-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div className={`compact-disclosure-panel ${panelClassName}`}>{children}</div>
  </details>;
}
