"use client"

import * as React from "react"
import { ArrowRight } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/date-format"
import { parseIsoDate, formatIsoDate } from "./date-picker"

export interface DateRangePickerProps {
  from?: string // YYYY-MM-DD
  to?: string // YYYY-MM-DD
  onChange?: (range: { from: string; to: string }) => void
  placeholder?: string
  disabled?: boolean
  minDate?: string // YYYY-MM-DD
  className?: string
  id?: string
}

function calculateNights(fromStr?: string, toStr?: string): number {
  if (!fromStr || !toStr) return 0
  const f = parseIsoDate(fromStr)
  const t = parseIsoDate(toStr)
  if (!f || !t) return 0
  const diffTime = t.getTime() - f.getTime()
  return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)))
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

function isBeforeDay(d1: Date, d2: Date): boolean {
  const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime()
  const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime()
  return t1 < t2
}

function isAfterDay(d1: Date, d2: Date): boolean {
  const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime()
  const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime()
  return t1 > t2
}

function addDays(d: Date, days: number): Date {
  const res = new Date(d)
  res.setDate(res.getDate() + days)
  return res
}

export function DateRangePicker({
  from,
  to,
  onChange,
  disabled = false,
  minDate,
  className,
  id,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [activeSegment, setActiveSegment] = React.useState<"check-in" | "check-out" | null>(null)
  const [draftRange, setDraftRange] = React.useState<{ from?: Date; to?: Date } | null>(null)

  const parsedFrom = React.useMemo(() => parseIsoDate(from), [from])
  const parsedTo = React.useMemo(() => parseIsoDate(to), [to])

  const internalFrom = draftRange !== null ? draftRange.from : parsedFrom
  const internalTo = draftRange !== null ? draftRange.to : parsedTo

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setDraftRange(null)
      setActiveSegment(null)
    } else {
      setDraftRange({ from: parseIsoDate(from), to: parseIsoDate(to) })
    }
  }

  const min = React.useMemo(() => parseIsoDate(minDate), [minDate])
  const nights = React.useMemo(() => calculateNights(from, to), [from, to])

  const selectedRange: DateRange | undefined = React.useMemo(() => {
    return {
      from: internalFrom,
      to: internalTo,
    }
  }, [internalFrom, internalTo])

  const handleDayClick = (clickedDay: Date) => {
    // If minDate is set and clicked day is before minDate, do nothing
    if (min && isBeforeDay(clickedDay, min)) {
      return
    }

    if (activeSegment === "check-in") {
      // User explicitly opened check-in segment
      if (internalTo) {
        if (isAfterDay(clickedDay, internalTo) || isSameDay(clickedDay, internalTo)) {
          // New check-in is on or after current check-out: clear check-out and activate check-out
          setDraftRange({ from: clickedDay, to: undefined })
          setActiveSegment("check-out")
        } else {
          // New check-in is valid before current check-out: complete range
          setDraftRange({ from: clickedDay, to: internalTo })
          onChange?.({
            from: formatIsoDate(clickedDay),
            to: formatIsoDate(internalTo),
          })
          handleOpenChange(false)
        }
      } else {
        setDraftRange({ from: clickedDay, to: undefined })
        setActiveSegment("check-out")
      }
      return
    }

    if (activeSegment === "check-out") {
      // User explicitly opened check-out segment
      if (internalFrom) {
        if (isAfterDay(clickedDay, internalFrom)) {
          // Clicked later day: complete range
          setDraftRange({ from: internalFrom, to: clickedDay })
          onChange?.({
            from: formatIsoDate(internalFrom),
            to: formatIsoDate(clickedDay),
          })
          handleOpenChange(false)
        } else if (isSameDay(clickedDay, internalFrom)) {
          // Clicked same day: set checkout to next day (1 night)
          const nextDay = addDays(clickedDay, 1)
          setDraftRange({ from: internalFrom, to: nextDay })
          onChange?.({
            from: formatIsoDate(internalFrom),
            to: formatIsoDate(nextDay),
          })
          handleOpenChange(false)
        } else {
          // Clicked earlier day: move check-in there and keep check-out active
          setDraftRange({ from: clickedDay, to: undefined })
          setActiveSegment("check-out")
        }
      } else {
        setDraftRange({ from: clickedDay, to: undefined })
        setActiveSegment("check-out")
      }
      return
    }

    // Default Click-Click Selection (no specific segment active)
    if ((internalFrom && internalTo) || (!internalFrom && !internalTo)) {
      // Start a NEW range
      setDraftRange({ from: clickedDay, to: undefined })
      setActiveSegment("check-out")
    } else if (internalFrom && !internalTo) {
      if (isAfterDay(clickedDay, internalFrom)) {
        // Click on later day: sets checkout and completes range
        setDraftRange({ from: internalFrom, to: clickedDay })
        onChange?.({
          from: formatIsoDate(internalFrom),
          to: formatIsoDate(clickedDay),
        })
        handleOpenChange(false)
      } else if (isBeforeDay(clickedDay, internalFrom)) {
        // Click on earlier day: moves check-in there
        setDraftRange({ from: clickedDay, to: undefined })
        setActiveSegment("check-out")
      } else {
        // Click on same day: sets checkout to next day (1 night)
        const nextDay = addDays(clickedDay, 1)
        setDraftRange({ from: internalFrom, to: nextDay })
        onChange?.({
          from: formatIsoDate(internalFrom),
          to: formatIsoDate(nextDay),
        })
        handleOpenChange(false)
      }
    }
  }

  const applyPreset = (startOffsetDays: number, totalNights: number) => {
    const f = new Date()
    f.setHours(0, 0, 0, 0)
    f.setDate(f.getDate() + startOffsetDays)
    const t = new Date(f)
    t.setDate(t.getDate() + totalNights)

    setDraftRange({ from: f, to: t })
    onChange?.({
      from: formatIsoDate(f),
      to: formatIsoDate(t),
    })
    handleOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <div
            id={id}
            role="button"
            tabIndex={disabled ? -1 : 0}
            className={cn(
              "inline-flex items-center justify-between rounded-lg border border-border/80 bg-card p-1 shadow-xs transition-colors",
              disabled && "opacity-50 pointer-events-none cursor-not-allowed",
              className
            )}
          />
        }
      >
        {/* Segment 1: Check-in */}
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation()
            setActiveSegment("check-in")
            setOpen(true)
          }}
          className={cn(
            "flex flex-1 flex-col items-start rounded-md px-3 py-1.5 text-left transition-all cursor-pointer",
            activeSegment === "check-in" && open
              ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/30"
              : "hover:bg-muted/60 text-foreground"
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Check-in
          </span>
          <span className="text-xs font-medium truncate">
            {from ? formatDate(from) : "Select date"}
          </span>
        </button>

        {/* Middle Night count indicator */}
        <div className="flex items-center px-2 text-muted-foreground/50 select-none shrink-0">
          {nights > 0 ? (
            <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground border border-border/60">
              {nights} night{nights === 1 ? "" : "s"}
            </span>
          ) : (
            <ArrowRight className="size-3.5" />
          )}
        </div>

        {/* Segment 2: Check-out */}
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation()
            setActiveSegment("check-out")
            setOpen(true)
          }}
          className={cn(
            "flex flex-1 flex-col items-start rounded-md px-3 py-1.5 text-left transition-all cursor-pointer",
            activeSegment === "check-out" && open
              ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/30"
              : "hover:bg-muted/60 text-foreground"
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Check-out
          </span>
          <span className="text-xs font-medium truncate">
            {to ? formatDate(to) : "Select date"}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-3" align="start">
        {/* Presets Header */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2.5 mb-2 border-b border-border/70 text-xs">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => applyPreset(0, 1)}
          >
            Tonight
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => applyPreset(1, 1)}
          >
            Tomorrow
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => applyPreset(0, 7)}
          >
            +1 week
          </Button>
          {activeSegment && (
            <span className="ml-auto text-[11px] font-medium text-primary">
              Selecting: {activeSegment === "check-in" ? "Check-in" : "Check-out"}
            </span>
          )}
        </div>

        {/* Controlled Selection Calendar */}
        <Calendar
          mode="range"
          selected={selectedRange}
          onDayClick={handleDayClick}
          numberOfMonths={2}
          disabled={(date) => (min ? isBeforeDay(date, min) : false)}
          defaultMonth={internalFrom || min || new Date()}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
