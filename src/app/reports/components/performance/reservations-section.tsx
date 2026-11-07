"use client"

import * as React from "react"
import { StatusBadge } from "@/components/ui-kit"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney } from "@/lib/currency"
import type { ReservationStatusReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, TableSkeleton } from "../report-section-shell"

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
        <div className="flex items-center gap-2 py-1">
          <Skeleton className="h-4 w-32" />
          <span className="text-muted-foreground/30">·</span>
          <Skeleton className="h-4 w-28" />
          <span className="text-muted-foreground/30">·</span>
          <Skeleton className="h-4 w-28" />
        </div>
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
      {/* Inline Stat Summary Row */}
      <div className="flex flex-wrap items-center gap-x-2 text-xs sm:text-sm text-muted-foreground py-1">
        <span>
          <strong className="font-bold font-mono text-foreground tabular-nums">
            {data.totalReservations}
          </strong>{" "}
          bookings ({data.totalAllocations} rooms, {data.totalStayNights} nights)
        </span>
        <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
        <span>
          <strong className="font-bold font-mono text-foreground tabular-nums">
            {data.averageLengthOfStay}
          </strong>{" "}
          nights avg stay (ALOS)
        </span>
        <span className="text-muted-foreground/40 select-none" aria-hidden="true">·</span>
        <span>
          <strong className="font-bold font-mono text-foreground tabular-nums">
            {data.cancellationRate}%
          </strong>{" "}
          cancellation ({data.completionRate}% completion)
        </span>
      </div>

      {/* Reservation Status Breakdown Table */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
        <div className="border-b border-border pb-2">
          <h3 className="font-semibold text-foreground">Reservation Lifecycle Breakdown</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground text-[11px] font-mono uppercase tracking-wider">
                <th className="px-3 py-1.5">Status</th>
                <th className="px-3 py-1.5">Bookings</th>
                <th className="px-3 py-1.5">Share %</th>
                <th className="px-3 py-1.5">Room Nights</th>
                <th className="px-3 py-1.5 text-right">Booked Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.statusBreakdown.map((item) => (
                <tr key={item.status} className="hover:bg-muted/20">
                  <td className="px-3 py-1.5">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-1.5 font-medium text-foreground">{item.count}</td>
                  <td className="px-3 py-1.5">
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
                  <td className="px-3 py-1.5">{item.roomNights}</td>
                  <td className="px-3 py-1.5 text-right font-medium">
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
