"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, AlertCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface PaginationProps {
  page: number
  totalPages: number
  totalCount: number
  limit: number
  onPageChange: (page: number) => void
}

export interface DataTableShellProps {
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  isEmpty?: boolean
  emptyState?: React.ReactNode
  pagination?: PaginationProps
  skeletonRows?: number
  columnsCount?: number
  children: React.ReactNode
  mobileView?: React.ReactNode
  className?: string
}

export function DataTableShell({
  isLoading = false,
  error = null,
  onRetry,
  isEmpty = false,
  emptyState,
  pagination,
  skeletonRows = 5,
  columnsCount = 5,
  children,
  mobileView,
  className,
}: DataTableShellProps) {
  if (error) {
    return (
      <div className="flex min-h-60 flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
        <AlertCircleIcon className="size-10 text-destructive mb-3" />
        <h3 className="text-base font-semibold text-foreground">
          Unable to load data
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{error}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-4"
          >
            Try Again
          </Button>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
          <div className="p-4 space-y-3">
            <div className="flex gap-4">
              {Array.from({ length: columnsCount }).map((_, i) => (
                <Skeleton key={i} className="h-6 flex-1 rounded-md" />
              ))}
            </div>
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <div key={i} className="flex gap-4 items-center h-14 border-t border-border/40">
                {Array.from({ length: columnsCount }).map((_, j) => (
                  <Skeleton key={j} className="h-5 flex-1 rounded-md" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (isEmpty) {
    return <>{emptyState}</>
  }

  const startRecord = pagination
    ? Math.min((pagination.page - 1) * pagination.limit + 1, pagination.totalCount)
    : 0
  const endRecord = pagination
    ? Math.min(pagination.page * pagination.limit, pagination.totalCount)
    : 0

  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop view (md and up) */}
      <div className={cn("overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs", mobileView && "hidden md:block")}>
        {children}
      </div>

      {/* Mobile card view (below md) */}
      {mobileView && <div className="block md:hidden">{mobileView}</div>}

      {/* Pagination Footer */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1 py-2 text-xs text-muted-foreground">
          <div>
            Showing <span className="font-mono tabular-nums font-semibold text-foreground">{startRecord}</span> to{" "}
            <span className="font-mono tabular-nums font-semibold text-foreground">{endRecord}</span> of{" "}
            <span className="font-mono tabular-nums font-semibold text-foreground">{pagination.totalCount}</span> entries
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <ChevronLeftIcon className="size-3.5" />
              Previous
            </Button>
            <div className="px-2 text-xs">
              Page <span className="font-mono tabular-nums font-semibold text-foreground">{pagination.page}</span> of{" "}
              <span className="font-mono tabular-nums font-semibold text-foreground">{pagination.totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
              <ChevronRightIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
