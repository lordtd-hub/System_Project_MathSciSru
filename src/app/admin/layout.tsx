import { RoleDashboardNav } from "@/components/ui/RoleDashboardNav";
import { FigmaRoleShell, UiModeSwitch } from "@/components/redesign/FigmaRoleShell";
import { getUiMode, isFigmaUiAllowed } from "@/lib/uiMode";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const uiMode = await getUiMode();

  if (uiMode === "figma") {
    return <FigmaRoleShell role="admin" mode={uiMode}>{children}</FigmaRoleShell>;
  }

  return (
    <>
      <RoleDashboardNav role="admin" />
      {isFigmaUiAllowed() ? (
        <div className="mb-4 flex justify-end">
          <UiModeSwitch mode={uiMode} />
        </div>
      ) : null}
      {children}
    </>
  );
}
