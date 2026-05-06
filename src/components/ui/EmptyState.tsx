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
    <div className="rounded-lg border border-dashed border-line bg-paper p-6 text-center">
      <div className="text-base font-semibold text-ink">{title}</div>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
      {!action && href && actionLabel ? (
        <a className="button mt-4" href={href}>
          {actionLabel}
        </a>
      ) : null}
    </div>
  );
}
