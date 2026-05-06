type AlertTone = "info" | "warning" | "success" | "danger";

const toneClass: Record<AlertTone, string> = {
  info: "border-slate-200 bg-slate-50 text-slate-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  danger: "border-red-200 bg-red-50 text-red-900"
};

export function Alert({
  tone = "info",
  title,
  children
}: {
  tone?: AlertTone;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClass[tone]}`} role={tone === "danger" || tone === "warning" ? "alert" : "status"}>
      <div className="font-semibold">{title}</div>
      {children ? <div className="mt-1 text-sm leading-6">{children}</div> : null}
    </div>
  );
}

export function InfoAlert(props: Omit<React.ComponentProps<typeof Alert>, "tone">) {
  return <Alert tone="info" {...props} />;
}

export function WarningAlert(props: Omit<React.ComponentProps<typeof Alert>, "tone">) {
  return <Alert tone="warning" {...props} />;
}

export function SuccessAlert(props: Omit<React.ComponentProps<typeof Alert>, "tone">) {
  return <Alert tone="success" {...props} />;
}
