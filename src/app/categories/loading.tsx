import { Skeleton } from "@/components/ui/skeleton"

export default function CategoriesLoading() {
  return (
    <div className="container mx-auto max-w-6xl px-6 py-8 lg:px-10 space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg shrink-0" />
      </div>

      {/* Toolbar skeleton */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Skeleton className="h-9 w-full max-w-sm rounded-md" />
      </div>

      {/* Categories Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs"
          >
            <div className="flex items-start justify-between gap-2.5">
              <Skeleton className="h-5 w-36 rounded" />
              <div className="flex items-center gap-1.5 shrink-0">
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-6 w-6 rounded-md" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2.5 border border-border/50">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-18 rounded" />
                <Skeleton className="h-5 w-14 rounded" />
              </div>
            </div>

            <div className="space-y-1.5 pt-0.5">
              <Skeleton className="h-3 w-14 rounded" />
              <div className="flex flex-wrap gap-1">
                <Skeleton className="h-4 w-14 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
              </div>
            </div>

            <div className="pt-2 border-t border-border/50 flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
