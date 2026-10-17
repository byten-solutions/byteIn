import * as React from "react"
import { cn } from "@/lib/utils"

export type StatusType =
  // Room statuses
  | "VACANT_CLEAN"
  | "VACANT_DIRTY"
  | "OCCUPIED"
  | "MAINTENANCE"
  | "OUT_OF_SERVICE"
  // Reservation statuses
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  // Invoice statuses
  | "DRAFT"
  | "ISSUED"
  | "PAID"
  | "PARTIALLY_PAID"
  | "OVERDUE"
  // Payment / user / general
  | "SUCCESS"
  | "VOIDED"
  | "PENDING"
  | "FAILED"
  | "ACTIVE"
  | "DISABLED"
  | string

interface StatusConfig {
  label: string
  dotClass: string
  badgeClass: string
}

const STATUS_CONFIGS: Record<string, StatusConfig> = {
  // Room statuses
  VACANT_CLEAN: {
    label: "Clean",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/25 font-semibold",
  },
  VACANT_DIRTY: {
    label: "Dirty",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/12 text-amber-900 dark:text-amber-300 border-amber-500/30 font-semibold",
  },
  OCCUPIED: {
    label: "Occupied",
    dotClass: "bg-sky-500",
    badgeClass: "bg-sky-500/12 text-sky-900 dark:text-sky-300 border-sky-500/25 font-semibold",
  },
  MAINTENANCE: {
    label: "Maintenance",
    dotClass: "bg-purple-500",
    badgeClass: "bg-purple-500/12 text-purple-900 dark:text-purple-300 border-purple-500/25 font-semibold",
  },
  OUT_OF_SERVICE: {
    label: "Out of Service",
    dotClass: "bg-stone-400",
    badgeClass: "bg-stone-500/12 text-stone-800 dark:text-stone-300 border-stone-500/25 font-medium",
  },

  // Reservation / Allocation statuses
  CONFIRMED: {
    label: "Confirmed",
    dotClass: "bg-sky-500",
    badgeClass: "bg-sky-500/12 text-sky-900 dark:text-sky-300 border-sky-500/25 font-semibold",
  },
  CHECKED_IN: {
    label: "Checked In",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/25 font-semibold",
  },
  CHECKED_OUT: {
    label: "Checked Out",
    dotClass: "bg-stone-400",
    badgeClass: "bg-stone-500/12 text-stone-800 dark:text-stone-300 border-stone-500/25 font-medium",
  },
  NO_SHOW: {
    label: "No Show",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/12 text-rose-900 dark:text-rose-300 border-rose-500/25 font-semibold",
  },
  COMPLETED: {
    label: "Completed",
    dotClass: "bg-stone-400",
    badgeClass: "bg-stone-500/12 text-stone-800 dark:text-stone-300 border-stone-500/25 font-medium",
  },
  CANCELLED: {
    label: "Cancelled",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/12 text-rose-900 dark:text-rose-300 border-rose-500/25 font-semibold",
  },

  // Invoice statuses
  DRAFT: {
    label: "Draft",
    dotClass: "bg-stone-400",
    badgeClass: "bg-stone-500/12 text-stone-800 dark:text-stone-300 border-stone-500/25 font-medium",
  },
  ISSUED: {
    label: "Issued",
    dotClass: "bg-sky-500",
    badgeClass: "bg-sky-500/12 text-sky-900 dark:text-sky-300 border-sky-500/25 font-semibold",
  },
  PAID: {
    label: "Paid",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/25 font-semibold",
  },
  PARTIALLY_PAID: {
    label: "Partially Paid",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/12 text-amber-900 dark:text-amber-300 border-amber-500/30 font-semibold",
  },
  OVERDUE: {
    label: "Overdue",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/12 text-rose-900 dark:text-rose-300 border-rose-500/25 font-semibold",
  },

  // Payments / user statuses
  SUCCESS: {
    label: "Success",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/25 font-semibold",
  },
  ACTIVE: {
    label: "Active",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/25 font-semibold",
  },
  VOIDED: {
    label: "Voided",
    dotClass: "bg-stone-400",
    badgeClass: "bg-stone-500/12 text-stone-800 dark:text-stone-300 border-stone-500/25 font-medium",
  },
  PENDING: {
    label: "Pending",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/12 text-amber-900 dark:text-amber-300 border-amber-500/30 font-semibold",
  },
  FAILED: {
    label: "Failed",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/12 text-rose-900 dark:text-rose-300 border-rose-500/25 font-semibold",
  },
  DISABLED: {
    label: "Disabled",
    dotClass: "bg-stone-400",
    badgeClass: "bg-stone-500/12 text-stone-800 dark:text-stone-300 border-stone-500/25 font-medium",
  },
  RECORDED: {
    label: "Recorded",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/25 font-semibold",
  },
  VOID: {
    label: "Void",
    dotClass: "bg-stone-400",
    badgeClass: "bg-stone-500/12 text-stone-800 dark:text-stone-300 border-stone-500/25 font-medium",
  },
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType
  label?: string
  size?: "sm" | "md"
  dotOnly?: boolean
}

export function StatusBadge({
  status,
  label,
  size = "md",
  dotOnly = false,
  className,
  ...props
}: StatusBadgeProps) {
  const normalizedKey = String(status || "").toUpperCase()
  const config = STATUS_CONFIGS[normalizedKey] || {
    label: status ? String(status).replace(/_/g, " ") : "Unknown",
    dotClass: "bg-neutral-400",
    badgeClass: "bg-muted text-muted-foreground border-border",
  }

  const displayLabel = label ?? config.label

  if (dotOnly) {
    return (
      <span
        className={cn(
          "inline-block rounded-full shrink-0",
          size === "sm" ? "size-2" : "size-2.5",
          config.dotClass,
          className
        )}
        title={displayLabel}
        {...props}
      />
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium border rounded-full select-none shrink-0 transition-colors whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        config.badgeClass,
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "rounded-full shrink-0",
          size === "sm" ? "size-1.5" : "size-2",
          config.dotClass
        )}
      />
      <span>{displayLabel}</span>
    </span>
  )
}
