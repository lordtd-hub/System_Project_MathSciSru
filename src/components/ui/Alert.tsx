type AlertTone = "info" | "warning" | "success" | "danger";

const toneClass: Record<AlertTone, string> = {
  info: "alert-info",
  warning: "alert-warning",
  success: "alert-success",
  danger: "alert-danger"
};

const accentClass: Record<AlertTone, string> = {
  info: "",
  warning: "",
  success: "",
  danger: ""
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
    <div className={`app-alert border-l-4 ${toneClass[tone]} ${accentClass[tone]}`} role={tone === "danger" || tone === "warning" ? "alert" : "status"}>
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
