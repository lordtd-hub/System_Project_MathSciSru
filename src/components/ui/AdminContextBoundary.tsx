"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Pinned forms show their actual DB target, without a conflicting cookie context above it. */
export function AdminContextBoundary({ children }: { children: ReactNode }) {
  const path = usePathname();
  return ["/admin/i-score-entry", "/admin/term-results"].includes(path) ? null : children;
}
