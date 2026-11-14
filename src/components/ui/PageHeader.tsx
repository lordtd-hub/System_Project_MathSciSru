export function PageHeader({
  title,
  description,
  actions,
  compact = false
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`page-header${compact ? " page-header-compact" : ""}`}>
      <div className="min-w-0">
        <div className="page-kicker">ระบบจัดการโครงงาน</div>
        <div className="page-header-heading mt-2 flex gap-3">
          <span className="page-header-accent" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="page-title">{title}</h1>
            {description ? <p className="page-description">{description}</p> : null}
          </div>
        </div>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}
