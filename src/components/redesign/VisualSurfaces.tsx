import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Tone = "action" | "waiting" | "success" | "warning" | "danger" | "muted";

export function FigmaPageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="figma-page-header">
      <div>
        {eyebrow ? <p className="figma-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="figma-page-actions">{actions}</div> : null}
    </section>
  );
}

export function FigmaMetricCard({
  label,
  value,
  description,
  tone = "muted"
}: {
  label: string;
  value: ReactNode;
  description?: string;
  tone?: Tone;
}) {
  return (
    <div className="figma-metric-card" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function FigmaPanel({
  title,
  description,
  tone = "muted",
  children
}: {
  title?: string;
  description?: string;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <section className="figma-panel" data-tone={tone}>
      {title || description ? (
        <header>
          {title ? <h2>{title}</h2> : null}
          {description ? <p>{description}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function FigmaReviewLayout({ context, action }: { context: ReactNode; action: ReactNode }) {
  return (
    <div className="figma-review-layout">
      <div className="figma-review-context">{context}</div>
      <div className="figma-review-action">{action}</div>
    </div>
  );
}

export function FigmaStatusBadge({ children, tone = "muted" }: { children: ReactNode; tone?: Tone }) {
  const title = typeof children === "string" ? children : undefined;

  return (
    <span className="figma-status-badge" data-tone={tone} title={title}>
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

export function FigmaObjectSummaryList({
  children,
  className = "",
  scrollable = false,
  ...props
}: ComponentPropsWithoutRef<"div"> & { scrollable?: boolean }) {
  const classes = ["figma-object-summary-list", scrollable ? "figma-scroll-queue" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export function FigmaObjectDetail({
  children,
  density = "display",
  className = "",
  ...props
}: {
  children: ReactNode;
  density?: "display" | "form";
} & ComponentPropsWithoutRef<"section">) {
  return (
    <section className={`figma-object-detail ${className}`.trim()} data-density={density} {...props}>
      {children}
    </section>
  );
}
