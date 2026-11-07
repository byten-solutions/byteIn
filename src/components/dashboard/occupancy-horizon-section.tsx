import * as React from "react"
import Link from "next/link"
import { TrendingUp, ArrowUpRight } from "lucide-react"
import { ReportsService } from "@/modules/reports/reports.service"
import { getHotelTodayDate, getHotelTodayDateUtc } from "@/lib/date"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface OccupancyHorizonSectionProps {
  propertyId?: string
}

function formatDayLabel(
  dateStr: string,
  isToday: boolean,
  dayOfWeek: string
): { label: string; dateSubtext: string } {
  const parts = dateStr.split("-")
  const day = parts[2]
  const monthIndex = parseInt(parts[1] || "1", 10) - 1
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  return {
    label: isToday ? "Today" : dayOfWeek.slice(0, 3),
    dateSubtext: `${day} ${months[monthIndex]}`,
  }
}

export async function OccupancyHorizonSection({ propertyId }: OccupancyHorizonSectionProps) {
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
  }> = []

  try {
    const report = await ReportsService.getOccupancyReport({
      startDate: todayStr,
      endDate: endDateStr,
      propertyId,
    })
    dailyBreakdown = report.dailyBreakdown
  } catch (err) {
    console.error("Failed to load 7-day occupancy horizon:", err)
  }

  if (dailyBreakdown.length === 0) {
    return null
  }

  const rates = dailyBreakdown.map((d) => d.occupancyRate)
  const avgOccupancy = Math.round(rates.reduce((a, b) => a + b, 0) / (rates.length || 1))
  const peakDay = dailyBreakdown.reduce(
    (best, cur) => (cur.occupancyRate > best.occupancyRate ? cur : best),
    dailyBreakdown[0]!
  )
  const totalOccupiedNights = dailyBreakdown.reduce((acc, d) => acc + d.occupiedRooms, 0)

  // Clamp avg benchmark line position between 10% and 90%
  const avgLinePosition = Math.min(90, Math.max(10, avgOccupancy))

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">7-Day Occupancy Horizon</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono flex-wrap">
          <span>
            <strong className="text-foreground font-bold tabular-nums">{avgOccupancy}%</strong> 7-day avg
          </span>
          <span className="text-muted-foreground/40 select-none" aria-hidden="true">
            ·
          </span>
          <span>
            Peak:{" "}
            <strong className="text-foreground font-bold">
              {peakDay.dayOfWeek.slice(0, 3)} ({peakDay.occupancyRate}%)
            </strong>
          </span>
          <span className="text-muted-foreground/40 select-none" aria-hidden="true">
            ·
          </span>
          <span>
            <strong className="text-foreground font-bold tabular-nums">{totalOccupiedNights}</strong>{" "}
            room nights
          </span>
          <span className="text-muted-foreground/40 select-none" aria-hidden="true">
            ·
          </span>
          <Link
            href="/reports?tab=performance"
            className="text-primary hover:underline font-sans text-xs inline-flex items-center gap-0.5"
          >
            <span>Full Report</span>
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* 7-Day Chart Stage with Benchmark Average Line */}
      <div className="relative pt-2 pb-1">
        {/* Average Benchmark Dashed Line */}
        {avgOccupancy > 0 && (
          <div
            className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
            style={{ bottom: `calc(48px + ${avgLinePosition * 0.72}px)` }}
          >
            <div className="w-full border-t border-dashed border-primary/40 dark:border-primary/50" />
            <span className="shrink-0 ml-1 font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Avg {avgOccupancy}%
            </span>
          </div>
        )}

        {/* 7-Column Mini Bar Chart */}
        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {dailyBreakdown.map((d, index) => {
            const isToday = index === 0
            const rate = Math.min(100, Math.max(0, d.occupancyRate))
            const { label, dateSubtext } = formatDayLabel(d.date, isToday, d.dayOfWeek)

            // Color tokens based on occupancy level
            const barColor =
              rate >= 80
                ? "bg-emerald-500 dark:bg-emerald-400 group-hover:bg-emerald-600"
                : rate >= 50
                  ? "bg-primary group-hover:bg-primary/90"
                  : "bg-muted-foreground/25 dark:bg-muted-foreground/35 group-hover:bg-muted-foreground/45"

            // Minimum bar height so 0% has an anchor baseline line (4px)
            const barHeightPercent = Math.max(5, Math.round(rate))

            return (
              <div key={d.date} className="flex flex-col items-center gap-1.5 group cursor-default">
                {/* Rate Label Above Column */}
                <span className="font-mono text-[11px] font-bold text-foreground tabular-nums">
                  {rate}%
                </span>

                {/* Vertical Column Track (height: 88px) */}
                <div className="w-full max-w-12 h-24 rounded-lg bg-muted/40 p-1 flex items-end justify-center transition-colors group-hover:bg-muted/70">
                  <div
                    className={cn(
                      "w-full rounded-md transition-all duration-300",
                      barColor
                    )}
                    style={{ height: `${barHeightPercent}%` }}
                    title={`${d.dayOfWeek} (${d.date}): ${rate}% occupied (${d.occupiedRooms}/${d.totalRooms} rooms)`}
                  />
                </div>

                {/* Day & Date Labels */}
                <div className="text-center w-full min-w-0">
                  <span
                    className={cn(
                      "text-xs font-semibold block truncate",
                      isToday ? "text-primary font-bold" : "text-foreground"
                    )}
                  >
                    {label}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground block truncate tabular-nums">
                    {dateSubtext}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/80 block truncate tabular-nums mt-0.5">
                    {d.occupiedRooms}/{d.totalRooms}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function OccupancyHorizonSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs h-full flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-60" />
      </div>
      <div className="grid grid-cols-7 gap-2 sm:gap-3 pt-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="w-full max-w-12 h-24 rounded-lg" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
