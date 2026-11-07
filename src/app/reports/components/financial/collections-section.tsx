"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PaginationFooter } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { ShiftCollectionsReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, TableSkeleton } from "../report-section-shell"

const METHOD_COLORS: Record<string, string> = {
  UPI: "bg-emerald-500",
  CASH: "bg-amber-500",
  CARD: "bg-sky-500",
  CREDIT_CARD: "bg-sky-500",
  DEBIT_CARD: "bg-sky-400",
  BANK_TRANSFER: "bg-purple-500",
  CHEQUE: "bg-stone-500",
  OTHER: "bg-stone-400",
}

const FALLBACK_COLORS = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-stone-500",
  "bg-indigo-500",
]

interface CollectionsSectionProps {
  date: string
  onDateChange?: (date: string) => void
  propertyId?: string
  refreshTrigger?: number
}

export function CollectionsSection({ date, onDateChange, propertyId, refreshTrigger }: CollectionsSectionProps) {
  const [page, setPage] = React.useState<number>(1)
  const [limit, setLimit] = React.useState<number>(25)

  const { data, isLoading, error, refetch } = useReportQuery<ShiftCollectionsReportDTO>({
    endpoint: "/api/reports/collections",
    params: {
      date,
      propertyId,
      page,
      limit,
    },
    enabled: true,
    refreshTrigger,
  })

  if (isLoading && !data) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28" />
            <span className="text-muted-foreground/30">·</span>
            <Skeleton className="h-4 w-24" />
            <span className="text-muted-foreground/30">·</span>
            <Skeleton className="h-4 w-20" />
            <span className="text-muted-foreground/30">·</span>
            <Skeleton className="h-4 w-20" />
          </div>
          {onDateChange && (
            <div className="flex items-center gap-2 print:hidden shrink-0">
              <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Date:</span>
              <Input
                type="date"
                aria-label="Reconciliation Date"
                value={date}
                disabled
                className="h-8 w-36 text-xs bg-background"
              />
              <Button variant="outline" size="sm" disabled className="h-8 text-xs px-2.5">
                Today
              </Button>
            </div>
          )}
        </div>
        <TableSkeleton rows={4} cols={3} />
      </div>
    )
  }

  if (error && !data) {
    return (
      <ReportSectionError
        title="Failed to load shift collections"
        error={error}
        onRetry={refetch}
      />
    )
  }

  if (!data) return null

  const totalCollectedNum = parseFloat(data.totalCollected) || 0

  return (
    <div className="space-y-5">
      {/* Combined Date Picker & Inline Stat Summary Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-1">
        <div className="flex flex-wrap items-center gap-x-2 text-xs sm:text-sm text-muted-foreground">
          <span>
            <strong className="font-bold font-mono text-foreground tabular-nums">
              {formatMoney(totalCollectedNum)}
            </strong>{" "}
            collected
          </span>
          <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
          <span>
            <strong className="font-bold font-mono text-foreground tabular-nums">
              {data.totalTransactions}
            </strong>{" "}
            {data.totalTransactions === 1 ? "transaction" : "transactions"}
          </span>
          <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
          <span>
            <strong className="font-bold font-mono text-foreground tabular-nums">
              {data.methodBreakdown.length}
            </strong>{" "}
            {data.methodBreakdown.length === 1 ? "method" : "methods"}
          </span>
          <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
          <span>
            <strong className="font-bold font-mono text-foreground tabular-nums">
              {data.staffBreakdown.length}
            </strong>{" "}
            {data.staffBreakdown.length === 1 ? "handler" : "handlers"}
          </span>
        </div>

        {onDateChange && (
          <div className="flex items-center gap-2 print:hidden shrink-0">
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Date:</span>
            <Input
              type="date"
              aria-label="Reconciliation Date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="h-8 w-36 text-xs bg-background"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2.5"
              onClick={() => {
                const today = new Date().toISOString().split("T")[0]!
                onDateChange(today)
              }}
            >
              Today
            </Button>
          </div>
        )}
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By Payment Method */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-semibold text-foreground">Shift Collections by Method</h3>
            <span className="text-xs text-muted-foreground font-mono">
              Total: {formatMoney(totalCollectedNum)}
            </span>
          </div>

          {data.methodBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No payments recorded for this shift date.
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Payment Method Split Stacked Bar */}
              <div className="space-y-1.5 pb-1">
                <div className="h-3 w-full rounded-md bg-muted/60 flex overflow-hidden gap-0.5 p-0.5">
                  {data.methodBreakdown.map((pm, idx) => {
                    const color =
                      METHOD_COLORS[pm.method.toUpperCase()] ||
                      FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
                    if (pm.percentage <= 0) return null
                    return (
                      <div
                        key={pm.method}
                        className={cn("h-full rounded-xs transition-all", color)}
                        style={{ width: `${Math.max(1, pm.percentage)}%` }}
                        title={`${pm.method}: ${pm.percentage.toFixed(1)}% (${formatMoney(parseFloat(pm.amount))})`}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Text / Itemized Breakdown */}
              <div className="space-y-3">
                {data.methodBreakdown.map((pm, idx) => {
                  const color =
                    METHOD_COLORS[pm.method.toUpperCase()] ||
                    FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
                  return (
                    <div key={pm.method} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="flex items-center gap-1.5">
                          <span className={cn("size-2 rounded-full shrink-0", color)} />
                          {pm.method} ({pm.count})
                        </span>
                        <span className="font-mono tabular-nums">{formatMoney(parseFloat(pm.amount))}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", color)}
                          style={{ width: `${Math.min(100, pm.percentage)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* By Front Desk Staff */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-semibold text-foreground">Collections by Staff User</h3>
            <span className="text-xs text-muted-foreground">Shift Accountability</span>
          </div>

          {data.staffBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No staff payment entries recorded on {date}.
            </div>
          ) : (
            <div className="space-y-3">
              {data.staffBreakdown.map((staff) => (
                <div
                  key={staff.userId}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3"
                >
                  <div>
                    <div className="font-medium text-foreground">{staff.userName}</div>
                    <div className="text-xs text-muted-foreground">
                      {staff.paymentCount} payments • {staff.userEmail}
                    </div>
                  </div>
                  <div className="text-right font-semibold text-foreground">
                    {formatMoney(parseFloat(staff.totalCollected))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Paginated Transactions Table */}
      {data.transactions && data.transactions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-semibold text-foreground">Shift Transactions Log</h3>
            {data.pagination && (
              <span className="text-xs text-muted-foreground">
                Total: {data.pagination.total} transaction{data.pagination.total === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground text-[11px] font-mono uppercase tracking-wider">
                  <th className="px-3 py-1.5">Receipt / Invoice</th>
                  <th className="px-3 py-1.5">Guest Name</th>
                  <th className="px-3 py-1.5">Method</th>
                  <th className="px-3 py-1.5">Staff</th>
                  <th className="px-3 py-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.transactions.map((tx) => (
                  <tr key={tx.paymentId} className="hover:bg-muted/20">
                    <td className="px-3 py-1.5">
                      <div className="font-mono font-medium leading-tight">{tx.receiptNumber}</div>
                      <div className="text-[11px] text-muted-foreground leading-tight">{tx.invoiceNumber}</div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="font-medium text-foreground leading-tight">{tx.guestName}</div>
                      {tx.roomNumbers.length > 0 && (
                        <div className="text-[11px] text-muted-foreground leading-tight">
                          Room {tx.roomNumbers.join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium font-mono">
                        {tx.paymentMethod}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {tx.recordedByUserName}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatMoney(parseFloat(tx.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
      )}
    </div>
  )
}
