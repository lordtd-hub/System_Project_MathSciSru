"use client";

import { RoleErrorBoundary } from "@/components/ui/RoleErrorBoundary";

export default function TeacherError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RoleErrorBoundary {...props} dashboardHref="/teacher" />;
}
