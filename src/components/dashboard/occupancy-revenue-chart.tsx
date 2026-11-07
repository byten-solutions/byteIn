import * as React from "react"
import Link from "next/link"
import { TrendingUp, ArrowUpRight } from "lucide-react"
import { ReportsService } from "@/modules/reports/reports.service"
import { getHotelTodayDate, getHotelTodayDateUtc } from "@/lib/date"
import { formatMoney } from "@/lib/currency"
import { Skeleton } from "@/components/ui/skeleton"

interface OccupancyRevenueChartProps {
  propertyId?: string
}

function formatCompactMoney(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}k`
  return `₹${Math.round(amount)}`
}

function createSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ""
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = points[Math.min(points.length - 1, i + 2)]!

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

export async function OccupancyRevenueChart({ propertyId }: OccupancyRevenueChartProps) {
  const todayStr = getHotelTodayDate()
  const todayUtc = getHotelTodayDateUtc()
  const endDateUtc = new Date(todayUtc.getTime() + 6 * 24 * 60 * 60 * 1000)
  const endDateStr = endDateUtc.toISOString().split("T")[0]!

  let dailyBreakdown: Array<{
    date: string
    dayOfWeek: string
    totalRooms: number
    occupiedRooms: number
    occupancyRate: number
    roomRevenue: string
  }> = []

  try {
    const report = await ReportsService.getOccupancyReport({
      startDate: todayStr,
      endDate: endDateStr,
      propertyId,
    })
    dailyBreakdown = report.dailyBreakdown
  } catch (err) {
    console.error("Failed to load occupancy and revenue report:", err)
  }

  if (dailyBreakdown.length === 0) {
    return null
  }

  const rates = dailyBreakdown.map((d) => d.occupancyRate)
  const revenues = dailyBreakdown.map((d) => parseFloat(d.roomRevenue) || 0)
  const avgOccupancy = Math.round(rates.reduce((a, b) => a + b, 0) / (rates.length || 1))
  const totalRevenue = revenues.reduce((a, b) => a + b, 0)
  const maxRevenue = Math.max(1, ...revenues)

  // Chart Dimensions in viewBox coordinate space
  const viewBoxWidth = 600
  const viewBoxHeight = 180
  const paddingLeft = 36
  const paddingRight = 36
  const paddingTop = 20
  const paddingBottom = 28
  const plotWidth = viewBoxWidth - paddingLeft - paddingRight
  const plotHeight = viewBoxHeight - paddingTop - paddingBottom
  const baselineY = paddingTop + plotHeight

  // Generate Point Coordinates for Occupancy (0% to 100%)
  const stepX = dailyBreakdown.length > 1 ? plotWidth / (dailyBreakdown.length - 1) : 0
  const occupancyPoints = dailyBreakdown.map((d, i) => {
    const x = paddingLeft + i * stepX
    const rateNorm = Math.min(100, Math.max(0, d.occupancyRate)) / 100
    const y = paddingTop + (1 - rateNorm) * plotHeight
    return { x, y, rate: d.occupancyRate, date: d.date, dayOfWeek: d.dayOfWeek }
  })

  // Generate Point Coordinates for Revenue
  const revenuePoints = dailyBreakdown.map((d, i) => {
    const x = paddingLeft + i * stepX
    const rev = parseFloat(d.roomRevenue) || 0
    const revNorm = maxRevenue > 0 ? rev / maxRevenue : 0
    const y = paddingTop + (1 - revNorm) * plotHeight
    return { x, y, revenue: rev }
  })

  const occupancyLine = createSmoothPath(occupancyPoints)
  const revenueLine = createSmoothPath(revenuePoints)

  const firstX = occupancyPoints[0]?.x ?? paddingLeft
  const lastX = occupancyPoints[occupancyPoints.length - 1]?.x ?? viewBoxWidth - paddingRight

  const occupancyArea = occupancyLine
    ? `${occupancyLine} L ${lastX.toFixed(1)} ${baselineY.toFixed(1)} L ${firstX.toFixed(1)} ${baselineY.toFixed(1)} Z`
    : ""

  const revenueArea = revenueLine
    ? `${revenueLine} L ${lastX.toFixed(1)} ${baselineY.toFixed(1)} L ${firstX.toFixed(1)} ${baselineY.toFixed(1)} Z`
    : ""

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs flex flex-col justify-between h-full">
      {/* Header & Metric Callouts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Occupancy & Revenue Trend</h3>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            7-Day Outlook · Average:{" "}
            <strong className="text-foreground font-bold tabular-nums">{avgOccupancy}%</strong> · Total
            Revenue:{" "}
            <strong className="text-foreground font-bold tabular-nums">
              {formatMoney(totalRevenue)}
            </strong>
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-sky-500 shrink-0" />
            <span className="text-foreground">Occupancy Rate</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-foreground">Room Revenue</span>
          </span>
          <Link
            href="/reports?tab=performance"
            className="text-primary hover:underline text-xs inline-flex items-center gap-0.5 ml-1"
          >
            <span>Full Report</span>
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Smooth SVG Spline Chart */}
      <div className="relative w-full pt-1">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-44 sm:h-48 overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Occupancy Gradient */}
            <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>

            {/* Revenue Gradient */}
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Dotted Horizontal Grid Guidelines (0%, 25%, 50%, 75%, 100%) */}
          {[0, 0.25, 0.5, 0.75, 1].map((norm) => {
            const y = paddingTop + (1 - norm) * plotHeight
            return (
              <g key={norm}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={viewBoxWidth - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  strokeDasharray="3 3"
                  className="text-border/60"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground/60 text-[9px] font-mono tabular-nums"
                >
                  {Math.round(norm * 100)}%
                </text>
                <text
                  x={viewBoxWidth - paddingRight + 6}
                  y={y + 3}
                  textAnchor="start"
                  className="fill-emerald-600/70 dark:fill-emerald-400/70 text-[9px] font-mono tabular-nums"
                >
                  {formatCompactMoney(norm * maxRevenue)}
                </text>
              </g>
            )
          })}

          {/* Area Fills */}
          {occupancyArea && <path d={occupancyArea} fill="url(#occupancyGradient)" />}
          {revenueArea && <path d={revenueArea} fill="url(#revenueGradient)" />}

          {/* Spline Lines */}
          {revenueLine && (
            <path
              d={revenueLine}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}
          {occupancyLine && (
            <path
              d={occupancyLine}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}

          {/* Data Points on Curves */}
          {occupancyPoints.map((pt, i) => (
            <g key={`occ-pt-${i}`} className="cursor-pointer group">
              <circle
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#0284c7"
                stroke="var(--card, #ffffff)"
                strokeWidth="1.5"
                className="transition-transform group-hover:scale-125"
              />
              <title>{`${pt.dayOfWeek} (${pt.date}): ${pt.rate}% occupancy`}</title>
            </g>
          ))}

          {revenuePoints.map((pt, i) => (
            <g key={`rev-pt-${i}`} className="cursor-pointer group">
              <circle
                cx={pt.x}
                cy={pt.y}
                r="3"
                fill="#10b981"
                stroke="var(--card, #ffffff)"
                strokeWidth="1.5"
                className="transition-transform group-hover:scale-125"
              />
              <title>{`Revenue: ${formatMoney(pt.revenue)}`}</title>
            </g>
          ))}
        </svg>

        {/* X-Axis Labels (Day of week & dates) */}
        <div className="grid grid-cols-7 gap-1 pt-1.5 border-t border-border/40 text-center">
          {dailyBreakdown.map((d, index) => {
            const isToday = index === 0
            const parts = d.date.split("-")
            const dayNum = parts[2]
            const monthIdx = parseInt(parts[1] || "1", 10) - 1
            const dateStr = `${dayNum} ${months[monthIdx]}`

            return (
              <div key={d.date} className="space-y-0.5">
                <span
                  className={`text-xs block font-semibold truncate ${
                    isToday ? "text-primary font-bold" : "text-foreground"
                  }`}
                >
                  {isToday ? "Today" : d.dayOfWeek.slice(0, 3)}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground block truncate tabular-nums">
                  {dateStr}
                </span>
                <span className="text-[10px] font-mono font-medium text-foreground/80 block tabular-nums">
                  {Math.round(d.occupancyRate)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function OccupancyRevenueSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs h-full flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-52" />
      </div>
      <div className="h-44 sm:h-48 flex items-center justify-center">
        <Skeleton className="h-36 w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-7 gap-1 pt-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-2.5 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}
