"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { OccupancySection } from "./occupancy-section"
import { RevenueSection } from "./revenue-section"
import { ReservationsSection } from "./reservations-section"

type PerformanceSubTab = "occupancy" | "revenue" | "reservations"

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
  const [activeSubTab, setActiveSubTab] = React.useState<PerformanceSubTab>("occupancy")
  const [openedSubTabs, setOpenedSubTabs] = React.useState<Set<PerformanceSubTab>>(
    () => new Set(["occupancy"])
  )
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

  const handleSubTabSelect = (tab: PerformanceSubTab) => {
    setActiveSubTab(tab)
    setOpenedSubTabs((prev) => {
      if (prev.has(tab)) return prev
      const next = new Set(prev)
      next.add(tab)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Date Filter & Presets Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs print:hidden">
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
            className="w-36 text-xs bg-background"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-36 text-xs bg-background"
          />
          <Button size="sm" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>

      {/* Performance Sub-Tab Navigation — Secondary Segmented Pill */}
      <div className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-1 print:hidden">
        <button
          type="button"
          onClick={() => handleSubTabSelect("occupancy")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
            activeSubTab === "occupancy"
              ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Occupancy
        </button>

        <button
          type="button"
          onClick={() => handleSubTabSelect("revenue")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
            activeSubTab === "revenue"
              ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Revenue
        </button>

        <button
          type="button"
          onClick={() => handleSubTabSelect("reservations")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
            activeSubTab === "reservations"
              ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Reservations
        </button>
      </div>

      {/* Sub-Tab Panels */}
      <div>
        {openedSubTabs.has("occupancy") && (
          <div className={cn(activeSubTab !== "occupancy" && "hidden")}>
            <OccupancySection
              startDate={appliedDates.start}
              endDate={appliedDates.end}
              propertyId={propertyId}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}

        {openedSubTabs.has("revenue") && (
          <div className={cn(activeSubTab !== "revenue" && "hidden")}>
            <RevenueSection
              startDate={appliedDates.start}
              endDate={appliedDates.end}
              propertyId={propertyId}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}

        {openedSubTabs.has("reservations") && (
          <div className={cn(activeSubTab !== "reservations" && "hidden")}>
            <ReservationsSection
              startDate={appliedDates.start}
              endDate={appliedDates.end}
              propertyId={propertyId}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}
      </div>
    </div>
  )
}
