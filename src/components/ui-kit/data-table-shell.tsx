"use client"

import * as React from "react"
import { AlertCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { PaginationFooter } from "./pagination-footer"

export interface PaginationProps {
  page: number
  totalPages: number
  totalCount: number
  limit: number
  onPageChange: (page: number) => void
  onLimitChange?: (limit: number) => void
  pageSizeOptions?: readonly number[]
  syncUrl?: boolean
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

  if (isLoading && isEmpty) {
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

  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop view (md and up) */}
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs relative transition-opacity duration-200",
          isLoading && "opacity-60 pointer-events-none",
          mobileView && "hidden md:block"
        )}
      >
        {isLoading && (
          <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/20 overflow-hidden z-10">
            <div className="h-full w-1/3 bg-primary animate-pulse" />
          </div>
        )}
        {children}
      </div>

      {/* Mobile card view (below md) */}
      {mobileView && (
        <div
          className={cn(
            "block md:hidden transition-opacity duration-200",
            isLoading && "opacity-60 pointer-events-none"
          )}
        >
          {mobileView}
        </div>
      )}

      {/* Pagination Footer */}
      {pagination && (
        <PaginationFooter
          page={pagination.page}
          limit={pagination.limit}
          total={pagination.totalCount}
          totalPages={pagination.totalPages}
          isLoading={isLoading}
          onPageChange={pagination.onPageChange}
          onLimitChange={pagination.onLimitChange}
          pageSizeOptions={pagination.pageSizeOptions}
          syncUrl={pagination.syncUrl ?? true}
          className="border-t-0 px-1 pt-2"
        />
      )}
    </div>
  )
}
