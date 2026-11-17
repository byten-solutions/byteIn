"use client"

import * as React from "react"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"

export interface RatioSegment {
  label: string
  value: number
  color?: string
  count?: number
}

export interface ReportRatioBarProps {
  label?: string
  segments: RatioSegment[]
  isMoney?: boolean
  className?: string
}

const DEFAULT_SEGMENT_COLORS = [
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#f59e0b", // Amber
  "#ef4444", // Rose
]

export function ReportRatioBar({
  label,
  segments,
  isMoney = false,
  className,
}: ReportRatioBarProps) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0)

  if (total <= 0) return null

  return (
    <div className={cn("space-y-1.5 w-full", className)}>
      {label && (
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span>{label}</span>
          <span className="font-mono text-[11px] tabular-nums">
            {isMoney ? formatMoney(total) : total}
          </span>
        </div>
      )}

      {/* Segmented bar */}
      <div className="h-2 w-full rounded-full bg-muted/60 flex overflow-hidden gap-0.5">
        {segments.map((s, idx) => {
          if (s.value <= 0) return null
          const pct = Math.max(1, (s.value / total) * 100)
          const color = s.color || DEFAULT_SEGMENT_COLORS[idx % DEFAULT_SEGMENT_COLORS.length]
          return (
            <div
              key={idx}
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                backgroundColor: color,
              }}
              title={`${s.label}: ${pct.toFixed(1)}% (${isMoney ? formatMoney(s.value) : s.value})`}
            />
          )
        })}
      </div>

      {/* Segment legend / labels */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 text-[11px] text-muted-foreground pt-0.5">
        {segments.map((s, idx) => {
          const pct = Math.round((s.value / total) * 100)
          const color = s.color || DEFAULT_SEGMENT_COLORS[idx % DEFAULT_SEGMENT_COLORS.length]
          return (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="font-medium text-foreground">{s.label}:</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {isMoney ? formatMoney(s.value) : s.value} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
