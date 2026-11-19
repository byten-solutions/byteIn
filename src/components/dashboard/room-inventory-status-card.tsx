import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, BedDouble } from "lucide-react"

interface RoomInventoryStatusCardProps {
  propertyId?: string
  stats: {
    total: number
    clean: number
    dirty: number
    occupied: number
    maintenance?: number
    outOfService?: number
  }
}

export function RoomInventoryStatusCard({ propertyId, stats }: RoomInventoryStatusCardProps) {
  const total = stats.total || 0
  const occupied = stats.occupied || 0
  const clean = stats.clean || 0
  const dirty = stats.dirty || 0
  const maint = (stats.maintenance || 0) + (stats.outOfService || 0)

  const occPct = total > 0 ? Math.round((occupied / total) * 100) : 0
  const cleanPct = total > 0 ? (clean / total) * 100 : 0
  const dirtyPct = total > 0 ? (dirty / total) * 100 : 0
  const maintPct = total > 0 ? (maint / total) * 100 : 0

  const roomsHref = propertyId ? `/rooms?propertyId=${encodeURIComponent(propertyId)}` : "/rooms"

  return (
    <Link
      href={roomsHref}
      className="block group rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 hover:border-primary/50 hover:bg-muted/15 transition-all shadow-2xs space-y-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      title="View all rooms and turnover status"
    >
      {/* Heading */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <BedDouble className="size-4 text-sky-600 dark:text-sky-400" />
          <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            Room Inventory Status
          </h2>
        </div>
        <ArrowUpRight className="size-3.5 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>

      {/* Prominent Metric & Subtext */}
      <div className="space-y-0.5">
        <div className="text-xl sm:text-2xl font-extrabold font-mono text-foreground tracking-tight tabular-nums">
          {occupied} / {total} Occupied ({occPct}%)
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          {clean} vacant clean · {dirty} turnover needed
        </div>
      </div>

      {/* Segmented Proportional Room Capacity Ratio Bar */}
      {total > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/50">
          <div className="h-1.5 w-full rounded-full bg-muted/60 flex overflow-hidden gap-0.5">
            {occupied > 0 && (
              <div
                className="h-full rounded-full bg-sky-500"
                style={{ width: `${(occupied / total) * 100}%` }}
                title={`Occupied: ${occupied} (${occPct}%)`}
              />
            )}
            {clean > 0 && (
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${cleanPct}%` }}
                title={`Vacant Clean: ${clean}`}
              />
            )}
            {dirty > 0 && (
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${dirtyPct}%` }}
                title={`Vacant Dirty: ${dirty}`}
              />
            )}
            {maint > 0 && (
              <div
                className="h-full rounded-full bg-purple-500"
                style={{ width: `${maintPct}%` }}
                title={`Maintenance & OOS: ${maint}`}
              />
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono text-muted-foreground">
            <span>
              <span className="inline-block size-1.5 rounded-full bg-sky-500 mr-1 align-middle" />
              <span className="font-medium text-foreground">Occupied</span>: {occupied}
            </span>
            <span>
              <span className="inline-block size-1.5 rounded-full bg-emerald-500 mr-1 align-middle" />
              <span className="font-medium text-foreground">Clean</span>: {clean}
            </span>
            <span>
              <span className="inline-block size-1.5 rounded-full bg-amber-500 mr-1 align-middle" />
              <span className="font-medium text-foreground">Dirty</span>: {dirty}
            </span>
            {maint > 0 && (
              <span>
                <span className="inline-block size-1.5 rounded-full bg-purple-500 mr-1 align-middle" />
                <span className="font-medium text-foreground">Maint</span>: {maint}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Structured Operational Turnover Rows */}
      <div className="pt-2 border-t border-border/50 space-y-1">
        <div className="flex items-center justify-between text-xs py-1">
          <div className="truncate max-w-[200px]">
            <span className="font-medium text-foreground block truncate">
              Ready for Check-In
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Vacant Clean & Inspected
            </span>
          </div>
          <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {clean} {clean === 1 ? "room" : "rooms"}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs py-1">
          <div className="truncate max-w-[200px]">
            <span className="font-medium text-foreground block truncate">
              Turnover Required
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Vacant Dirty (Housekeeping)
            </span>
          </div>
          <div className="font-mono font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
            {dirty} {dirty === 1 ? "room" : "rooms"}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs py-1">
          <div className="truncate max-w-[200px]">
            <span className="font-medium text-foreground block truncate">
              Out of Order / Maint
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Offline physical capacity
            </span>
          </div>
          <div className="font-mono font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
            {maint} {maint === 1 ? "room" : "rooms"}
          </div>
        </div>
      </div>
    </Link>
  )
}
