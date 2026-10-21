"use client"

import * as React from "react"
import { TrendingUp, CreditCard, BarChart3, Receipt } from "lucide-react"
import { StatCard } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import type { OccupancyReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, StatCardsSkeleton, TableSkeleton } from "../report-section-shell"

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
        <StatCardsSkeleton count={4} />
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
      {/* Primary Occupancy KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Occupancy Rate"
          value={`${data.occupancyRate}%`}
          subtext={`${data.totalOccupiedRoomNights} of ${data.totalAvailableRoomNights} nights`}
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="ADR (Avg Daily Rate)"
          value={formatMoney(parseFloat(data.adr) || 0)}
          subtext="Room revenue / rooms sold"
          icon={<CreditCard className="size-4" />}
        />
        <StatCard
          label="RevPAR"
          value={formatMoney(parseFloat(data.revpar) || 0)}
          subtext="Room revenue / available rooms"
          icon={<BarChart3 className="size-4" />}
        />
        <StatCard
          label="Total Room Revenue"
          value={formatMoney(parseFloat(data.totalRoomRevenue) || 0)}
          subtext={`${data.totalDays} calendar days`}
          icon={<Receipt className="size-4" />}
        />
      </div>

      {/* Property Breakdown (when available across multiple hotels) */}
      {data.propertyBreakdown && data.propertyBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="border-b border-border pb-2">
            <h3 className="font-semibold text-foreground">Multi-Property Occupancy Comparison</h3>
            <p className="text-xs text-muted-foreground">Portfolio performance breakdown across hotels</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <th className="px-3 py-2">Hotel Property</th>
                  <th className="px-3 py-2">Total Rooms</th>
                  <th className="px-3 py-2">Occupied Nights</th>
                  <th className="px-3 py-2">Occupancy %</th>
                  <th className="px-3 py-2 text-right">Room Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.propertyBreakdown.map((pb) => (
                  <tr key={pb.propertyId} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium text-foreground">{pb.propertyName}</td>
                    <td className="px-3 py-2">{pb.totalRooms ?? 0}</td>
                    <td className="px-3 py-2">{pb.occupiedRoomNights ?? 0}</td>
                    <td className="px-3 py-2 font-semibold">{pb.occupancyRate ?? 0}%</td>
                    <td className="px-3 py-2 text-right font-medium">
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
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="border-b border-border pb-2">
          <h3 className="font-semibold text-foreground">Room Category Performance Breakdown</h3>
          <p className="text-xs text-muted-foreground">
            Category sales volume, occupancy rates, ADR, and revenue generation.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <th className="px-3 py-2.5">Room Category</th>
                <th className="px-3 py-2.5">Total Rooms</th>
                <th className="px-3 py-2.5">Available Nights</th>
                <th className="px-3 py-2.5">Occupied Nights</th>
                <th className="px-3 py-2.5">Occupancy %</th>
                <th className="px-3 py-2.5">Room Revenue</th>
                <th className="px-3 py-2.5">ADR</th>
                <th className="px-3 py-2.5">RevPAR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.categoryBreakdown.map((cat) => (
                <tr key={cat.categoryId} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-semibold text-foreground">
                    {cat.categoryName}
                  </td>
                  <td className="px-3 py-2.5">{cat.totalRooms}</td>
                  <td className="px-3 py-2.5">{cat.availableRoomNights}</td>
                  <td className="px-3 py-2.5 font-medium">{cat.occupiedRoomNights}</td>
                  <td className="px-3 py-2.5">
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
                  <td className="px-3 py-2.5 font-medium">{formatMoney(parseFloat(cat.roomRevenue) || 0)}</td>
                  <td className="px-3 py-2.5">{formatMoney(parseFloat(cat.adr) || 0)}</td>
                  <td className="px-3 py-2.5">{formatMoney(parseFloat(cat.revpar) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Occupancy Trend Table */}
      {data.dailyBreakdown && data.dailyBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="border-b border-border pb-2">
            <h3 className="font-semibold text-foreground">Daily Occupancy & Revenue Trend</h3>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2">Occupied / Total</th>
                  <th className="px-3 py-2">Occupancy Rate</th>
                  <th className="px-3 py-2">Room Revenue</th>
                  <th className="px-3 py-2">ADR</th>
                  <th className="px-3 py-2">RevPAR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.dailyBreakdown.map((d) => (
                  <tr key={d.date} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono">{d.date}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.dayOfWeek}</td>
                    <td className="px-3 py-2">
                      {d.occupiedRooms} / {d.totalRooms}
                    </td>
                    <td className="px-3 py-2">
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
                    <td className="px-3 py-2 font-medium">{formatMoney(parseFloat(d.roomRevenue) || 0)}</td>
                    <td className="px-3 py-2">{formatMoney(parseFloat(d.adr) || 0)}</td>
                    <td className="px-3 py-2">{formatMoney(parseFloat(d.revpar) || 0)}</td>
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
