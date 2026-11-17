"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Printer,
  RefreshCw,
  Building2,
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getHotelTodayDate } from "@/lib/date"
import { cn } from "@/lib/utils"

export interface PropertyOption {
  id: string
  name: string
  city?: string | null
  status?: string
}

function getPresetRanges(todayStr: string) {
  const [yStr, mStr, dStr] = todayStr.split("-")
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  const d = parseInt(dStr, 10)
  const pad = (n: number) => String(n).padStart(2, "0")
  const fmt = (year: number, month: number, day: number) =>
    `${year}-${pad(month)}-${pad(day)}`

  // Today
  const todayRange = { start: todayStr, end: todayStr }

  // Yesterday
  const yesterdayDate = new Date(Date.UTC(y, m - 1, d - 1))
  const yesterdayStr = fmt(
    yesterdayDate.getUTCFullYear(),
    yesterdayDate.getUTCMonth() + 1,
    yesterdayDate.getUTCDate()
  )
  const yesterdayRange = { start: yesterdayStr, end: yesterdayStr }

  // This Month: 1st of current month through today
  const thisMonthRange = { start: `${yStr}-${mStr}-01`, end: todayStr }

  // Last Month: 1st of last month through last day of last month
  const lastMonthStartDate = new Date(Date.UTC(y, m - 2, 1))
  const lastMonthEndDate = new Date(Date.UTC(y, m - 1, 0))
  const lastMonthRange = {
    start: fmt(
      lastMonthStartDate.getUTCFullYear(),
      lastMonthStartDate.getUTCMonth() + 1,
      lastMonthStartDate.getUTCDate()
    ),
    end: fmt(
      lastMonthEndDate.getUTCFullYear(),
      lastMonthEndDate.getUTCMonth() + 1,
      lastMonthEndDate.getUTCDate()
    ),
  }

  // Past 30 Days: (today - 29 days) through today
  const past30Date = new Date(Date.UTC(y, m - 1, d - 29))
  const past30Str = fmt(
    past30Date.getUTCFullYear(),
    past30Date.getUTCMonth() + 1,
    past30Date.getUTCDate()
  )
  const past30Range = { start: past30Str, end: todayStr }

  return {
    today: todayRange,
    yesterday: yesterdayRange,
    this_month: thisMonthRange,
    last_month: lastMonthRange,
    last_30_days: past30Range,
  }
}

export interface ReportPageShellProps {
  title: string
  subtitle: string
  category: string
  categoryHref: string
  reportType?: string
  properties?: PropertyOption[]
  initialPropertyId?: string
  activePropertyId?: string
  isSuperAdmin: boolean
  dateMode?: "range" | "single" | "none"
  initialStartDate?: string
  initialEndDate?: string
  initialSingleDate?: string
  refreshTrigger?: number
  onRefresh: () => void
  children: (props: {
    startDate: string
    endDate: string
    singleDate: string
    propertyId?: string
    refreshTrigger: number
  }) => React.ReactNode
}

