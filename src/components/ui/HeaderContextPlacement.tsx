"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Presentation only: keep the role layout's server-selected context and guards. */
export function HeaderContextPlacement({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const slot = document.getElementById("academic-context-header");
    setHost(slot);
    const header = slot?.closest("header");
    if (!header) return;
    const updateOffset = () => document.documentElement.style.setProperty("--app-header-height", `${header.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(updateOffset);
    observer.observe(header);
    updateOffset();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--app-header-height");
    };
  }, []);

  // Keep a compact, usable server-rendered fallback when JavaScript is unavailable.
  return host ? createPortal(children, host) : children;
}
