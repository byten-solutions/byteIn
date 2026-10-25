"use client"

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

function getStatValueFontSize(value: React.ReactNode): string {
  if (typeof value !== "string" && typeof value !== "number") {
    return "text-2xl sm:text-3xl"
  }
  const str = String(value).trim()
  const len = str.length
  if (len <= 8) {
    return "text-2xl sm:text-3xl"
  }
  if (len <= 11) {
    return "text-xl sm:text-2xl"
  }
  if (len <= 14) {
    return "text-lg sm:text-xl"
  }
  if (len <= 17) {
    return "text-base sm:text-lg"
  }
  return "text-sm sm:text-base"
}

interface ParsedStatNumber {
  prefix: string
  target: number
  decimals: number
  suffix: string
  hasComma: boolean
}

function parseStatNumber(value: React.ReactNode): ParsedStatNumber | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null
  }
  const str = String(value).trim()
  if (!str) return null

  // Match optional prefix, optional sign, integer with optional commas, optional decimal, optional suffix
  const match = str.match(/^([^\d\s-]*[-+]?[^\d\s]*)\s*([\d,]+)(?:\.(\d+))?(.*)$/)
  if (!match) return null

  const [, prefix, intPart, decPart, suffix] = match
  const cleanedInt = intPart.replace(/,/g, "")
  const numStr = decPart !== undefined ? `${cleanedInt}.${decPart}` : cleanedInt
  const target = parseFloat(numStr)
  if (isNaN(target)) return null

  return {
    prefix: prefix || "",
    target,
    decimals: decPart ? decPart.length : 0,
    suffix: suffix || "",
    hasComma: intPart.includes(","),
  }
}

function renderStatValue(value: React.ReactNode) {
  if (typeof value !== "string" && typeof value !== "number") {
    return value
  }

  const str = String(value).trim()
  // Match prefix (currency symbols, +/- signs), digits with grouping commas, and decimal fraction
  const match = str.match(/^([^\d\s-]*[-+]?[^\d\s]*)\s*([\d,]+)(?:\.(\d+))?(.*)$/)
  if (!match) {
    return str
  }

  const [, prefix, integer, decimal, suffix] = match
  return (
    <span className="inline-flex items-baseline font-mono tabular-nums tracking-tight min-w-0 select-all">
      {prefix && (
        <span className="text-[0.82em] font-semibold text-muted-foreground/80 mr-0.5 select-all">
          {prefix}
        </span>
      )}
      <span className="font-bold select-all">{integer}</span>
      {decimal && (
        <span className="text-[0.76em] font-semibold text-muted-foreground/85 tracking-normal ml-0.5 select-all">
          {decimal}
        </span>
      )}
      {suffix && (
        <span className="text-[0.82em] font-semibold text-muted-foreground/80 ml-0.5 select-all">
          {suffix}
        </span>
      )}
    </span>
  )
}

function AnimatedStatValue({ value }: { value: React.ReactNode }) {
  const parsed = React.useMemo(() => parseStatNumber(value), [value])
  const [displayVal, setDisplayVal] = React.useState<number | null>(null)
  const prevTargetRef = React.useRef<number | null>(null)

  const target = parsed?.target

  React.useEffect(() => {
    if (target === undefined) return

    // Accessibility check: skip animation if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (prefersReducedMotion) {
      prevTargetRef.current = target
      return
    }

    const startVal = prevTargetRef.current ?? 0
    const endVal = target
    prevTargetRef.current = endVal

    const duration = 800 // 800ms snappy animation
    let startTimestamp: number | null = null
    let rafId: number

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const elapsed = timestamp - startTimestamp
      const progress = Math.min(1, elapsed / duration)
      // Ease out expo: snappy deceleration curve
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      const current = startVal + (endVal - startVal) * eased

      if (progress < 1) {
        setDisplayVal(current)
        rafId = requestAnimationFrame(step)
      } else {
        setDisplayVal(endVal)
      }
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [target])

  // SSR or before mount / non-numeric fallback / reduced motion: render the static parsed value
  if (!parsed || displayVal === null) {
    return renderStatValue(value)
  }

  // Format animated number
  const fixed = displayVal.toFixed(parsed.decimals)
  const [rawInt, rawDec] = fixed.split(".")
  const intDisplay = parsed.hasComma
    ? Number(rawInt).toLocaleString("en-US")
    : rawInt
  const decDisplay = parsed.decimals > 0 && rawDec ? `.${rawDec}` : null

  return (
    <span className="inline-flex items-baseline font-mono tabular-nums tracking-tight min-w-0 select-all">
      {parsed.prefix && (
        <span className="text-[0.82em] font-semibold text-muted-foreground/80 mr-0.5 select-all">
          {parsed.prefix}
        </span>
      )}
      <span className="font-bold select-all">{intDisplay}</span>
      {decDisplay && (
        <span className="text-[0.76em] font-semibold text-muted-foreground/85 tracking-normal ml-0.5 select-all">
          {decDisplay}
        </span>
      )}
      {parsed.suffix && (
        <span className="text-[0.82em] font-semibold text-muted-foreground/80 ml-0.5 select-all">
          {parsed.suffix}
        </span>
      )}
    </span>
  )
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
  const fontSizeClass = getStatValueFontSize(value)

  const content = (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-2xs transition-all duration-150 min-w-0 overflow-hidden",
        href && "hover:border-primary/50 hover:shadow-xs cursor-pointer",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {indicatorColor && (
            <span
              className={cn("size-2 rounded-full shrink-0 shadow-2xs", indicatorColor)}
              aria-hidden="true"
            />
          )}
          <span className="text-xs font-semibold text-muted-foreground tracking-normal truncate">
            {label}
          </span>
        </div>
        {icon && (
          <div className="text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 min-w-0">
        <div
          className={cn(
            "font-bold tracking-tight text-foreground font-mono tabular-nums min-w-0 truncate select-all leading-tight",
            fontSizeClass
          )}
          title={typeof value === "string" || typeof value === "number" ? String(value) : undefined}
        >
          <AnimatedStatValue value={value} />
        </div>
        {subtext && (
          <div
            className="mt-1 text-xs text-muted-foreground truncate"
            title={typeof subtext === "string" ? subtext : undefined}
          >
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
        prefetch={true}
        className="block outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
      >
        {content}
      </Link>
    )
  }

  return content
}
