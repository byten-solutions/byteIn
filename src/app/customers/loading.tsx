import { Skeleton } from "@/components/ui/skeleton"

export default function CustomersLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10 space-y-6">
      {/* Page Header skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg shrink-0" />
      </div>

      {/* Toolbar: Search input + Filter tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full max-w-sm rounded-md" />
        <Skeleton className="h-9 w-72 rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <div className="p-4 space-y-3">
          {/* Table header */}
          <div className="flex items-center gap-4 pb-2 border-b border-border/40">
            <Skeleton className="h-5 w-36 rounded" />
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-5 w-20 rounded ml-auto" />
          </div>

          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 h-16 border-t border-border/40 pt-1"
            >
              <div className="flex items-center gap-3 w-48">
                <Skeleton className="size-9 rounded-full shrink-0" />
                <div className="space-y-1.5 min-w-0 flex-1">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              </div>
              <div className="space-y-1.5 w-44">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-3 w-36 rounded" />
              </div>
              <Skeleton className="h-4 w-24 rounded" />
              <div className="space-y-1.5 w-28">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
              <div className="ml-auto flex items-center gap-2">
                <Skeleton className="h-8 w-24 rounded-md" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
