import { Skeleton } from "@/components/ui/skeleton";

export default function RoomsLoading() {
  return (
    <div className="container mx-auto max-w-6xl px-6 py-8 lg:px-10 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Status chips skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full shrink-0" />
        ))}
      </div>

      {/* Filter toolbar skeleton */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Skeleton className="h-9 w-64 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      {/* Section header skeleton */}
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-4 w-40 rounded-md" />
        <div className="h-px bg-border/60 flex-1" />
        <Skeleton className="h-4 w-16 rounded-md" />
      </div>

      {/* Rooms card grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-lg border border-border/80 bg-card p-3 shadow-2xs h-32"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-12 rounded" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
              <Skeleton className="h-3 w-20 rounded" />
              <div className="flex items-center gap-2 pt-1">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-3 w-14 rounded" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <Skeleton className="h-3 w-6 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
