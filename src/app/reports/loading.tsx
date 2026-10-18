import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

      {/* Tabs navigation skeleton */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-44 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>

      {/* Date controls skeleton */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-9 w-44 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
        <Skeleton className="h-4 w-60 rounded" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-7 w-20 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        ))}
      </div>

      {/* Content table skeleton */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Skeleton className="h-6 w-48 rounded" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
