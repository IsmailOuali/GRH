/** Shared pulsing skeleton used by every route's loading.tsx. */
export function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex items-center gap-3">
        <div className="size-11 rounded-xl bg-slate-200" />
        <div className="space-y-2">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="h-3 w-56 rounded bg-slate-100" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 h-3 w-24 rounded bg-slate-200" />
            <div className="h-6 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
