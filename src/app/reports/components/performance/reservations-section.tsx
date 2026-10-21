"use client"

import * as React from "react"
import { CalendarCheck, Clock, CheckCircle2 } from "lucide-react"
import { StatCard, StatusBadge } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import type { ReservationStatusReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, StatCardsSkeleton, TableSkeleton } from "../report-section-shell"

interface ReservationsSectionProps {
  startDate: string
  endDate: string
  propertyId?: string
  refreshTrigger?: number
}

export function ReservationsSection({
  startDate,
  endDate,
  propertyId,
  refreshTrigger,
}: ReservationsSectionProps) {
  const { data, isLoading, error, refetch } = useReportQuery<ReservationStatusReportDTO>({
    endpoint: "/api/reports/reservations",
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
        <StatCardsSkeleton count={3} />
        <TableSkeleton rows={4} cols={5} />
      </div>
    )
  }

  if (error && !data) {
    return (
      <ReportSectionError
        title="Failed to load reservation status report"
        error={error}
        onRetry={refetch}
      />
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Booking Volume & Stay Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Total Bookings"
          value={data.totalReservations}
          subtext={`${data.totalAllocations} rooms, ${data.totalStayNights} room-nights`}
          icon={<CalendarCheck className="size-4" />}
        />
        <StatCard
          label="Avg Stay (ALOS)"
          value={`${data.averageLengthOfStay} nights`}
          subtext="Average duration per room stay"
          icon={<Clock className="size-4" />}
        />
        <StatCard
          label="Cancellation %"
          value={`${data.cancellationRate}%`}
          subtext={`${data.completionRate}% completion rate`}
          icon={<CheckCircle2 className="size-4" />}
        />
      </div>

      {/* Reservation Status Breakdown Table */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="border-b border-border pb-2">
          <h3 className="font-semibold text-foreground">Reservation Lifecycle Breakdown</h3>
          <p className="text-xs text-muted-foreground">
            Distribution of reservations by active status, room-nights fulfilled, and booked folio value.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Bookings</th>
                <th className="px-3 py-2.5">Share %</th>
                <th className="px-3 py-2.5">Room Nights</th>
                <th className="px-3 py-2.5 text-right">Booked Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.statusBreakdown.map((item) => (
                <tr key={item.status} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{item.count}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.percentage}%</span>
                      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min(100, item.percentage)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{item.roomNights}</td>
                  <td className="px-3 py-2.5 text-right font-medium">
                    {formatMoney(parseFloat(item.totalValue) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
