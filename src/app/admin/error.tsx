"use client";

import { RoleErrorBoundary } from "@/components/ui/RoleErrorBoundary";

export default function AdminError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RoleErrorBoundary {...props} dashboardHref="/admin" />;
}
