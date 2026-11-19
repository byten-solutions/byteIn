"use client"

import * as React from "react"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"

export interface ReportMetricItem {
  label: string
  value: string | number
  subtext?: string
  tone?: "default" | "success" | "danger" | "warning"
  isMoney?: boolean
}

export interface ReportMetricBandProps {
  metrics: ReportMetricItem[]
  className?: string
}

export function ReportMetricBand({ metrics, className }: ReportMetricBandProps) {
  if (!metrics || metrics.length === 0) return null

  const gridColsClass =
    metrics.length === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : metrics.length === 3
      ? "grid-cols-1 sm:grid-cols-3"
      : metrics.length === 5
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4"

  return (
    <div className={cn("grid gap-2.5 sm:gap-3 w-full", gridColsClass, className)}>
      {metrics.map((m, idx) => {
        const displayValue =
          m.isMoney && typeof m.value === "number"
            ? formatMoney(m.value)
            : typeof m.value === "string" && m.isMoney
            ? formatMoney(parseFloat(m.value) || 0)
            : m.value

        const valueColorClass =
          m.tone === "success"
            ? "text-emerald-600 dark:text-emerald-400"
            : m.tone === "danger"
            ? "text-rose-600 dark:text-rose-400"
            : m.tone === "warning"
            ? "text-amber-600 dark:text-amber-400"
            : "text-foreground"

        return (
          <div
            key={idx}
            className="flex flex-col justify-start gap-0.5 rounded-xl border border-border/80 bg-card p-2.5 sm:p-3 shadow-2xs min-w-0 overflow-hidden"
          >
            <span
              className="text-[10px] sm:text-[11px] font-mono font-medium uppercase tracking-wider text-muted-foreground truncate"
              title={m.label}
            >
              {m.label}
            </span>
            <div className="flex items-baseline justify-between gap-1.5 min-w-0">
              <span
                className={cn(
                  "text-base sm:text-lg lg:text-xl font-bold font-mono tracking-tight tabular-nums truncate select-all",
                  valueColorClass
                )}
                title={typeof displayValue === "string" || typeof displayValue === "number" ? String(displayValue) : undefined}
              >
                {displayValue}
              </span>
            </div>
            {m.subtext && (
              <span
                className="text-[10px] sm:text-[11px] text-muted-foreground/80 truncate"
                title={m.subtext}
              >
                {m.subtext}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