export function ReportPageShell({
  title,
  subtitle,
  category,
  categoryHref,
  reportType = "report",
  properties = [],
  initialPropertyId,
  activePropertyId,
  isSuperAdmin,
  dateMode = "range",
  initialStartDate,
  initialEndDate,
  initialSingleDate,
  refreshTrigger = 0,
  onRefresh,
  children,
}: ReportPageShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const todayStr = getHotelTodayDate()
  const [y, m] = todayStr.split("-")
  const defaultMonthStart = `${y}-${m}-01`

  const [startDate, setStartDate] = React.useState<string>(
    initialStartDate || defaultMonthStart
  )
  const [endDate, setEndDate] = React.useState<string>(initialEndDate || todayStr)
  const [singleDate, setSingleDate] = React.useState<string>(
    initialSingleDate || todayStr
  )
  const [propertyId, setPropertyId] = React.useState<string | undefined>(
    activePropertyId || initialPropertyId || (isSuperAdmin && properties.length > 0 ? properties[0]?.id : undefined)
  )

  const presetRanges = React.useMemo(() => getPresetRanges(todayStr), [todayStr])

  // Active preset determination
  const activeRangePreset: "today" | "this_month" | "last_month" | "last_30_days" | null =
    React.useMemo(() => {
      if (startDate === presetRanges.today.start && endDate === presetRanges.today.end) return "today"
      if (startDate === presetRanges.this_month.start && endDate === presetRanges.this_month.end) return "this_month"
      if (startDate === presetRanges.last_month.start && endDate === presetRanges.last_month.end) return "last_month"
      if (startDate === presetRanges.last_30_days.start && endDate === presetRanges.last_30_days.end) return "last_30_days"
      return null
    }, [startDate, endDate, presetRanges])

  const updateUrlDateParams = React.useCallback(
    (updates: { startDate?: string; endDate?: string; date?: string }) => {
      const sp = new URLSearchParams(searchParams?.toString() || "")
      if (updates.startDate) {
        sp.set("startDate", updates.startDate)
        sp.set("from", updates.startDate)
      }
      if (updates.endDate) {
        sp.set("endDate", updates.endDate)
        sp.set("to", updates.endDate)
      }
      if (updates.date) sp.set("date", updates.date)
      router.replace(`/reports/${reportType}?${sp.toString()}`, { scroll: false })
    },
    [router, reportType, searchParams]
  )

  // Adjust state during render when URL searchParams change
  const spStart = searchParams?.get("startDate") || searchParams?.get("from")
  const spEnd = searchParams?.get("endDate") || searchParams?.get("to")
  const spDate = searchParams?.get("date")

  const [prevSpStart, setPrevSpStart] = React.useState(spStart)
  if (spStart !== prevSpStart) {
    setPrevSpStart(spStart)
    if (spStart && /^\d{4}-\d{2}-\d{2}$/.test(spStart)) {
      setStartDate(spStart)
    }
  }

  const [prevSpEnd, setPrevSpEnd] = React.useState(spEnd)
  if (spEnd !== prevSpEnd) {
    setPrevSpEnd(spEnd)
    if (spEnd && /^\d{4}-\d{2}-\d{2}$/.test(spEnd)) {
      setEndDate(spEnd)
    }
  }

  const [prevSpDate, setPrevSpDate] = React.useState(spDate)
  if (spDate !== prevSpDate) {
    setPrevSpDate(spDate)
    if (spDate && /^\d{4}-\d{2}-\d{2}$/.test(spDate)) {
      setSingleDate(spDate)
    }
  }

  const spProp = searchParams?.get("propertyId")
  const [prevSpProp, setPrevSpProp] = React.useState(spProp)
  if (spProp !== prevSpProp) {
    setPrevSpProp(spProp)
    if (spProp) {
      setPropertyId(spProp)
    }
  }

  // Handlers for date changes that propagate to both state and URL
  const handleStartDateChange = (val: string) => {
    setStartDate(val)
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      let effectiveEnd = endDate
      if (endDate && val > endDate) {
        effectiveEnd = val
        setEndDate(val)
      }
      updateUrlDateParams({ startDate: val, endDate: effectiveEnd })
    }
  }

  const handleEndDateChange = (val: string) => {
    setEndDate(val)
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      let effectiveStart = startDate
      if (startDate && val < startDate) {
        effectiveStart = val
        setStartDate(val)
      }
      updateUrlDateParams({ startDate: effectiveStart, endDate: val })
    }
  }

  const handleSingleDateChange = (val: string) => {
    setSingleDate(val)
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      updateUrlDateParams({ date: val })
    }
  }

  // Quick preset dates
  const handlePreset = (preset: "today" | "this_month" | "last_month" | "last_30_days") => {
    const range = presetRanges[preset]
    if (range) {
      setStartDate(range.start)
      setEndDate(range.end)
      setSingleDate(range.start)
      updateUrlDateParams({ startDate: range.start, endDate: range.end, date: range.start })
    }
  }

  const handlePropertyChange = (newPropertyId: string) => {
    setPropertyId(newPropertyId)
    const sp = new URLSearchParams(searchParams?.toString() || "")
    sp.set("propertyId", newPropertyId)
    router.replace(`/reports/${reportType}?${sp.toString()}`)
  }

  const selectedProperty = properties.find((p) => p.id === propertyId)

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Breadcrumb & Header Bar */}
      <div className="space-y-1.5 border-b border-border pb-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono print:hidden">
          <Link href="/reports" className="hover:text-foreground transition-colors">
            Reports
          </Link>
          <ChevronRight className="size-3 text-muted-foreground/60" />
          <Link href={categoryHref} className="hover:text-foreground transition-colors">
            {category}
          </Link>
          <ChevronRight className="size-3 text-muted-foreground/60" />
          <span className="text-foreground font-semibold">{title}</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground print:text-xl print:font-bold">
              {title}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl print:text-neutral-600 print:text-[11px]">
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <Printer className="size-3.5" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Standard Filter Toolbar */}
      <div className="flex flex-col gap-2.5 bg-muted/20 border border-border/80 rounded-xl p-2.5 sm:p-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Property Context Selector for Super Admin */}
            {isSuperAdmin && properties.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Property:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 border-border/80 font-medium max-w-[220px]"
                      >
                        <Building2 className="size-3.5 text-primary shrink-0" />
                        <span className="truncate">
                          {selectedProperty
                            ? selectedProperty.city
                              ? `${selectedProperty.name} (${selectedProperty.city})`
                              : selectedProperty.name
                            : "Select Property"}
                        </span>
                        <ChevronDown className="size-3 text-muted-foreground ml-auto shrink-0" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="start" className="min-w-[280px] max-w-[360px]">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Hotel Scope
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {properties.map((p) => (
                        <DropdownMenuItem
                          key={p.id}
                          onClick={() => handlePropertyChange(p.id)}
                          className={cn(
                            "text-xs cursor-pointer",
                            p.id === propertyId && "font-semibold bg-muted"
                          )}
                        >
                          <div className="truncate">
                            <div className="font-medium">{p.name}</div>
                            {p.city && (
                              <div className="text-[10px] text-muted-foreground">{p.city}</div>
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Responsive Reporting Date Range Toolbar */}
            {dateMode === "range" && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="report-from-date" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    From:
                  </label>
                  <Input
                    id="report-from-date"
                    type="date"
                    aria-label="Start Date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="h-8 w-[158px] sm:w-[165px] text-xs font-mono bg-background"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label htmlFor="report-to-date" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    To:
                  </label>
                  <Input
                    id="report-to-date"
                    type="date"
                    aria-label="End Date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="h-8 w-[158px] sm:w-[165px] text-xs font-mono bg-background"
                  />
                </div>
              </div>
            )}

            {/* Single Date Mode */}
            {dateMode === "single" && (
              <div className="flex items-center gap-1.5">
                <label htmlFor="report-single-date" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Date:
                </label>
                <Input
                  id="report-single-date"
                  type="date"
                  aria-label="Date"
                  value={singleDate}
                  onChange={(e) => handleSingleDateChange(e.target.value)}
                  className="h-8 w-[158px] sm:w-[165px] text-xs font-mono bg-background"
                />
              </div>
            )}

            {/* Quick Date Presets */}
            {dateMode === "range" && (
              <div className="flex flex-wrap items-center gap-1 border-t sm:border-t-0 sm:border-l border-border/80 pt-2 sm:pt-0 sm:pl-3">
                <button
                  type="button"
                  onClick={() => handlePreset("today")}
                  className={cn(
                    "h-7 px-2.5 text-xs font-medium rounded-md transition-colors border cursor-pointer",
                    activeRangePreset === "today"
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                      : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                  )}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset("this_month")}
                  className={cn(
                    "h-7 px-2.5 text-xs font-medium rounded-md transition-colors border cursor-pointer",
                    activeRangePreset === "this_month"
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                      : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                  )}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset("last_month")}
                  className={cn(
                    "h-7 px-2.5 text-xs font-medium rounded-md transition-colors border cursor-pointer",
                    activeRangePreset === "last_month"
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                      : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                  )}
                >
                  Last Month
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset("last_30_days")}
                  className={cn(
                    "h-7 px-2.5 text-xs font-medium rounded-md transition-colors border cursor-pointer",
                    activeRangePreset === "last_30_days"
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                      : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                  )}
                >
                  Last 30 Days
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render Active Report Section */}
      <div>
        {children({
          startDate,
          endDate,
          singleDate,
          propertyId,
          refreshTrigger,
        })}
      </div>
    </div>
  )
}
