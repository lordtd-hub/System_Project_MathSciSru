import { RoleDashboardNav } from "@/components/ui/RoleDashboardNav";
import { FigmaRoleShell, UiModeSwitch } from "@/components/redesign/FigmaRoleShell";
import { StudentSchedulePostSubmitGuard } from "@/components/ui/StudentSchedulePostSubmitGuard";
import { getUiMode, isFigmaUiAllowed } from "@/lib/uiMode";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const uiMode = await getUiMode();

  if (uiMode === "figma") {
    return (
      <FigmaRoleShell role="student" mode={uiMode}>
        <StudentSchedulePostSubmitGuard />
        {children}
      </FigmaRoleShell>
    );
  }

  return (
    <>
      <RoleDashboardNav role="student" />
      {isFigmaUiAllowed() ? (
        <div className="mb-4 flex justify-end">
          <UiModeSwitch mode={uiMode} />
        </div>
      ) : null}
      <StudentSchedulePostSubmitGuard />
      {children}
    </>
  );
}
