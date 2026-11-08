import * as React from "react"
import Link from "next/link"
import { BedDouble } from "lucide-react"
import type { HotelDashboardStats } from "@/modules/dashboard/dashboard.service"

interface RoomInventoryDonutProps {
  counts: HotelDashboardStats
}

interface DonutSlice {
  key: string
  label: string
  count: number
  colorClass: string
  strokeHex: string
  href: string
}

export function RoomInventoryDonut({ counts }: RoomInventoryDonutProps) {
  const total = counts.total
  const occupied = counts.occupied
  const clean = counts.clean
  const dirty = counts.dirty
  const maintenance = counts.maintenance + counts.outOfService

  const occupiedPct = total > 0 ? (occupied / total) * 100 : 0
  const cleanPct = total > 0 ? (clean / total) * 100 : 0
  const dirtyPct = total > 0 ? (dirty / total) * 100 : 0
  const maintPct = total > 0 ? (maintenance / total) * 100 : 0

  // SVG Geometry
  const size = 180
  const strokeWidth = 18
  const radius = (size - strokeWidth) / 2 // 81
  const circumference = 2 * Math.PI * radius // ~508.94

  const rawSlices: DonutSlice[] = [
    {
      key: "OCCUPIED",
      label: "Occupied",
      count: occupied,
      colorClass: "bg-sky-500",
      strokeHex: "var(--color-sky-500, #0284c7)",
      href: "/rooms?status=OCCUPIED",
    },
    {
      key: "VACANT_CLEAN",
      label: "Clean Ready",
      count: clean,
      colorClass: "bg-emerald-500",
      strokeHex: "var(--color-emerald-500, #10b981)",
      href: "/rooms?status=VACANT_CLEAN",
    },
    {
      key: "VACANT_DIRTY",
      label: "Turnover Needed",
      count: dirty,
      colorClass: "bg-amber-500",
      strokeHex: "var(--color-amber-500, #f59e0b)",
      href: "/rooms?status=VACANT_DIRTY",
    },
    {
      key: "MAINTENANCE",
      label: "Maint & OOS",
      count: maintenance,
      colorClass: "bg-purple-500",
      strokeHex: "var(--color-purple-500, #a855f7)",
      href: "/rooms?status=MAINTENANCE",
    },
  ]

  const activeSlices = rawSlices.filter((s) => s.count > 0)
  const segmentGap = activeSlices.length > 1 ? 3 : 0

  let cumulativeFraction = 0
  const svgSegments = activeSlices.map((slice) => {
    const fraction = total > 0 ? slice.count / total : 0
    const rawDash = fraction * circumference
    const dashLength = Math.max(0, rawDash - segmentGap)
    const gapLength = circumference - dashLength
    const offset = -(cumulativeFraction * circumference)
    cumulativeFraction += fraction

    return {
      ...slice,
      dashLength,
      gapLength,
      offset,
      pct: Math.round(fraction * 100),
    }
  })

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs flex flex-col justify-between h-full">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <BedDouble className="size-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Room Inventory</h3>
        </div>
        <Link
          href="/rooms"
          className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors"
        >
          Rack View →
        </Link>
      </div>

      {/* Donut Chart Visual */}
      <div className="flex items-center justify-center py-1">
        <div className="relative size-44 sm:size-48 flex items-center justify-center">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="size-full -rotate-90 transform"
          >
            {/* Background Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              className="text-muted/50"
              strokeWidth={strokeWidth}
            />

            {/* Segment Arcs */}
            {total > 0 &&
              svgSegments.map((seg) => (
                <circle
                  key={seg.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.strokeHex}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${seg.dashLength} ${seg.gapLength}`}
                  strokeDashoffset={seg.offset}
                  className="transition-all duration-500 ease-out"
                />
              ))}
          </svg>

          {/* Center Callout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
            <span className="font-mono text-3xl font-extrabold text-foreground tracking-tight tabular-nums">
              {total}
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
              Total Rooms
            </span>
            <span className="text-[11px] font-mono font-semibold text-primary mt-0.5 tabular-nums">
              {Math.round(occupiedPct)}% occupied
            </span>
          </div>
        </div>
      </div>

      {/* Legend & Quick Navigation */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/60 text-xs">
        <Link
          href="/rooms?status=OCCUPIED"
          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
          title={`${occupied} occupied rooms (${Math.round(occupiedPct)}%)`}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="size-2.5 rounded-full bg-sky-500 shrink-0" />
            <span className="text-muted-foreground group-hover:text-foreground truncate text-xs">
              Occupied
            </span>
          </span>
          <span className="font-mono text-xs font-bold text-foreground tabular-nums ml-1">
            {occupied}
          </span>
        </Link>

        <Link
          href="/rooms?status=VACANT_CLEAN"
          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
          title={`${clean} clean ready rooms (${Math.round(cleanPct)}%)`}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="size-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-muted-foreground group-hover:text-foreground truncate text-xs">
              Clean Ready
            </span>
          </span>
          <span className="font-mono text-xs font-bold text-foreground tabular-nums ml-1">
            {clean}
          </span>
        </Link>

        <Link
          href="/rooms?status=VACANT_DIRTY"
          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
          title={`${dirty} dirty rooms awaiting turnover (${Math.round(dirtyPct)}%)`}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="size-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="text-muted-foreground group-hover:text-foreground truncate text-xs">
              Dirty
            </span>
          </span>
          <span className="font-mono text-xs font-bold text-foreground tabular-nums ml-1">
            {dirty}
          </span>
        </Link>

        <Link
          href="/rooms?status=MAINTENANCE"
          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
          title={`${maintenance} rooms in maintenance or out of service (${Math.round(maintPct)}%)`}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="size-2.5 rounded-full bg-purple-500 shrink-0" />
            <span className="text-muted-foreground group-hover:text-foreground truncate text-xs">
              Maint & OOS
            </span>
          </span>
          <span className="font-mono text-xs font-bold text-foreground tabular-nums ml-1">
            {maintenance}
          </span>
        </Link>
      </div>
    </div>
  )
}
