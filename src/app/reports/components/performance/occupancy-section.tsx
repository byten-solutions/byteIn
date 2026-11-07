"use client"

import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney } from "@/lib/currency"
import type { OccupancyReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, TableSkeleton } from "../report-section-shell"

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

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 py-1">
          <Skeleton className="h-4 w-32" />
          <span className="text-muted-foreground/30">·</span>
          <Skeleton className="h-4 w-20" />
          <span className="text-muted-foreground/30">·</span>
          <Skeleton className="h-4 w-20" />
          <span className="text-muted-foreground/30">·</span>
          <Skeleton className="h-4 w-28" />
        </div>
        <TableSkeleton rows={4} cols={8} />
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
    <div className="space-y-6">
      {/* Inline Stat Summary Row */}
      <div className="flex flex-wrap items-center gap-x-2 text-xs sm:text-sm text-muted-foreground py-1">
        <span>
          <strong className="font-bold font-mono text-foreground tabular-nums">
            {data.occupancyRate}%
          </strong>{" "}
          occupancy ({data.totalOccupiedRoomNights} of {data.totalAvailableRoomNights} nights)
        </span>
        <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
        <span>
          <strong className="font-bold font-mono text-foreground tabular-nums">
            {formatMoney(parseFloat(data.adr) || 0)}
          </strong>{" "}
          ADR
        </span>
        <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
        <span>
          <strong className="font-bold font-mono text-foreground tabular-nums">
            {formatMoney(parseFloat(data.revpar) || 0)}
          </strong>{" "}
          RevPAR
        </span>
        <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
        <span>
          <strong className="font-bold font-mono text-foreground tabular-nums">
            {formatMoney(parseFloat(data.totalRoomRevenue) || 0)}
          </strong>{" "}
          room revenue ({data.totalDays} days)
        </span>
      </div>

      {/* Property Breakdown (when available across multiple hotels) */}
      {data.propertyBreakdown && data.propertyBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
          <div className="border-b border-border pb-2">
            <h3 className="font-semibold text-foreground">Multi-Property Occupancy Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground text-[11px] font-mono uppercase tracking-wider">
                  <th className="px-3 py-1.5">Hotel Property</th>
                  <th className="px-3 py-1.5">Total Rooms</th>
                  <th className="px-3 py-1.5">Occupied Nights</th>
                  <th className="px-3 py-1.5">Occupancy %</th>
                  <th className="px-3 py-1.5 text-right">Room Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.propertyBreakdown.map((pb) => (
                  <tr key={pb.propertyId} className="hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-medium text-foreground">{pb.propertyName}</td>
                    <td className="px-3 py-1.5">{pb.totalRooms ?? 0}</td>
                    <td className="px-3 py-1.5">{pb.occupiedRoomNights ?? 0}</td>
                    <td className="px-3 py-1.5 font-semibold">{pb.occupancyRate ?? 0}%</td>
                    <td className="px-3 py-1.5 text-right font-medium">
                      {formatMoney(parseFloat(pb.totalRevenue || "0") || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Room Category Performance Table */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
        <div className="border-b border-border pb-2">
          <h3 className="font-semibold text-foreground">Room Category Performance</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground text-[11px] font-mono uppercase tracking-wider">
                <th className="px-3 py-1.5">Room Category</th>
                <th className="px-3 py-1.5">Total Rooms</th>
                <th className="px-3 py-1.5">Available Nights</th>
                <th className="px-3 py-1.5">Occupied Nights</th>
                <th className="px-3 py-1.5">Occupancy %</th>
                <th className="px-3 py-1.5">Room Revenue</th>
                <th className="px-3 py-1.5">ADR</th>
                <th className="px-3 py-1.5">RevPAR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.categoryBreakdown.map((cat) => (
                <tr key={cat.categoryId} className="hover:bg-muted/20">
                  <td className="px-3 py-1.5 font-semibold text-foreground">
                    {cat.categoryName}
                  </td>
                  <td className="px-3 py-1.5">{cat.totalRooms}</td>
                  <td className="px-3 py-1.5">{cat.availableRoomNights}</td>
                  <td className="px-3 py-1.5 font-medium">{cat.occupiedRoomNights}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{cat.occupancyRate}%</span>
                      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min(100, cat.occupancyRate)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 font-medium">{formatMoney(parseFloat(cat.roomRevenue) || 0)}</td>
                  <td className="px-3 py-1.5">{formatMoney(parseFloat(cat.adr) || 0)}</td>
                  <td className="px-3 py-1.5">{formatMoney(parseFloat(cat.revpar) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Occupancy Trend Table */}
      {data.dailyBreakdown && data.dailyBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
          <div className="border-b border-border pb-2">
            <h3 className="font-semibold text-foreground">Daily Occupancy & Revenue Trend</h3>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground text-[11px] font-mono uppercase tracking-wider">
                  <th className="px-3 py-1.5">Date</th>
                  <th className="px-3 py-1.5">Day</th>
                  <th className="px-3 py-1.5">Occupied / Total</th>
                  <th className="px-3 py-1.5">Occupancy Rate</th>
                  <th className="px-3 py-1.5">Room Revenue</th>
                  <th className="px-3 py-1.5">ADR</th>
                  <th className="px-3 py-1.5">RevPAR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.dailyBreakdown.map((d) => (
                  <tr key={d.date} className="hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-mono">{d.date}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{d.dayOfWeek}</td>
                    <td className="px-3 py-1.5">
                      {d.occupiedRooms} / {d.totalRooms}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{d.occupancyRate}%</span>
                        <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(100, d.occupancyRate)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 font-medium">{formatMoney(parseFloat(d.roomRevenue) || 0)}</td>
                    <td className="px-3 py-1.5">{formatMoney(parseFloat(d.adr) || 0)}</td>
                    <td className="px-3 py-1.5">{formatMoney(parseFloat(d.revpar) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
