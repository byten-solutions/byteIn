"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { AvailabilityGridDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "./use-report-query"
import { ReportSectionError, TableSkeleton } from "./report-section-shell"

interface AvailabilityGridTabProps {
  initialStartDate: string
  initialEndDate: string
  propertyId?: string
  refreshTrigger?: number
}

export function AvailabilityGridTab({
  initialStartDate,
  initialEndDate,
  propertyId,
  refreshTrigger = 0,
}: AvailabilityGridTabProps) {
  const [gridStart, setGridStart] = React.useState<string>(initialStartDate)
  const [gridEnd, setGridEnd] = React.useState<string>(initialEndDate)

  const { data, isLoading, error, refetch } = useReportQuery<AvailabilityGridDTO>({
    endpoint: "/api/reports/availability-grid",
    params: {
      startDate: gridStart,
      endDate: gridEnd,
      propertyId,
    },
    enabled: true,
    refreshTrigger,
  })

  return (
    <div className="space-y-4">
      {/* Grid Controls */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Label className="font-medium">Window:</Label>
          <Input
            type="date"
            value={gridStart}
            onChange={(e) => setGridStart(e.target.value)}
            className="w-40"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={gridEnd}
            onChange={(e) => setGridEnd(e.target.value)}
            className="w-40"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date()
              const s = now.toISOString().split("T")[0]!
              const e = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!
              setGridStart(s)
              setGridEnd(e)
            }}
          >
            Next 7 Days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date()
              const s = now.toISOString().split("T")[0]!
              const e = new Date(now.getTime() + 13 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!
              setGridStart(s)
              setGridEnd(e)
            }}
          >
            14 Days
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-emerald-100 border border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800" />
            Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-blue-500 text-white" />
            Booked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-amber-500 text-white" />
            Checked In
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-rose-500 text-white" />
            Maintenance
          </span>
        </div>
      </div>

      {isLoading && !data && (
        <TableSkeleton rows={8} cols={8} />
      )}

      {error && !data && (
        <ReportSectionError
          title="Failed to load availability grid"
          error={error}
          onRetry={refetch}
        />
      )}

      {data && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="sticky left-0 z-20 min-w-[140px] border-r border-border bg-muted px-3 py-2.5 font-semibold">
                    Room / Cat
                  </th>
                  {data.dates.map((dateStr) => {
                    const d = new Date(`${dateStr}T00:00:00.000Z`)
                    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]
                    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6
                    return (
                      <th
                        key={dateStr}
                        className={cn(
                          "min-w-[90px] border-r border-border px-2 py-2 text-center",
                          isWeekend && "bg-muted/80"
                        )}
                      >
                        <div className="font-semibold">{dayName}</div>
                        <div className="text-[11px] text-muted-foreground">{dateStr.slice(5)}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rooms.map((room) => (
                  <tr key={room.roomId} className="hover:bg-muted/10">
                    {/* Fixed Left Header Column */}
                    <td className="sticky left-0 z-10 border-r border-border bg-card px-3 py-2 font-medium">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Room {room.roomNo}</span>
                        <span className="text-[10px] text-muted-foreground">F{room.floorNo}</span>
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {room.categoryName}
                      </div>
                    </td>

                    {/* Day Slot Cells */}
                    {room.slots.map((slot) => {
                      if (slot.isOccupied) {
                        const isCheckedIn = slot.allocationStatus === "CHECKED_IN"
                        return (
                          <td
                            key={slot.date}
                            className="border-r border-border p-1"
                          >
                            <Link
                              href={`/reservations/${slot.reservationId}`}
                              title={`${slot.guestName || "Guest"} (${slot.reservationNo})`}
                              className={cn(
                                "block rounded-md p-1.5 text-[11px] font-medium transition-opacity hover:opacity-80 text-white",
                                isCheckedIn ? "bg-amber-600" : "bg-blue-600"
                              )}
                            >
                              <div className="truncate font-semibold">{slot.guestName || "Guest"}</div>
                              <div className="truncate text-[9px] opacity-90">{slot.reservationNo}</div>
                            </Link>
                          </td>
                        )
                      }

                      if (slot.isMaintenance) {
                        return (
                          <td
                            key={slot.date}
                            className="border-r border-border bg-rose-50 p-1 text-center dark:bg-rose-950/20"
                          >
                            <div className="rounded-md bg-rose-500/20 py-2 text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                              Mnt
                            </div>
                          </td>
                        )
                      }

                      // Free / Available
                      return (
                        <td
                          key={slot.date}
                          className="border-r border-border bg-emerald-50/40 p-1 text-center hover:bg-emerald-100/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30"
                        >
                          <div className="py-2 text-[11px] font-medium text-emerald-800 dark:text-emerald-400">
                            {formatMoney(parseFloat(slot.nightlyRate) || 0)}
                          </div>
                        </td>
                      )
                    })}
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
