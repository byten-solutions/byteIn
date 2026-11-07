import * as React from "react"
import { LogIn, LogOut } from "lucide-react"
import type { DailyOperationsCountsDTO } from "@/modules/reports/reports.types"

interface ShiftProgressGaugesProps {
  counts: DailyOperationsCountsDTO
}

export function ShiftProgressGauges({ counts }: ShiftProgressGaugesProps) {
  const totalArrivals = counts.arrivals + counts.checkedInArrivals
  const checkInPct =
    totalArrivals > 0 ? Math.round((counts.checkedInArrivals / totalArrivals) * 100) : 0

  const totalDepartures = counts.departures + counts.checkedOutDepartures
  const checkOutPct =
    totalDepartures > 0 ? Math.round((counts.checkedOutDepartures / totalDepartures) * 100) : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs">
      {/* Check-In Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <LogIn className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            Check-In Turnout
          </span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            <strong className="text-foreground font-bold">{counts.checkedInArrivals}</strong> of{" "}
            {totalArrivals} arrived ({checkInPct}%)
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${checkInPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>
            {counts.arrivals} pending arrival{counts.arrivals === 1 ? "" : "s"}
          </span>
          {counts.overdue > 0 && (
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              {counts.overdue} overdue
            </span>
          )}
        </div>
      </div>

      {/* Check-Out Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <LogOut className="size-3.5 text-sky-600 dark:text-sky-400" />
            Check-Out Cleared
          </span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            <strong className="text-foreground font-bold">{counts.checkedOutDepartures}</strong> of{" "}
            {totalDepartures} departed ({checkOutPct}%)
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-sky-500 rounded-full transition-all duration-300"
            style={{ width: `${checkOutPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>
            {counts.departures} pending checkout{counts.departures === 1 ? "" : "s"}
          </span>
          <span>{counts.inHouse} currently in-house</span>
        </div>
      </div>
    </div>
  )
}
