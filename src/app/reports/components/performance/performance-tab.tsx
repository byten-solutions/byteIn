"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OccupancySection } from "./occupancy-section"
import { RevenueSection } from "./revenue-section"
import { ReservationsSection } from "./reservations-section"

interface PerformanceTabProps {
  initialStartDate: string
  initialEndDate: string
  propertyId?: string
  refreshTrigger?: number
}

export function PerformanceTab({
  initialStartDate,
  initialEndDate,
  propertyId,
  refreshTrigger = 0,
}: PerformanceTabProps) {
  const [startDate, setStartDate] = React.useState<string>(initialStartDate)
  const [endDate, setEndDate] = React.useState<string>(initialEndDate)
  const [appliedDates, setAppliedDates] = React.useState<{ start: string; end: string }>({
    start: initialStartDate,
    end: initialEndDate,
  })

  const setPreset = (preset: "last7" | "thisMonth" | "last30" | "lastMonth") => {
    const today = new Date()
    const y = today.getUTCFullYear()
    const m = today.getUTCMonth()

    let start = ""
    let end = today.toISOString().split("T")[0]!

    if (preset === "last7") {
      const d = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
      start = d.toISOString().split("T")[0]!
    } else if (preset === "thisMonth") {
      const monthStr = String(m + 1).padStart(2, "0")
      start = `${y}-${monthStr}-01`
    } else if (preset === "last30") {
      const d = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
      start = d.toISOString().split("T")[0]!
    } else if (preset === "lastMonth") {
      const prevMonthYear = m === 0 ? y - 1 : y
      const prevMonth = m === 0 ? 12 : m
      const prevMonthStr = String(prevMonth).padStart(2, "0")
      start = `${prevMonthYear}-${prevMonthStr}-01`
      const lastDayOfPrevMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
      end = `${prevMonthYear}-${prevMonthStr}-${String(lastDayOfPrevMonth).padStart(2, "0")}`
    }

    setStartDate(start)
    setEndDate(end)
    setAppliedDates({ start, end })
  }

  const handleApply = () => {
    setAppliedDates({ start: startDate, end: endDate })
  }

  return (
    <div className="space-y-8">
      {/* Date Filter & Presets Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Presets:</span>
          <Button variant="outline" size="sm" onClick={() => setPreset("last7")}>
            Last 7 Days
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPreset("thisMonth")}>
            This Month (MTD)
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPreset("last30")}>
            Last 30 Days
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPreset("lastMonth")}>
            Last Month
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-36 text-xs"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-36 text-xs"
          />
          <Button size="sm" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>

      {/* Section 1: Occupancy, ADR, RevPAR */}
      <div className="space-y-3">
        <div className="border-b border-border pb-2">
          <h2 className="text-base font-semibold text-foreground">Occupancy & Yield Performance</h2>
          <p className="text-xs text-muted-foreground">
            Room occupancy, average daily rate (ADR), and RevPAR over {appliedDates.start} to {appliedDates.end}.
          </p>
        </div>
        <OccupancySection
          startDate={appliedDates.start}
          endDate={appliedDates.end}
          propertyId={propertyId}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Section 2: Revenue & Invoiced vs Collected */}
      <div className="space-y-3">
        <div className="border-b border-border pb-2">
          <h2 className="text-base font-semibold text-foreground">Revenue & Collections Realization</h2>
          <p className="text-xs text-muted-foreground">
            Invoiced billing volume, realized settlements, and revenue source breakdown.
          </p>
        </div>
        <RevenueSection
          startDate={appliedDates.start}
          endDate={appliedDates.end}
          propertyId={propertyId}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Section 3: Reservation Lifecycle & Booking Volumes */}
      <div className="space-y-3">
        <div className="border-b border-border pb-2">
          <h2 className="text-base font-semibold text-foreground">Reservation Volumes & Statuses</h2>
          <p className="text-xs text-muted-foreground">
            Booking fulfillment, cancellation ratios, and average length of stay (ALOS).
          </p>
        </div>
        <ReservationsSection
          startDate={appliedDates.start}
          endDate={appliedDates.end}
          propertyId={propertyId}
          refreshTrigger={refreshTrigger}
        />
      </div>
    </div>
  )
}
