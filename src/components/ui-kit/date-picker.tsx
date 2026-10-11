"use client"

import * as React from "react"
import { CalendarIcon, XIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface DatePickerProps {
  value?: string // YYYY-MM-DD
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  minDate?: string
  maxDate?: string
  className?: string
  clearable?: boolean
  id?: string
}

export function parseIsoDate(isoString?: string): Date | undefined {
  if (!isoString) return undefined
  const parts = isoString.split("-").map((p) => parseInt(p, 10))
  if (parts.length !== 3 || parts.some(isNaN)) return undefined
  const [year, month, day] = parts
  return new Date(year, month - 1, day)
}

export function formatIsoDate(date?: Date): string {
  if (!date || isNaN(date.getTime())) return ""
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

import { formatDate } from "@/lib/date-format"

function formatDisplayDate(isoString?: string): string {
  if (!isoString) return ""
  return formatDate(isoString)
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
  minDate,
  maxDate,
  className,
  clearable = false,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selectedDate = parseIsoDate(value)
  const min = parseIsoDate(minDate)
  const max = parseIsoDate(maxDate)

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange?.(formatIsoDate(date))
      setOpen(false)
    } else if (clearable) {
      onChange?.("")
      setOpen(false)
    }
  }

  const applyPreset = (daysOffset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + daysOffset)
    onChange?.(formatIsoDate(d))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative inline-flex w-full items-center", className)}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                "h-10 w-full justify-start text-left font-normal pl-3 pr-8",
                !value && "text-muted-foreground",
                className
              )}
            />
          }
        >
          <CalendarIcon className="mr-2 size-4 text-muted-foreground shrink-0" />
          <span className="truncate">
            {value ? formatDisplayDate(value) : placeholder}
          </span>
        </PopoverTrigger>

        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange?.("")
            }}
            className="absolute right-2.5 p-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
            title="Clear date"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>

      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center gap-1.5 pb-2 mb-2 border-b text-xs">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => applyPreset(0)}
          >
            Tonight
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => applyPreset(1)}
          >
            Tomorrow
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => applyPreset(7)}
          >
            +1 week
          </Button>
        </div>

        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={(date) => {
            if (min && date < min) return true
            if (max && date > max) return true
            return false
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
