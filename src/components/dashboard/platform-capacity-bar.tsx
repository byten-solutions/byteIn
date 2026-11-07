import * as React from "react"
import type { PlatformPropertyOverview } from "@/modules/dashboard/dashboard.service"

interface PlatformCapacityBarProps {
  properties: PlatformPropertyOverview[]
  totalRooms: number
}

export function PlatformCapacityBar({ properties, totalRooms }: PlatformCapacityBarProps) {
  const totalClean = properties.reduce((acc, p) => acc + p.cleanRooms, 0)
  const totalOccupied = properties.reduce((acc, p) => acc + p.occupiedRooms, 0)
  const remaining = Math.max(0, totalRooms - totalClean - totalOccupied)

  const occPct = totalRooms > 0 ? (totalOccupied / totalRooms) * 100 : 0
  const cleanPct = totalRooms > 0 ? (totalClean / totalRooms) * 100 : 0
  const remPct = totalRooms > 0 ? (remaining / totalRooms) * 100 : 0

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">Global Portfolio Room Utilization</span>
          <span className="text-muted-foreground/40" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-muted-foreground">
            <strong className="text-foreground font-bold">{totalRooms}</strong> portfolio rooms
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span>
            Portfolio Occupancy:{" "}
            <strong className="text-foreground font-bold tabular-nums">{Math.round(occPct)}%</strong>
          </span>
          <span className="text-muted-foreground/40" aria-hidden="true">
            ·
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
            {totalClean} ready for guests
          </span>
        </div>
      </div>

      {/* Proportional Stacked Bar */}
      <div className="h-3 w-full rounded-md bg-muted/60 flex overflow-hidden gap-0.5 p-0.5">
        {totalRooms === 0 ? (
          <div className="h-full w-full bg-muted/80 rounded-xs" />
        ) : (
          <>
            {occPct > 0 && (
              <div
                className="h-full bg-sky-500 rounded-xs transition-all"
                style={{ width: `${occPct}%` }}
                title={`Occupied: ${totalOccupied} rooms (${occPct.toFixed(1)}%)`}
              />
            )}
            {cleanPct > 0 && (
              <div
                className="h-full bg-emerald-500 rounded-xs transition-all"
                style={{ width: `${cleanPct}%` }}
                title={`Clean Ready: ${totalClean} rooms (${cleanPct.toFixed(1)}%)`}
              />
            )}
            {remPct > 0 && (
              <div
                className="h-full bg-amber-500/80 rounded-xs transition-all"
                style={{ width: `${remPct}%` }}
                title={`Turnover & Maintenance: ${remaining} rooms (${remPct.toFixed(1)}%)`}
              />
            )}
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-500 shrink-0" />
          Occupied:{" "}
          <strong className="text-foreground font-mono font-bold tabular-nums">
            {totalOccupied}
          </strong>
          <span className="text-[11px] font-mono">({Math.round(occPct)}%)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
          Clean Ready:{" "}
          <strong className="text-foreground font-mono font-bold tabular-nums">
            {totalClean}
          </strong>
          <span className="text-[11px] font-mono">({Math.round(cleanPct)}%)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-500/80 shrink-0" />
          Turnover / Other:{" "}
          <strong className="text-foreground font-mono font-bold tabular-nums">
            {remaining}
          </strong>
          <span className="text-[11px] font-mono">({Math.round(remPct)}%)</span>
        </span>
      </div>
    </div>
  )
}

interface PropertyMiniCapacityBarProps {
  cleanRooms: number
  occupiedRooms: number
  totalRooms: number
}

export function PropertyMiniCapacityBar({
  cleanRooms,
  occupiedRooms,
  totalRooms,
}: PropertyMiniCapacityBarProps) {
  const remaining = Math.max(0, totalRooms - cleanRooms - occupiedRooms)
  const occPct = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0
  const cleanPct = totalRooms > 0 ? (cleanRooms / totalRooms) * 100 : 0
  const remPct = totalRooms > 0 ? (remaining / totalRooms) * 100 : 0

  return (
    <div className="space-y-1.5 pt-2 border-t border-border/60">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">Room Capacity</span>
        <span className="font-mono tabular-nums font-semibold text-foreground">
          {Math.round(occPct)}% occupied
        </span>
      </div>
      <div className="h-2 w-full rounded-md bg-muted/60 flex overflow-hidden gap-0.5 p-0.5">
        {totalRooms === 0 ? (
          <div className="h-full w-full bg-muted/80 rounded-xs" />
        ) : (
          <>
            {occPct > 0 && (
              <div
                className="h-full bg-sky-500 rounded-xs transition-all"
                style={{ width: `${occPct}%` }}
                title={`Occupied: ${occupiedRooms} (${occPct.toFixed(1)}%)`}
              />
            )}
            {cleanPct > 0 && (
              <div
                className="h-full bg-emerald-500 rounded-xs transition-all"
                style={{ width: `${cleanPct}%` }}
                title={`Clean: ${cleanRooms} (${cleanPct.toFixed(1)}%)`}
              />
            )}
            {remPct > 0 && (
              <div
                className="h-full bg-muted-foreground/30 rounded-xs transition-all"
                style={{ width: `${remPct}%` }}
                title={`Other: ${remaining} (${remPct.toFixed(1)}%)`}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
