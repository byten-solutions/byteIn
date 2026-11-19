"use client"

import * as React from "react"
import { PaginationFooter } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import { Skeleton } from "@/components/ui/skeleton"
import type { ShiftCollectionsReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, TableSkeleton } from "../report-section-shell"
import { ReportMetricBand, ReportRatioBar } from "../charts"

interface CollectionsSectionProps {
  date: string
  onDateChange?: (date: string) => void
  propertyId?: string
  refreshTrigger?: number
}

export function CollectionsSection({ date, propertyId, refreshTrigger }: CollectionsSectionProps) {
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
        <div className="flex items-center gap-2 py-1">
          <Skeleton className="h-4 w-28" />
          <span className="text-muted-foreground/30">·</span>
          <Skeleton className="h-4 w-24" />
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
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Curated KPI Metric Band */}
      <ReportMetricBand
        metrics={[
          {
            label: "Shift Collections",
            value: totalCollectedNum,
            isMoney: true,
            tone: "success",
            subtext: `Target Date: ${date}`,
          },
          {
            label: "Transactions",
            value: data.totalTransactions,
            subtext: "Folio receipts processed",
          },
          {
            label: "Payment Methods",
            value: data.methodBreakdown.length,
            subtext: "Active tender types",
          },
          {
            label: "Cashier Handlers",
            value: data.staffBreakdown.length,
            subtext: "Desk staff on duty",
          },
        ]}
      />

      {/* 2. Tender Methods & Cashier Breakdown Cards (Clean Semantic Tables) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tender Breakdown */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
          <h3 className="font-semibold text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Tender Methods Breakdown
          </h3>
          {data.methodBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No tenders recorded for this shift.</p>
          ) : (
            <div className="space-y-3">
              <ReportRatioBar
                segments={data.methodBreakdown.map((m) => ({
                  label: m.method,
                  value: parseFloat(m.amount) || 0,
                  count: m.count,
                }))}
                isMoney={true}
              />
              <div className="divide-y divide-border/60 pt-1">
                {data.methodBreakdown.map((m) => (
                  <div key={m.method} className="py-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{m.method}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {m.count} receipt{m.count === 1 ? "" : "s"}
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        {formatMoney(parseFloat(m.amount) || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Staff Breakdown */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
          <h3 className="font-semibold text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Frontline Cashier Handover
          </h3>
          {data.staffBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No cashier entries recorded for this shift.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {data.staffBreakdown.map((s) => (
                <div key={s.userName} className="py-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{s.userName}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {s.paymentCount} transaction{s.paymentCount === 1 ? "" : "s"}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatMoney(parseFloat(s.totalCollected) || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Paginated Transactions Table */}
      {data.transactions && data.transactions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-semibold text-foreground text-sm">Shift Transactions Log</h3>
            {data.pagination && (
              <span className="text-xs text-muted-foreground font-mono">
                Total: {data.pagination.total} transaction{data.pagination.total === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto rounded-lg border border-border/70">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
                  <tr className="border-b border-border font-medium text-muted-foreground text-[11px] font-mono uppercase tracking-wider">
                    <th className="px-3 py-2.5">Receipt / Invoice</th>
                    <th className="px-3 py-2.5">Guest Name</th>
                    <th className="px-3 py-2.5">Payment Method</th>
                    <th className="px-3 py-2.5">Cashier</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.transactions.map((t) => (
                    <tr key={t.paymentId} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono font-medium">
                        {t.receiptNumber || t.invoiceNumber}
                      </td>
                      <td className="px-3 py-2">{t.guestName}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-muted border border-border">
                          {t.paymentMethod}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{t.recordedByUserName}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(parseFloat(t.amount) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.pagination && data.pagination.total > 0 && (
              <div className="border-t border-border/80 pt-2">
                <PaginationFooter
                  page={page}
                  limit={limit}
                  total={data.pagination.total}
                  totalPages={data.pagination.totalPages}
                  onPageChange={setPage}
                  onLimitChange={setLimit}
                  pageSizeOptions={[10, 15, 25, 50, 100]}
                  syncUrl={false}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
