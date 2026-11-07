"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { PaginationFooter } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { ReceivablesReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, TableSkeleton } from "../report-section-shell"

interface ReceivablesSectionProps {
  propertyId?: string
  refreshTrigger?: number
}

export function ReceivablesSection({ propertyId, refreshTrigger }: ReceivablesSectionProps) {
  const [filter, setFilter] = React.useState<"all" | "in_house" | "departed">("all")
  const [page, setPage] = React.useState<number>(1)
  const [limit, setLimit] = React.useState<number>(25)

  const { data, isLoading, error, refetch } = useReportQuery<ReceivablesReportDTO>({
    endpoint: "/api/reports/receivables",
    params: {
      filter,
      page,
      limit,
      propertyId,
    },
    enabled: true,
    refreshTrigger,
  })

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 py-1">
          <Skeleton className="h-4 w-32" />
          <span className="text-muted-foreground/30">·</span>
          <Skeleton className="h-4 w-24" />
          <span className="text-muted-foreground/30">·</span>
          <Skeleton className="h-4 w-24" />
        </div>
        <TableSkeleton rows={5} cols={8} />
      </div>
    )
  }

  if (error && !data) {
    return (
      <ReportSectionError
        title="Failed to load outstanding receivables"
        error={error}
        onRetry={refetch}
      />
    )
  }

  if (!data) return null

  const items = data.items || []
  const b0to7 = Math.max(0, parseFloat(data.agingSummary.bucket0to7) || 0)
  const b8to30 = Math.max(0, parseFloat(data.agingSummary.bucket8to30) || 0)
  const b31to60 = Math.max(0, parseFloat(data.agingSummary.bucket31to60) || 0)
  const b60Plus = Math.max(0, parseFloat(data.agingSummary.bucket60Plus) || 0)
  const totalAging = b0to7 + b8to30 + b31to60 + b60Plus

  return (
    <div className="space-y-5">
      {/* Inline Stat Summary Row */}
      <div className="flex flex-wrap items-center gap-x-2 text-xs sm:text-sm text-muted-foreground">
        <span>
          <strong className="font-bold font-mono text-foreground tabular-nums">
            {formatMoney(parseFloat(data.totalReceivables) || 0)}
          </strong>{" "}
          total ({data.totalInvoices} {data.totalInvoices === 1 ? "folio" : "folios"})
        </span>
        <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
        <span>
          <strong className="font-bold font-mono text-foreground tabular-nums">
            {formatMoney(parseFloat(data.inHouseReceivables) || 0)}
          </strong>{" "}
          in-house ({data.inHouseCount})
        </span>
        <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
        <span>
          <strong className="font-bold font-mono text-foreground tabular-nums">
            {formatMoney(parseFloat(data.departedReceivables) || 0)}
          </strong>{" "}
          departed ({data.departedCount})
        </span>
      </div>

      {/* Card 1: Aging Distribution & Summary */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="font-semibold text-foreground">Folio Aging Distribution</h3>
          <span className="font-mono text-xs text-muted-foreground">
            Total: {formatMoney(totalAging)}
          </span>
        </div>

        {/* Aging Distribution Horizontal Stacked Bar */}
        <div className="space-y-1.5 pb-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Aging Spread</span>
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {formatMoney(totalAging)} across all aging buckets
            </span>
          </div>
          <div className="h-3 w-full rounded-md bg-muted/60 flex overflow-hidden gap-0.5 p-0.5">
            {totalAging === 0 ? (
              <div className="h-full w-full bg-muted/80 rounded-xs" />
            ) : (
              <>
                {b0to7 > 0 && (
                  <div
                    className="h-full bg-emerald-500 rounded-xs transition-all"
                    style={{ width: `${(b0to7 / totalAging) * 100}%` }}
                    title={`0-7 Days: ${((b0to7 / totalAging) * 100).toFixed(1)}% (${formatMoney(b0to7)})`}
                  />
                )}
                {b8to30 > 0 && (
                  <div
                    className="h-full bg-sky-500 rounded-xs transition-all"
                    style={{ width: `${(b8to30 / totalAging) * 100}%` }}
                    title={`8-30 Days: ${((b8to30 / totalAging) * 100).toFixed(1)}% (${formatMoney(b8to30)})`}
                  />
                )}
                {b31to60 > 0 && (
                  <div
                    className="h-full bg-amber-500 rounded-xs transition-all"
                    style={{ width: `${(b31to60 / totalAging) * 100}%` }}
                    title={`31-60 Days: ${((b31to60 / totalAging) * 100).toFixed(1)}% (${formatMoney(b31to60)})`}
                  />
                )}
                {b60Plus > 0 && (
                  <div
                    className="h-full bg-rose-500 rounded-xs transition-all"
                    style={{ width: `${(b60Plus / totalAging) * 100}%` }}
                    title={`60+ Days: ${((b60Plus / totalAging) * 100).toFixed(1)}% (${formatMoney(b60Plus)})`}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Aging Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/30 border border-border/50 p-2.5 text-center space-y-0.5">
            <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
              <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
              0 - 7 Days (Current)
            </div>
            <div className="text-sm font-semibold text-foreground font-mono tabular-nums">
              {formatMoney(b0to7)}
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 border border-border/50 p-2.5 text-center space-y-0.5">
            <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
              <span className="size-2 rounded-full bg-sky-500 shrink-0" />
              8 - 30 Days
            </div>
            <div className="text-sm font-semibold text-foreground font-mono tabular-nums">
              {formatMoney(b8to30)}
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 border border-border/50 p-2.5 text-center space-y-0.5">
            <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
              <span className="size-2 rounded-full bg-amber-500 shrink-0" />
              31 - 60 Days
            </div>
            <div className="text-sm font-semibold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
              {formatMoney(b31to60)}
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 border border-border/50 p-2.5 text-center space-y-0.5">
            <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
              <span className="size-2 rounded-full bg-rose-500 shrink-0" />
              60+ Days (Delinquent)
            </div>
            <div className="text-sm font-semibold text-rose-600 dark:text-rose-400 font-mono tabular-nums">
              {formatMoney(b60Plus)}
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Receivables Ledger Table */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <h3 className="font-semibold text-foreground">Outstanding Folios</h3>

          {/* Filter Tabs — Secondary Segmented Pill Style */}
          <div className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => {
                setFilter("all")
                setPage(1)
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                filter === "all"
                  ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({data.totalInvoices})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilter("in_house")
                setPage(1)
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                filter === "in_house"
                  ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              In-House ({data.inHouseCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilter("departed")
                setPage(1)
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                filter === "departed"
                  ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Departed ({data.departedCount})
            </button>
          </div>
        </div>

        {/* Receivables Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground text-[11px] font-mono uppercase tracking-wider">
                <th className="px-3 py-1.5">Invoice / Res No</th>
                <th className="px-3 py-1.5">Guest Name & Phone</th>
                <th className="px-3 py-1.5">Rooms</th>
                <th className="px-3 py-1.5">Guest Status</th>
                <th className="px-3 py-1.5">Aging</th>
                <th className="px-3 py-1.5">Grand Total</th>
                <th className="px-3 py-1.5">Balance Due</th>
                <th className="px-3 py-1.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    No outstanding balances in this view.
                  </td>
                </tr>
              ) : (
                items.map((rec) => (
                  <tr key={rec.invoiceId} className="hover:bg-muted/20">
                    <td className="px-3 py-1.5">
                      <div className="font-mono font-medium leading-tight">{rec.invoiceNumber}</div>
                      <div className="text-[11px] text-muted-foreground leading-tight">{rec.reservationNo}</div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="font-medium text-foreground leading-tight">{rec.guestName}</div>
                      <div className="text-[11px] text-muted-foreground leading-tight">{rec.guestPhone || "No phone"}</div>
                    </td>
                    <td className="px-3 py-1.5 font-medium">
                      {rec.roomNumbers.join(", ") || "N/A"}
                    </td>
                    <td className="px-3 py-1.5">
                      {rec.isGuestInHouse ? (
                        <span className="inline-flex rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                          In-House
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                          Departed
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={cn(
                          "font-medium",
                          rec.daysAging > 30 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                        )}
                      >
                        {rec.daysAging} days ({rec.agingBucket})
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono tabular-nums">{formatMoney(parseFloat(rec.grandTotal) || 0)}</td>
                    <td className="px-3 py-1.5 font-semibold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                      {formatMoney(parseFloat(rec.balanceDue) || 0)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Link
                        href={`/billing/${rec.invoiceId}`}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <span>Folio</span>
                        <ChevronRight className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data.pagination && data.pagination.total > 10 && (
          <PaginationFooter
            page={page}
            limit={limit}
            total={data.pagination.total}
            onPageChange={setPage}
            onLimitChange={(newLimit) => {
              setLimit(newLimit)
              setPage(1)
            }}
          />
        )}
      </div>
    </div>
  )
}
