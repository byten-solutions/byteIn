import * as React from "react"
import Link from "next/link"
import type { HotelDashboardStats } from "@/modules/dashboard/dashboard.service"

interface RoomStatusBarProps {
  counts: HotelDashboardStats
}

export function RoomStatusBar({ counts }: RoomStatusBarProps) {
  const total = counts.total
  const occupied = counts.occupied
  const clean = counts.clean
  const dirty = counts.dirty
  const maintenance = counts.maintenance + counts.outOfService

  const occupiedPct = total > 0 ? (occupied / total) * 100 : 0
  const cleanPct = total > 0 ? (clean / total) * 100 : 0
  const dirtyPct = total > 0 ? (dirty / total) * 100 : 0
  const maintPct = total > 0 ? (maintenance / total) * 100 : 0

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-xs">
      {/* Header / Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">Room Inventory Distribution</span>
          <span className="text-muted-foreground/40" aria-hidden="true">·</span>
          <span className="text-muted-foreground font-mono">
            <strong className="text-foreground font-bold">{total}</strong> total physical room{total === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground font-mono">
          <span>
            Occupancy: <strong className="text-foreground font-bold tabular-nums">{Math.round(occupiedPct)}%</strong>
          </span>
          {dirty > 0 && (
            <>
              <span className="text-muted-foreground/40" aria-hidden="true">·</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {dirty} dirty awaiting turnover
              </span>
            </>
          )}
        </div>
      </div>

      {/* Proportional Stacked Bar */}
      <div className="h-3 w-full rounded-md bg-muted/60 flex overflow-hidden gap-0.5 p-0.5">
        {total === 0 ? (
          <div className="h-full w-full bg-muted/80 rounded-xs" />
        ) : (
          <>
            {occupiedPct > 0 && (
              <div
                className="h-full bg-sky-500 rounded-xs transition-all"
                style={{ width: `${occupiedPct}%` }}
                title={`Occupied: ${occupied} rooms (${occupiedPct.toFixed(1)}%)`}
              />
            )}
            {cleanPct > 0 && (
              <div
                className="h-full bg-emerald-500 rounded-xs transition-all"
                style={{ width: `${cleanPct}%` }}
                title={`Vacant Clean: ${clean} rooms (${cleanPct.toFixed(1)}%)`}
              />
            )}
            {dirtyPct > 0 && (
              <div
                className="h-full bg-amber-500 rounded-xs transition-all"
                style={{ width: `${dirtyPct}%` }}
                title={`Vacant Dirty: ${dirty} rooms (${dirtyPct.toFixed(1)}%)`}
              />
            )}
            {maintPct > 0 && (
              <div
                className="h-full bg-purple-500 rounded-xs transition-all"
                style={{ width: `${maintPct}%` }}
                title={`Maintenance & OOS: ${maintenance} rooms (${maintPct.toFixed(1)}%)`}
              />
            )}
          </>
        )}
      </div>

      {/* Legend with interactive room rack links */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <Link
          href="/rooms?status=OCCUPIED"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <span className="size-2 rounded-full bg-sky-500 shrink-0" />
          <span>Occupied</span>
          <span className="font-mono font-bold text-foreground tabular-nums group-hover:underline">
            {occupied}
          </span>
          <span className="text-[11px] text-muted-foreground/70 font-mono">
            ({Math.round(occupiedPct)}%)
          </span>
        </Link>

        <Link
          href="/rooms?status=VACANT_CLEAN"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
          <span>Clean Ready</span>
          <span className="font-mono font-bold text-foreground tabular-nums group-hover:underline">
            {clean}
          </span>
          <span className="text-[11px] text-muted-foreground/70 font-mono">
            ({Math.round(cleanPct)}%)
          </span>
        </Link>

        <Link
          href="/rooms?status=VACANT_DIRTY"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <span className="size-2 rounded-full bg-amber-500 shrink-0" />
          <span>Dirty Turnover</span>
          <span className="font-mono font-bold text-foreground tabular-nums group-hover:underline">
            {dirty}
          </span>
          <span className="text-[11px] text-muted-foreground/70 font-mono">
            ({Math.round(dirtyPct)}%)
          </span>
        </Link>

        <Link
          href="/rooms?status=MAINTENANCE"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <span className="size-2 rounded-full bg-purple-500 shrink-0" />
          <span>Maintenance / OOS</span>
          <span className="font-mono font-bold text-foreground tabular-nums group-hover:underline">
            {maintenance}
          </span>
          <span className="text-[11px] text-muted-foreground/70 font-mono">
            ({Math.round(maintPct)}%)
          </span>
        </Link>
      </div>
    </div>
  )
}
