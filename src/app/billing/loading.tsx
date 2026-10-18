import { Skeleton } from "@/components/ui/skeleton"

export default function BillingLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10 space-y-8">
      {/* Page Header skeleton */}
      <div className="space-y-1.5">
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="h-4 w-80 rounded-md" />
      </div>

      {/* Slim Summary Strip skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/80 bg-card p-4 px-5 shadow-2xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-5 w-24 rounded" />
        </div>
      </div>

      {/* Toolbar: Search + Status filter tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full max-w-sm rounded-md" />
        <Skeleton className="h-9 w-80 rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <div className="p-4 space-y-3">
          {/* Table header */}
          <div className="flex items-center gap-4 pb-2 border-b border-border/40">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-5 w-20 rounded ml-auto" />
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>

          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 h-16 border-t border-border/40 pt-1"
            >
              <div className="space-y-1.5 w-28">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-3 w-14 rounded" />
              </div>
              <Skeleton className="h-4 w-20 rounded" />
              <div className="space-y-1.5 w-36">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-4 w-20 rounded ml-auto" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
