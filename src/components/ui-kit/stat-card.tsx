import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export interface StatCardProps {
  label: string
  value: React.ReactNode
  subtext?: React.ReactNode
  href?: string
  icon?: React.ReactNode
  indicatorColor?: string
  className?: string
}

export function StatCard({
  label,
  value,
  subtext,
  href,
  icon,
  indicatorColor,
  className,
}: StatCardProps) {
  const content = (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-2xs transition-all duration-150",
        href && "hover:border-primary/50 hover:shadow-xs cursor-pointer",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {indicatorColor && (
            <span
              className={cn("size-2 rounded-full shrink-0 shadow-2xs", indicatorColor)}
              aria-hidden="true"
            />
          )}
          <span className="text-xs font-semibold text-muted-foreground tracking-normal">
            {label}
          </span>
        </div>
        {icon && (
          <div className="text-muted-foreground/60 group-hover:text-foreground transition-colors">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
          {value}
        </div>
        {subtext && (
          <div className="text-xs text-muted-foreground line-clamp-1 text-right">
            {subtext}
          </div>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
      >
        {content}
      </Link>
    )
  }

  return content
}
