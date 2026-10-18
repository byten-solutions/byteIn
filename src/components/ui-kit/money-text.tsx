import * as React from "react"
import { cn } from "@/lib/utils"
import { formatMoney as formatMoneyInr } from "@/lib/currency"

export interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string | number | null | undefined
  sign?: "auto" | "always" | "never"
  highlightZero?: boolean
  subtleCents?: boolean
}

export function formatMoney(
  value: string | number | null | undefined
): string {
  return formatMoneyInr(value)
}

export function MoneyText({
  value,
  sign = "never",
  highlightZero = false,
  subtleCents = false,
  className,
  ...props
}: MoneyTextProps) {
  const num = typeof value === "number" ? value : parseFloat(String(value || 0))
  const isPositive = !isNaN(num) && num > 0
  const isNegative = !isNaN(num) && num < 0
  const isZero = !isNaN(num) && num === 0

  let prefix = ""
  if (sign === "always" && isPositive) prefix = "+"
  if (isNegative && sign !== "never") prefix = "-"

  const formatted = formatMoneyInr(Math.abs(isNaN(num) ? 0 : num))

  if (subtleCents) {
    const lastDot = formatted.lastIndexOf(".")
    const whole = lastDot !== -1 ? formatted.slice(0, lastDot) : formatted
    const decimal = lastDot !== -1 ? formatted.slice(lastDot) : ""

    return (
      <span
        className={cn(
          "font-mono font-medium tracking-tight select-all inline-flex items-baseline",
          isNegative && "text-rose-600 dark:text-rose-400",
          isZero && !highlightZero && "text-muted-foreground",
          className
        )}
        {...props}
      >
        {prefix}
        <span>{whole}</span>
        {decimal && (
          <span className="text-[0.78em] font-normal opacity-80 tracking-normal ml-0.5">
            {decimal}
          </span>
        )}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "font-mono font-medium tracking-tight select-all",
        isNegative && "text-rose-600 dark:text-rose-400",
        isZero && !highlightZero && "text-muted-foreground",
        className
      )}
      {...props}
    >
      {prefix}
      {formatted}
    </span>
  )
}
