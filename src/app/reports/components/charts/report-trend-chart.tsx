"use client"

import * as React from "react"
import { formatMoney, formatCompactMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"

export interface TrendDataPoint {
  date: string
  label?: string
  value: number
  secondaryValue?: number
}

export interface ReportTrendChartProps {
  title?: string
  subtitle?: string
  data: TrendDataPoint[]
  series1Name?: string
  series1Color?: string
  series1IsMoney?: boolean
  series1Suffix?: string
  series2Name?: string
  series2Color?: string
  series2IsMoney?: boolean
  series2Suffix?: string
  height?: number
  className?: string
}

function formatTickDate(dateStr: string, spansMultipleYears = false): string {
  try {
    const parts = dateStr.split("-")
    if (parts.length === 3) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const year = parts[0]!
      const mIdx = parseInt(parts[1]!, 10) - 1
      const day = parseInt(parts[2]!, 10)
      if (mIdx >= 0 && mIdx < 12) {
        if (spansMultipleYears) {
          return `${monthNames[mIdx]} '${year.slice(2)}`
        }
        return `${monthNames[mIdx]} ${day < 10 ? "0" + day : day}`
      }
    }
  } catch {
    // fallback
  }
  return dateStr
}

function formatFullDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00Z`)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    }
  } catch {
    // fallback
  }
  return dateStr
}

export function ReportTrendChart({
  title,
  subtitle,
  data,
  series1Name = "Cash Inflows",
  series1Color = "#10b981", // Emerald
  series1IsMoney = true,
  series1Suffix = "",
  series2Name = "Operating Outflows",
  series2Color = "#f43f5e", // Rose
  series2IsMoney = true,
  series2Suffix = "",
  height = 240,
  className,
}: ReportTrendChartProps) {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)
  const svgRef = React.useRef<SVGSVGElement | null>(null)

  const spansMultipleYears = React.useMemo(() => {
    if (!data || data.length < 2) return false
    const firstYear = data[0]?.date?.split("-")[0]
    const lastYear = data[data.length - 1]?.date?.split("-")[0]
    return Boolean(firstYear && lastYear && firstYear !== lastYear)
  }, [data])

  if (!data || data.length === 0) {
    return (
      <div className={cn("rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs", className)}>
        {title && <h3 className="font-semibold text-xs sm:text-sm text-foreground mb-1">{title}</h3>}
        <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">
          No transaction trajectory recorded for this period.
        </div>
      </div>
    )
  }

  // Dimensions
  const viewBoxWidth = 640
  const viewBoxHeight = height
  const paddingLeft = 54
  const paddingRight = 24
  const paddingTop = 24
  const paddingBottom = 32
  const plotWidth = viewBoxWidth - paddingLeft - paddingRight
  const plotHeight = viewBoxHeight - paddingTop - paddingBottom
  const baselineY = paddingTop + plotHeight

  // Range and Scales
  const hasSeries2 = Boolean(series2Name && data.some((d) => d.secondaryValue !== undefined))
  const s1Values = data.map((d) => d.value)
  const s2Values = hasSeries2 ? data.map((d) => d.secondaryValue ?? 0) : []
  const allValues = [...s1Values, ...s2Values]

  const maxValRaw = Math.max(100, ...allValues)
  // Round up max to a clean multiple
  const maxVal = maxValRaw > 0 ? maxValRaw * 1.08 : 100
  const minVal = 0
  const range = maxVal - minVal || 1

  // Point Mapping
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth / 2
  const pointsS1 = data.map((d, i) => {
    const x = paddingLeft + (data.length > 1 ? i * stepX : plotWidth / 2)
    const norm = (d.value - minVal) / range
    const y = baselineY - norm * plotHeight
    return { x, y }
  })

  const pointsS2 = hasSeries2
    ? data.map((d, i) => {
        const x = paddingLeft + (data.length > 1 ? i * stepX : plotWidth / 2)
        const val = d.secondaryValue ?? 0
        const norm = (val - minVal) / range
        const y = baselineY - norm * plotHeight
        return { x, y }
      })
    : []

  // SVG Paths (Strictly Line Only — NO AREA FILL)
  const pathS1 = pointsS1.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
  const pathS2 = hasSeries2
    ? pointsS2.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
    : ""

  // Intelligent X-axis tick indices selection to prevent overlaps
  const tickIndices: number[] = []
  if (data.length <= 8) {
    for (let i = 0; i < data.length; i++) tickIndices.push(i)
  } else if (data.length <= 15) {
    for (let i = 0; i < data.length; i += 2) tickIndices.push(i)
    if (tickIndices[tickIndices.length - 1] !== data.length - 1) {
      tickIndices.push(data.length - 1)
    }
  } else {
    const tickCount = 5
    for (let i = 0; i < tickCount; i++) {
      const idx = Math.min(data.length - 1, Math.round((i / (tickCount - 1)) * (data.length - 1)))
      if (!tickIndices.includes(idx)) tickIndices.push(idx)
    }
  }

  // Y-axis grid levels (4 horizontal lines)
  const yTicks = [0, 0.33, 0.66, 1.0].map((pct) => {
    const val = minVal + pct * (maxVal - minVal)
    const y = baselineY - pct * plotHeight
    return { val, y }
  })

  // Handle Mouse Hover
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || data.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const svgX = (mouseX / rect.width) * viewBoxWidth

    let closestIdx = 0
    let closestDist = Infinity
    for (let i = 0; i < data.length; i++) {
      const ptX = paddingLeft + (data.length > 1 ? i * stepX : plotWidth / 2)
      const dist = Math.abs(svgX - ptX)
      if (dist < closestDist) {
        closestDist = dist
        closestIdx = i
      }
    }
    setHoverIndex(closestIdx)
  }

  const handleMouseLeave = () => {
    setHoverIndex(null)
  }

  const activePoint = hoverIndex !== null ? data[hoverIndex] : null
  const activePtS1 = hoverIndex !== null ? pointsS1[hoverIndex] : null
  const activePtS2 = hoverIndex !== null && hasSeries2 ? pointsS2[hoverIndex] : null

  // Tooltip position (keep within SVG bounds)
  const tooltipWidth = 190
  const tooltipHeight = hasSeries2 ? 85 : 65
  let tooltipX = (activePtS1?.x ?? 0) + 12
  let tooltipY = (activePtS1?.y ?? 0) - tooltipHeight / 2
  if (tooltipX + tooltipWidth > viewBoxWidth - 8) {
    tooltipX = (activePtS1?.x ?? 0) - tooltipWidth - 12
  }
  if (tooltipY < paddingTop) {
    tooltipY = paddingTop + 4
  } else if (tooltipY + tooltipHeight > baselineY) {
    tooltipY = baselineY - tooltipHeight - 4
  }

  return (
    <div className={cn("rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs space-y-3", className)}>
      {/* Header with Title and Series Legends */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div>
          {title && <h3 className="font-semibold text-xs sm:text-sm text-foreground">{title}</h3>}
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] font-medium">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: series1Color }} />
            <span className="text-muted-foreground">{series1Name}</span>
          </div>
          {hasSeries2 && (
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: series2Color }} />
              <span className="text-muted-foreground">{series2Name}</span>
            </div>
          )}
        </div>
      </div>

      {/* SVG Line Chart (Transparent Background, ZERO Black Area Fill) */}
      <div className="w-full overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-auto cursor-crosshair select-none overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Horizontal Grid Lines & Y Ticks */}
          {yTicks.map((yt, idx) => (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={yt.y}
                x2={paddingLeft + plotWidth}
                y2={yt.y}
                stroke="currentColor"
                className="text-border/60"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={paddingLeft - 8}
                y={yt.y + 3.5}
                textAnchor="end"
                className="text-[10px] font-mono fill-muted-foreground font-medium"
              >
                {formatCompactMoney(yt.val)}
              </text>
            </g>
          ))}

          {/* X Axis Baseline */}
          <line
            x1={paddingLeft}
            y1={baselineY}
            x2={paddingLeft + plotWidth}
            y2={baselineY}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />

          {/* X Axis Date Labels */}
          {tickIndices.map((i) => {
            const pt = pointsS1[i]
            const d = data[i]
            if (!pt || !d) return null
            return (
              <text
                key={i}
                x={pt.x}
                y={baselineY + 16}
                textAnchor="middle"
                className="text-[10px] font-mono fill-muted-foreground"
              >
                {formatTickDate(d.date, spansMultipleYears)}
              </text>
            )
          })}

          {/* All values zero state notice */}
          {allValues.length > 0 && allValues.every((v) => v === 0) && (
            <text
              x={paddingLeft + plotWidth / 2}
              y={paddingTop + plotHeight / 2}
              textAnchor="middle"
              className="text-xs font-mono fill-muted-foreground/70"
            >
              Zero balance activity in this range
            </text>
          )}

          {/* Single-day visualization (vertical stem markers when range contains 1 day) */}
          {data.length === 1 && (
            <>
              <line
                x1={pointsS1[0].x - (hasSeries2 ? 10 : 0)}
                y1={baselineY}
                x2={pointsS1[0].x - (hasSeries2 ? 10 : 0)}
                y2={pointsS1[0].y}
                stroke={series1Color}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <circle
                cx={pointsS1[0].x - (hasSeries2 ? 10 : 0)}
                cy={pointsS1[0].y}
                r={5}
                fill={series1Color}
                stroke="var(--card)"
                strokeWidth={2}
              />
              {hasSeries2 && pointsS2[0] && (
                <>
                  <line
                    x1={pointsS2[0].x + 10}
                    y1={baselineY}
                    x2={pointsS2[0].x + 10}
                    y2={pointsS2[0].y}
                    stroke={series2Color}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                  <circle
                    cx={pointsS2[0].x + 10}
                    cy={pointsS2[0].y}
                    r={5}
                    fill={series2Color}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                </>
              )}
            </>
          )}

          {/* Multi-day Line Series (fill="none" explicitly, only when data.length > 1) */}
          {data.length > 1 && (
            <>
              <path
                d={pathS1}
                fill="none"
                stroke={series1Color}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {hasSeries2 && pathS2 && (
                <path
                  d={pathS2}
                  fill="none"
                  stroke={series2Color}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </>
          )}

          {/* Data Points Dots for multi-day ranges */}
          {data.length > 1 && data.length <= 31 && (
            <>
              {pointsS1.map((p, i) => (
                <circle
                  key={`s1-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={2.5}
                  fill="var(--card)"
                  stroke={series1Color}
                  strokeWidth={1.75}
                />
              ))}
              {hasSeries2 &&
                pointsS2.map((p, i) => (
                  <circle
                    key={`s2-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={2.5}
                    fill="var(--card)"
                    stroke={series2Color}
                    strokeWidth={1.75}
                  />
                ))}
            </>
          )}

          {/* Hover Crosshair and Highlights */}
          {hoverIndex !== null && activePtS1 && activePoint && (
            <g className="pointer-events-none transition-all duration-75">
              {/* Vertical Guideline */}
              <line
                x1={activePtS1.x}
                y1={paddingTop}
                x2={activePtS1.x}
                y2={baselineY}
                stroke="currentColor"
                className="text-foreground/40"
                strokeWidth={1}
                strokeDasharray="2 2"
              />

              {/* Active Highlight Circles */}
              <circle
                cx={activePtS1.x}
                cy={activePtS1.y}
                r={4.5}
                fill={series1Color}
                stroke="var(--card)"
                strokeWidth={2}
              />
              {hasSeries2 && activePtS2 && (
                <circle
                  cx={activePtS2.x}
                  cy={activePtS2.y}
                  r={4.5}
                  fill={series2Color}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              )}

              {/* Interactive Floating Tooltip (SVG ForeignObject for rich HTML formatting) */}
              <foreignObject
                x={tooltipX}
                y={tooltipY}
                width={tooltipWidth}
                height={tooltipHeight}
                className="overflow-visible"
              >
                <div className="rounded-lg border border-border bg-popover/95 backdrop-blur-xs p-2 text-popover-foreground shadow-md text-xs space-y-1">
                  <div className="font-mono text-[10px] text-muted-foreground border-b border-border/50 pb-0.5">
                    {formatFullDate(activePoint.date)}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                      <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: series1Color }} />
                      {series1Name}
                    </span>
                    <span className="font-mono font-semibold text-[11px] text-foreground tabular-nums">
                      {series1IsMoney ? formatMoney(activePoint.value) : `${activePoint.value}${series1Suffix}`}
                    </span>
                  </div>
                  {hasSeries2 && activePoint.secondaryValue !== undefined && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                        <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: series2Color }} />
                        {series2Name}
                      </span>
                      <span className="font-mono font-semibold text-[11px] text-foreground tabular-nums">
                        {series2IsMoney ? formatMoney(activePoint.secondaryValue) : `${activePoint.secondaryValue}${series2Suffix}`}
                      </span>
                    </div>
                  )}
                  {hasSeries2 && activePoint.secondaryValue !== undefined && (
                    <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-border/40 text-[10px]">
                      <span className="text-muted-foreground">Net Position:</span>
                      <span
                        className={cn(
                          "font-mono font-semibold tabular-nums",
                          activePoint.value - activePoint.secondaryValue >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {formatMoney(activePoint.value - activePoint.secondaryValue)}
                      </span>
                    </div>
                  )}
                </div>
              </foreignObject>
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}
