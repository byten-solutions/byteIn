"use client"

import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney } from "@/lib/currency"
import type { OccupancyReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, TableSkeleton } from "../report-section-shell"
import { ReportMetricBand, ReportTrendChart } from "../charts"
import { PaginationFooter } from "@/components/ui-kit/pagination-footer"

interface OccupancySectionProps {
  startDate: string
  endDate: string
  propertyId?: string
  refreshTrigger?: number
}

export function OccupancySection({
  startDate,
  endDate,
  propertyId,
  refreshTrigger,
}: OccupancySectionProps) {
  const { data, isLoading, error, refetch } = useReportQuery<OccupancyReportDTO>({
    endpoint: "/api/reports/occupancy",
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
      <div className="space-y-5">
        <div className="flex items-center gap-2 py-1">
          <Skeleton className="h-4 w-28" />
          <span className="text-muted-foreground/30">·</span>
          <Skeleton className="h-4 w-24" />
        </div>
        <TableSkeleton rows={8} cols={7} />
      </div>
    )
  }

  if (error && !data) {
    return (
      <ReportSectionError
        title="Failed to load occupancy report"
        error={error}
        onRetry={refetch}
      />
    )
  }

  if (!data) return null

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Core KPIs in Compact Band */}
      <ReportMetricBand
        metrics={[
          {
            label: "Average Occupancy",
            value: `${data.occupancyRate}%`,
            subtext: `${data.totalOccupiedRoomNights} room nights occupied`,
            tone: data.occupancyRate >= 70 ? "success" : "default",
          },
          {
            label: "Total Room Revenue",
            value: parseFloat(data.totalRoomRevenue) || 0,
            isMoney: true,
            tone: "success",
            subtext: `From ${dailyRows.length} operating days`,
          },
          {
            label: "Average Daily Rate (ADR)",
            value: parseFloat(data.adr) || 0,
            isMoney: true,
            subtext: "Avg rate per sold room",
          },
          {
            label: "Revenue Per Room (RevPAR)",
            value: parseFloat(data.revpar) || 0,
            isMoney: true,
            subtext: "Across available capacity",
          },
        ]}
      />

      {/* 2. Visual Performance Graph: Daily Occupancy Rate & ADR Trajectory */}
      {dailyRows.length > 0 && (
        <ReportTrendChart
          title="Daily Occupancy Rate & Average Daily Rate (ADR)"
          subtitle="Day-by-day room performance tracking occupancy percentage alongside average realized rate per room."
          data={dailyRows.map((r) => ({
            date: r.date,
            value: r.occupancyRate,
            secondaryValue: parseFloat(r.adr) || 0,
          }))}
          series1Name="Occupancy Rate"
          series1Color="#3b82f6"
          series1IsMoney={false}
          series1Suffix="%"
          series2Name="ADR"
          series2Color="#10b981"
          series2IsMoney={true}
          height={210}
        />
      )}

      {/* 3. Clean Daily Performance Table */}
      <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="font-semibold text-foreground text-sm">
            Daily Occupancy & Revenue Breakdown
          </h3>
          <span className="text-xs text-muted-foreground font-mono">
            {startDate} to {endDate}
          </span>
        </div>

        {dailyRows.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No room allocation data for this date range.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto rounded-lg border border-border/70">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
                  <tr className="border-b border-border font-medium text-muted-foreground text-[11px] font-mono uppercase tracking-wider">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Day</th>
                    <th className="px-3 py-2.5 text-center">Occupied / Total</th>
                    <th className="px-3 py-2.5 text-center">Occupancy Rate</th>
                    <th className="px-3 py-2.5 text-right">Room Revenue</th>
                    <th className="px-3 py-2.5 text-right">ADR</th>
                    <th className="px-3 py-2.5 text-right">RevPAR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedRows.map((row) => (
                    <tr key={row.date} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono font-medium">{row.date}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.dayOfWeek}</td>
                      <td className="px-3 py-2 text-center font-mono">
                        {row.occupiedRooms} / {row.totalRooms}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-mono font-semibold px-2 py-0.5 rounded-full text-[11px] bg-muted border border-border">
                          {row.occupancyRate}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(parseFloat(row.roomRevenue) || 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {formatMoney(parseFloat(row.adr) || 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {formatMoney(parseFloat(row.revpar) || 0)}
                      </td>
                    </tr>
                  ))}
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
