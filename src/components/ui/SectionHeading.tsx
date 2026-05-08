export function SectionHeading({
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
    <div className={`section-heading ${compact ? "section-heading-compact" : ""}`}>
      <span className="section-heading-accent" aria-hidden="true" />
      <div className="min-w-0">
        <h2 className="section-heading-title">{title}</h2>
        {description ? <p className="section-heading-description">{description}</p> : null}
      </div>
      {actions ? <div className="section-heading-actions">{actions}</div> : null}
    </div>
  );
}
