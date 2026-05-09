function LoadingRow() {
  return (
    <div className="grid gap-2 border-l-4 border-l-[var(--ink-300)] bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div>
        <div className="h-4 w-40 rounded bg-paperSoft" />
        <div className="mt-2 h-3 w-64 max-w-full rounded bg-paperSoft" />
      </div>
      <div className="h-8 w-20 rounded-md bg-paperSoft" />
    </div>
  );
}

export default function TeacherDashboardLoading() {
  return (
    <div className="space-y-4">
      <section className="page-header">
        <div>
          <div className="h-5 w-48 rounded bg-paperSoft" />
          <div className="mt-3 h-3 w-96 max-w-full rounded bg-paperSoft" />
        </div>
      </section>
      <section className="panel dashboard-console-panel">
        <div className="border-b border-line pb-2.5">
          <div className="h-4 w-44 rounded bg-paperSoft" />
          <div className="mt-2 h-3 w-72 max-w-full rounded bg-paperSoft" />
        </div>
        <div className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          <LoadingRow />
          <LoadingRow />
          <LoadingRow />
        </div>
      </section>
    </div>
  );
}
