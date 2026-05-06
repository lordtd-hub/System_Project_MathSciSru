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
    <div className="rounded-lg border border-dashed border-line bg-paperSoft p-6 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-brand/20 bg-red-50 text-lg font-semibold text-brand" aria-hidden="true">
        -
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
