import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface TodayArrivalItem {
  id: string
  reservationId: string
  room: {
    roomNo: string
    status: string
  }
  roomCategory: {
    name: string
  }
  reservation: {
    reservationNo: string
    customer: {
      firstName: string
      lastName: string | null
    }
  }
}

export interface TodayArrivalsPreviewProps {
  arrivals: TodayArrivalItem[]
  totalCount: number
  propertyId?: string
}

export function TodayArrivalsPreview({
  arrivals,
  totalCount,
  propertyId,
}: TodayArrivalsPreviewProps) {
  const operationsHref = propertyId
    ? `/reports/daily-operations?propertyId=${encodeURIComponent(propertyId)}`
    : "/reports/daily-operations"

  return (
    <div className="rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <LogIn className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Today&apos;s Arrivals
          </h2>
          <span className="font-mono text-xs font-bold text-muted-foreground">
            ({totalCount})
          </span>
        </div>

        <Link
          href={operationsHref}
          className="text-xs font-mono font-medium text-primary hover:underline inline-flex items-center gap-0.5"
        >
          <span>All Operations</span>
          <ArrowUpRight className="size-3" />
        </Link>
      </div>

      {/* Operational Rows */}
      {arrivals.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No arrivals scheduled for today.
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {arrivals.map((alloc) => {
            const guestName = alloc.reservation?.customer
              ? `${alloc.reservation.customer.firstName} ${alloc.reservation.customer.lastName || ""}`.trim()
              : "Guest"
            const roomNo = alloc.room?.roomNo || "—"
            const categoryName = alloc.roomCategory?.name || "Standard Room"
            const roomStatus = alloc.room?.status || "VACANT_CLEAN"
            const isClean = roomStatus === "VACANT_CLEAN"

            return (
              <div
                key={alloc.id}
                className="py-2.5 flex items-center justify-between gap-3 group"
              >
                {/* Left: Room · Guest + Category */}
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm font-semibold text-foreground truncate">
                    Room {roomNo} <span className="text-muted-foreground/40 font-normal">·</span> {guestName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {categoryName}
                    {!isClean && (
                      <span className="ml-1.5 font-mono text-[10px] text-amber-600 dark:text-amber-400">
                        ({roomStatus.replace("_", " ")})
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Check-In Action */}
                <div className="shrink-0 flex items-center gap-2">
                  <Link href={`/reservations/${alloc.reservationId}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs border-border/80 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all font-medium"
                    >
                      Check In
                    </Button>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
