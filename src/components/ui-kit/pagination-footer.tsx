"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export interface PaginationFooterProps {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  pageSizeOptions?: readonly number[];
  className?: string;
  /** Whether to sync page/limit to URL params via next/navigation (default: true) */
  syncUrl?: boolean;
}

export function PaginationFooter({
  page,
  limit,
  total,
  totalPages: customTotalPages,
  isLoading = false,
  onPageChange,
  onLimitChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className,
  syncUrl = true,
}: PaginationFooterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = customTotalPages ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const [prevPage, setPrevPage] = React.useState<number>(page);
  const [pageInput, setPageInput] = React.useState<string>(String(page));

  // Adjust state during render when page prop changes (React recommended pattern)
  if (prevPage !== page) {
    setPrevPage(page);
    setPageInput(String(page));
  }

  const updateUrlParams = React.useCallback(
    (newPage: number, newLimit: number) => {
      if (!syncUrl || !router || !pathname) return;
      const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
      params.set("page", String(newPage));
      params.set("limit", String(newLimit));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [syncUrl, router, pathname, searchParams]
  );

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, newPage));
    if (clamped === page) return;
    if (onPageChange) {
      onPageChange(clamped);
    }
    updateUrlParams(clamped, limit);
  };

  const handleLimitChange = (newLimit: number) => {
    if (newLimit === limit) return;
    if (onLimitChange) {
      onLimitChange(newLimit);
    }
    // Changing limit resets page to 1
    if (onPageChange) {
      onPageChange(1);
    }
    updateUrlParams(1, newLimit);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      handlePageChange(parsed);
    } else {
      setPageInput(String(page));
    }
  };

  // Showing X to Y of Z entries
  const startRecord = total === 0 ? 0 : Math.min((page - 1) * limit + 1, total);
  const endRecord = Math.min(page * limit, total);

  // The selector is visible whenever total > 10. Nav buttons hide when totalPages <= 1.
  const showPageSizeSelect = total > 10;
  const showNavButtons = totalPages > 1;

  if (total === 0 && !showPageSizeSelect) {
    return null;
  }

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-2 py-2.5 text-xs text-muted-foreground border-t border-border/60",
        className
      )}
    >
      {/* Left side: Rows per page selector & record range */}
      <div className="flex flex-wrap items-center gap-3">
        {showPageSizeSelect && (
          <div className="flex items-center gap-1.5">
            <label htmlFor="rows-per-page-select" className="text-xs text-muted-foreground whitespace-nowrap">
              Rows per page
            </label>
            <select
              id="rows-per-page-select"
              aria-label="Rows per page"
              value={limit || DEFAULT_PAGE_SIZE}
              disabled={isLoading}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium text-foreground shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          Showing <span className="font-mono tabular-nums font-semibold text-foreground">{startRecord}</span> to{" "}
          <span className="font-mono tabular-nums font-semibold text-foreground">{endRecord}</span> of{" "}
          <span className="font-mono tabular-nums font-semibold text-foreground">{total}</span> entries
        </div>
      </div>

      {/* Right side: Navigation buttons & page input (hidden when single page) */}
      {showNavButtons && (
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {/* First page */}
          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            disabled={page <= 1 || isLoading}
            onClick={() => handlePageChange(1)}
            aria-label="First page"
            title="First page"
          >
            <ChevronsLeftIcon className="size-3.5" />
          </Button>

          {/* Previous page */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 gap-1 text-xs"
            disabled={page <= 1 || isLoading}
            onClick={() => handlePageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="size-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </Button>

          {/* Page input form */}
          <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1 px-1">
            <span className="text-muted-foreground">Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              disabled={isLoading}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => {
                const parsed = parseInt(pageInput, 10);
                if (parsed !== page && !isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
                  handlePageChange(parsed);
                } else {
                  setPageInput(String(page));
                }
              }}
              aria-label="Go to page"
              className="h-8 w-12 rounded-md border border-input bg-background px-1.5 text-center font-mono text-xs font-semibold tabular-nums text-foreground shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
            <span className="text-muted-foreground">
              of <span className="font-mono tabular-nums font-semibold text-foreground">{totalPages}</span>
            </span>
          </form>

          {/* Next page */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 gap-1 text-xs"
            disabled={page >= totalPages || isLoading}
            onClick={() => handlePageChange(page + 1)}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRightIcon className="size-3.5" />
          </Button>

          {/* Last page */}
          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            disabled={page >= totalPages || isLoading}
            onClick={() => handlePageChange(totalPages)}
            aria-label="Last page"
            title="Last page"
          >
            <ChevronsRightIcon className="size-3.5" />
          </Button>
        </div>
      )}
    </nav>
  );
}
