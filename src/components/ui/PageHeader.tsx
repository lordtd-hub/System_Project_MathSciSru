export function PageHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="min-w-0">
        <div className="page-kicker">ระบบจัดการโครงงาน</div>
        <div className="mt-2 flex gap-3">
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
