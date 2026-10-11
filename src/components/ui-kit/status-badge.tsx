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
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  VACANT_DIRTY: {
    label: "Dirty",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  OCCUPIED: {
    label: "Occupied",
    dotClass: "bg-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  },
  MAINTENANCE: {
    label: "Maintenance",
    dotClass: "bg-purple-500",
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  },
  OUT_OF_SERVICE: {
    label: "Out of Service",
    dotClass: "bg-neutral-400",
    badgeClass: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20",
  },

  // Reservation statuses
  CONFIRMED: {
    label: "Confirmed",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  COMPLETED: {
    label: "Completed",
    dotClass: "bg-blue-500",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
  CANCELLED: {
    label: "Cancelled",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  },

  // Invoice statuses
  DRAFT: {
    label: "Draft",
    dotClass: "bg-neutral-400",
    badgeClass: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20",
  },
  ISSUED: {
    label: "Issued",
    dotClass: "bg-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  },
  PAID: {
    label: "Paid",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  PARTIALLY_PAID: {
    label: "Partially Paid",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  OVERDUE: {
    label: "Overdue",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  },

  // Payments / user statuses
  SUCCESS: {
    label: "Success",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  ACTIVE: {
    label: "Active",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  VOIDED: {
    label: "Voided",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  },
  PENDING: {
    label: "Pending",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  FAILED: {
    label: "Failed",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  },
  DISABLED: {
    label: "Disabled",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
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
        "inline-flex items-center gap-1.5 font-medium border rounded-full select-none shrink-0 transition-colors",
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
