import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface TodayDepartureItem {
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

export interface TodayDeparturesPreviewProps {
  departures: TodayDepartureItem[]
  totalCount: number
  propertyId?: string
}

export function TodayDeparturesPreview({
  departures,
  totalCount,
  propertyId,
}: TodayDeparturesPreviewProps) {
  const operationsHref = propertyId
    ? `/reports/daily-operations?propertyId=${encodeURIComponent(propertyId)}&tab=departures`
    : "/reports/daily-operations?tab=departures"

  return (
    <div className="rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <LogOut className="size-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-foreground">
            Today&apos;s Departures
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
      {departures.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No departures scheduled for today.
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {departures.map((alloc) => {
            const guestName = `${alloc.reservation.customer.firstName} ${alloc.reservation.customer.lastName || ""}`.trim()

            return (
              <div
                key={alloc.id}
                className="py-2.5 flex items-center justify-between gap-3 group"
              >
                {/* Left: Room · Guest + Category */}
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm font-semibold text-foreground truncate">
                    Room {alloc.room.roomNo} <span className="text-muted-foreground/40 font-normal">·</span> {guestName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {alloc.roomCategory.name}
                  </div>
                </div>

                {/* Right: Check-Out Action */}
                <div className="shrink-0 flex items-center gap-2">
                  <Link href={`/reservations/${alloc.reservationId}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs border-border/80 hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all font-medium"
                    >
                      Check Out
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
