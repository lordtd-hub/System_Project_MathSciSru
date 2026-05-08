export function EmptyState({
  title,
  description,
  action,
  actionLabel,
  href
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  actionLabel?: string;
  href?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        <span className="block text-base font-semibold">△</span>
      </div>
      <div className="text-base font-semibold text-ink">{title}</div>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
      {!action && href && actionLabel ? (
        <a className="button mobile-primary-action mt-4" href={href}>
          {actionLabel}
        </a>
      ) : null}
    </div>
  );
}
