import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export interface MetricItem {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  indicatorColor?: string
  href?: string
}

export interface CompactMetricBandProps {
  metrics: MetricItem[]
  className?: string
}

export function CompactMetricBand({ metrics, className }: CompactMetricBandProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60 rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden",
        className
      )}
    >
      {metrics.map((m, idx) => {
        const content = (
          <div className="p-2.5 sm:p-3 group-hover:bg-muted/30 transition-colors h-full flex flex-col justify-between gap-1">
            <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-wider">
              <span className="truncate" title={m.label}>{m.label}</span>
              {m.indicatorColor && (
                <span className={cn("size-2 rounded-full shrink-0", m.indicatorColor)} />
              )}
            </div>
            <div className="flex items-baseline justify-between gap-1.5">
              <span
                className="text-lg sm:text-xl font-bold font-mono tracking-tight text-foreground tabular-nums group-hover:text-primary transition-colors truncate select-all"
                title={typeof m.value === "string" || typeof m.value === "number" ? String(m.value) : undefined}
              >
                {m.value}
              </span>
            </div>
            <div
              className="text-[10px] sm:text-[11px] text-muted-foreground font-mono tabular-nums truncate min-h-[16px]"
              title={typeof m.detail === "string" ? m.detail : undefined}
            >
              {m.detail || <span className="opacity-0">·</span>}
            </div>
          </div>
        )

        if (m.href) {
          return (
            <Link
              key={idx}
              href={m.href}
              className="group block h-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {content}
            </Link>
          )
        }

        return (
          <div key={idx} className="group h-full">
            {content}
          </div>
        )
      })}
    </div>
  )
}
