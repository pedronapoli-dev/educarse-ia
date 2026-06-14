export const DashboardSkeleton = () => (
  <div aria-hidden="true" className="animate-pulse">
    {/* Stats */}
    <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
      {[0, 1, 2].map(i => (
        <div key={i} className="card px-4 py-5 sm:p-6">
          <div className="h-3 w-24 rounded bg-surface-muted" />
          <div className="mt-3 h-7 w-16 rounded bg-surface-muted" />
        </div>
      ))}
    </dl>

    {/* Plans list */}
    <div className="card">
      <ul role="list" className="divide-y divide-border">
        {[0, 1, 2].map(i => (
          <li key={i} className="px-5 py-4">
            <div className="flex items-center justify-between gap-x-6">
              <div className="min-w-0 flex-1">
                <div className="h-4 w-16 rounded-full bg-surface-muted" />
                <div className="mt-2 h-4 w-48 rounded bg-surface-muted" />
                <div className="mt-1.5 h-3 w-28 rounded bg-surface-muted" />
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-surface-muted" />
              </div>
              <div className="hidden sm:block h-3 w-16 flex-shrink-0 rounded bg-surface-muted" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  </div>
)
