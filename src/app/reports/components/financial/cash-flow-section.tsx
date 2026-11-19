"use client"

import * as React from "react"
import { formatMoney } from "@/lib/currency"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { CashFlowReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, TableSkeleton } from "../report-section-shell"
import { ReportMetricBand, ReportTrendChart } from "../charts"
import { PaginationFooter } from "@/components/ui-kit/pagination-footer"

interface CashFlowSectionProps {
  startDate: string
  endDate: string
  propertyId?: string
  refreshTrigger?: number
}

export function CashFlowSection({
  startDate,
  endDate,
  propertyId,
  refreshTrigger,
}: CashFlowSectionProps) {
  const { data, isLoading, error, refetch } = useReportQuery<CashFlowReportDTO>({
    endpoint: "/api/reports/cash-flow",
    params: {
      startDate,
      endDate,
      propertyId,
    },
    enabled: true,
    refreshTrigger,
  })

  const [page, setPage] = React.useState(1)
  const [limit, setLimit] = React.useState(15)

  const dailyRows = React.useMemo(() => data?.dailyBreakdown || [], [data?.dailyBreakdown])
  const totalPages = Math.max(1, Math.ceil(dailyRows.length / limit))
  const currentPage = Math.min(page, totalPages)
  const paginatedRows = React.useMemo(() => {
    const start = (currentPage - 1) * limit
    return dailyRows.slice(start, start + limit)
  }, [dailyRows, currentPage, limit])

  if (isLoading && !data) {
    return (
      <div className="space-y-4 sm:space-y-5">
        <div className="flex items-center gap-2 py-1">
          <Skeleton className="h-4 w-28" />
          <span className="text-muted-foreground/30">·</span>
          <Skeleton className="h-4 w-24" />
        </div>
        <TableSkeleton rows={6} cols={4} />
      </div>
    )
  }

  if (error && !data) {
    return (
      <ReportSectionError
        title="Failed to load cash flow and financial performance"
        error={error}
        onRetry={refetch}
      />
    )
  }

  if (!data) return null

  const totalInflowsNum = parseFloat(data.totalInflows) || 0
  const totalOutflowsNum = parseFloat(data.totalOutflows) || 0
  const netCashNum = parseFloat(data.netCashFlow) || 0
  const daysCount = Math.max(1, data.dailyBreakdown.length)
  const avgDailyInflow = totalInflowsNum / daysCount

  // Transform daily breakdown for the trend chart
  const trendData = data.dailyBreakdown.map((d) => ({
    date: d.date,
    value: parseFloat(d.inflows) || 0,
    secondaryValue: parseFloat(d.outflows) || 0,
  }))

  // Find peak inflow and outflow days
  let peakInflowDay = data.dailyBreakdown[0]
  let peakOutflowDay = data.dailyBreakdown[0]
  for (const d of data.dailyBreakdown) {
    if (parseFloat(d.inflows) > parseFloat(peakInflowDay?.inflows || "0")) {
      peakInflowDay = d
    }
    if (parseFloat(d.outflows) > parseFloat(peakOutflowDay?.outflows || "0")) {
      peakOutflowDay = d
    }
  }

  // Top outflow category
  const topOutflowCategory = [...data.outflowCategories].sort(
    (a, b) => parseFloat(b.amount) - parseFloat(a.amount)
  )[0]

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Curated KPI Metric Band */}
      <ReportMetricBand
        metrics={[
          {
            label: "Total Cash Inflows",
            value: totalInflowsNum,
            isMoney: true,
            tone: "success",
            subtext: `${data.receiptCount} receipts processed`,
          },
          {
            label: "Operating Outflows",
            value: totalOutflowsNum,
            isMoney: true,
            tone: "danger",
            subtext: `${data.paymentCount} payments disbursed`,
          },
          {
            label: "Net Cash Position",
            value: netCashNum,
            isMoney: true,
            tone: netCashNum >= 0 ? "success" : "danger",
            subtext: netCashNum >= 0 ? "Net liquidity surplus" : "Net operating cash deficit",
          },
          {
            label: "Daily Cash Velocity",
            value: avgDailyInflow,
            isMoney: true,
            subtext: `Avg inflow over ${daysCount} days`,
          },
        ]}
      />

      {/* 2. One Single Visual Graph: Cash Inflows vs Operating Outflows Trajectory */}
      <ReportTrendChart
        title="Cash Velocity & Daily Trajectory"
        subtitle="Chronological comparison of daily cash receipts collected against operating expenses disbursed."
        data={trendData}
        series1Name="Cash Inflows"
        series1Color="#10b981"
        series1IsMoney={true}
        series2Name="Operating Outflows"
        series2Color="#f43f5e"
        series2IsMoney={true}
        height={220}
      />

      {/* 3. Textual Representation: Executive Financial Briefing */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <h3 className="font-semibold text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Executive Financial Briefing
          </h3>
          <span className="text-xs font-mono text-muted-foreground">
            Period: <span className="text-foreground font-semibold">{startDate}</span> to{" "}
            <span className="text-foreground font-semibold">{endDate}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs leading-relaxed text-muted-foreground">
          <div className="rounded-lg bg-muted/30 p-3 border border-border/40 space-y-1">
            <span className="font-semibold text-foreground block">Liquidity & Margin</span>
            <p>
              During this {daysCount}-day cycle, total gross cash collections reached{" "}
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {formatMoney(totalInflowsNum)}
              </span>{" "}
              against total disbursements of{" "}
              <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                {formatMoney(totalOutflowsNum)}
              </span>
              . Net liquid result is{" "}
              <span
                className={cn(
                  "font-mono font-bold",
                  netCashNum >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                )}
              >
                {netCashNum >= 0 ? `+${formatMoney(netCashNum)}` : formatMoney(netCashNum)}
              </span>
              .
            </p>
          </div>

          <div className="rounded-lg bg-muted/30 p-3 border border-border/40 space-y-1">
            <span className="font-semibold text-foreground block">Volume & Velocity Peaks</span>
            <p>
              Peak cash intake was logged on{" "}
              <span className="font-semibold text-foreground">{peakInflowDay?.date || "—"}</span> with{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatMoney(parseFloat(peakInflowDay?.inflows || "0"))}
              </span>
              . The largest expense disbursement fell on{" "}
              <span className="font-semibold text-foreground">{peakOutflowDay?.date || "—"}</span> with{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatMoney(parseFloat(peakOutflowDay?.outflows || "0"))}
              </span>
              .
            </p>
          </div>

          <div className="rounded-lg bg-muted/30 p-3 border border-border/40 space-y-1">
            <span className="font-semibold text-foreground block">Cost Drivers</span>
            <p>
              Primary operating outflow was{" "}
              <span className="font-semibold text-foreground">
                {topOutflowCategory ? topOutflowCategory.categoryName : "Operating Expenses"}
              </span>{" "}
              commanding{" "}
              <span className="font-mono font-semibold text-foreground">
                {topOutflowCategory ? formatMoney(parseFloat(topOutflowCategory.amount)) : "₹0.00"}
              </span>{" "}
              ({topOutflowCategory ? `${topOutflowCategory.percentage}%` : "0%"} of all disbursements).
            </p>
          </div>
        </div>
      </div>

      {/* 4. Textual Ledgers: Inflow Sources & Outflow Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Inflow Sources Ledger */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h3 className="font-semibold text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Inflow Sources (Receipts)
            </h3>
            <span className="font-mono text-xs font-semibold text-foreground">
              {formatMoney(totalInflowsNum)}
            </span>
          </div>

          {data.inflowSources.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No receipts recorded in this window.</p>
          ) : (
            <div className="space-y-2.5">
              {data.inflowSources.map((src) => {
                const label = src.source === "GUEST_INVOICE" ? "Guest Folio Invoices" : "Direct Income"
                const amt = parseFloat(src.amount) || 0
                return (
                  <div key={src.source} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground text-[11px]">
                          {src.count} receipt{src.count === 1 ? "" : "s"}
                        </span>
                        <span className="font-mono font-semibold text-foreground">{formatMoney(amt)}</span>
                        <span className="font-mono text-[11px] text-muted-foreground w-11 text-right">
                          {src.percentage}%
                        </span>
                      </div>
                    </div>
                    {/* Visual Distribution Mini Bar */}
                    <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.max(2, src.percentage)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Outflow Categories Ledger */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h3 className="font-semibold text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Outflow Categories (Expense Heads)
            </h3>
            <span className="font-mono text-xs font-semibold text-foreground">
              {formatMoney(totalOutflowsNum)}
            </span>
          </div>

          {data.outflowCategories.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No operating expenses disbursed in this window.</p>
          ) : (
            <div className="space-y-2.5">
              {data.outflowCategories.map((cat) => {
                const amt = parseFloat(cat.amount) || 0
                return (
                  <div key={cat.categoryCode} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{cat.categoryName}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground text-[11px]">
                          {cat.count} voucher{cat.count === 1 ? "" : "s"}
                        </span>
                        <span className="font-mono font-semibold text-foreground">{formatMoney(amt)}</span>
                        <span className="font-mono text-[11px] text-muted-foreground w-11 text-right">
                          {cat.percentage}%
                        </span>
                      </div>
                    </div>
                    {/* Visual Distribution Mini Bar */}
                    <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full transition-all"
                        style={{ width: `${Math.max(2, cat.percentage)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. Account Liquidity Summary */}
      {data.accountSummaries.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h3 className="font-semibold text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Account Liquidity Net Movements
            </h3>
            <span className="text-xs text-muted-foreground">
              {data.accountSummaries.length} active account{data.accountSummaries.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.accountSummaries.map((acc) => {
              const inAmt = parseFloat(acc.inflows) || 0
              const outAmt = parseFloat(acc.outflows) || 0
              const netAmt = parseFloat(acc.netChange) || 0
              return (
                <div
                  key={acc.accountId}
                  className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{acc.accountName}</span>
                    <span className="text-[10px] font-mono uppercase text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                      {acc.accountType}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Inflows:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        +{formatMoney(inAmt)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Outflows:</span>
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">
                        -{formatMoney(outAmt)}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-border/40 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Net Movement:</span>
                    <span
                      className={cn(
                        "font-mono font-bold",
                        netAmt >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {netAmt >= 0 ? `+${formatMoney(netAmt)}` : formatMoney(netAmt)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 6. Daily Cash Flow Breakdown Table (Scrollable & Paginated) */}
      <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="font-semibold text-foreground text-sm">
            Daily Cash Flow Ledger Breakdown
          </h3>
          <span className="text-xs text-muted-foreground font-mono">
            {startDate} to {endDate} ({dailyRows.length} days)
          </span>
        </div>

        {dailyRows.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No daily cash activity recorded for this period.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto rounded-lg border border-border/70">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
                  <tr className="border-b border-border font-medium text-muted-foreground text-[11px] font-mono uppercase tracking-wider">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5 text-right">Inflows (+)</th>
                    <th className="px-3 py-2.5 text-center">Receipts</th>
                    <th className="px-3 py-2.5 text-right">Outflows (-)</th>
                    <th className="px-3 py-2.5 text-center">Vouchers</th>
                    <th className="px-3 py-2.5 text-right">Net Liquidity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedRows.map((row) => {
                    const inAmt = parseFloat(row.inflows) || 0
                    const outAmt = parseFloat(row.outflows) || 0
                    const netAmt = inAmt - outAmt
                    return (
                      <tr key={row.date} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono font-medium">{row.date}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {inAmt > 0 ? `+${formatMoney(inAmt)}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-muted-foreground text-[11px]">
                          {row.receiptCount > 0 ? `${row.receiptCount} rec.` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                          {outAmt > 0 ? `-${formatMoney(outAmt)}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-muted-foreground text-[11px]">
                          {row.paymentCount > 0 ? `${row.paymentCount} pay.` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold">
                          <span
                            className={cn(
                              netAmt > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : netAmt < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {netAmt > 0 ? `+${formatMoney(netAmt)}` : netAmt < 0 ? formatMoney(netAmt) : "₹0.00"}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Scrollable Pagination Footer */}
            {dailyRows.length > 0 && (
              <div className="border-t border-border/80 pt-2">
                <PaginationFooter
                  page={currentPage}
                  limit={limit}
                  total={dailyRows.length}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onLimitChange={(newLimit) => {
                    setLimit(newLimit)
                    setPage(1)
                  }}
                  pageSizeOptions={[10, 15, 25, 50, 100]}
                  syncUrl={false}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
