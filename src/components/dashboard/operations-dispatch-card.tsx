"use client"

import * as React from "react"
import Link from "next/link"
import { LogIn, BedDouble, ChevronRight, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui-kit"
import type { RoomStatus } from "@prisma/client"
import type { DailyOperationsCountsDTO } from "@/modules/reports/reports.types"

type OpsTab = "arrivals" | "departures" | "inHouse" | "overdue"

interface OperationsDispatchCardProps {
  counts: DailyOperationsCountsDTO
  arrivals: Array<{
    id: string
    reservationId: string
    room: { roomNo: string; status: RoomStatus }
    roomCategory: { name: string }
    reservation: {
      reservationNo: string
      customer: { firstName: string; lastName: string | null }
    }
  }>
  departures: Array<{
    id: string
    reservationId: string
    room: { roomNo: string; status: RoomStatus }
    roomCategory: { name: string }
    reservation: {
      reservationNo: string
      customer: { firstName: string; lastName: string | null }
    }
  }>
  propertyId?: string
}

export function OperationsDispatchCard({
  counts,
  arrivals,
  departures,
  propertyId,
}: OperationsDispatchCardProps) {
  const [activeTab, setActiveTab] = React.useState<OpsTab>("arrivals")

  const propParam = propertyId ? `&propertyId=${encodeURIComponent(propertyId)}` : ""
  const reportsHref = `/reports?tab=daily_ops&subtab=${activeTab === "arrivals" ? "arrivals" : activeTab === "departures" ? "departures" : activeTab === "inHouse" ? "in_house" : "pending"}${propParam}`

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs flex flex-col justify-between h-full">
      {/* Header & Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <LogIn className="size-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Front Desk Operations</h3>
          </div>
          <p className="text-xs text-muted-foreground">Today&apos;s active guest movements and room allocations</p>
        </div>

        {/* Secondary Segmented Switcher */}
        <div className="inline-flex max-w-full items-center gap-0.5 sm:gap-1 rounded-lg border border-border/80 bg-muted/40 p-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("arrivals")}
            className={cn(
              "rounded-md px-2 sm:px-2.5 py-1 text-xs font-medium transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0",
              activeTab === "arrivals"
                ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Arrivals</span>
            <span className="font-mono text-[11px] tabular-nums font-bold">({counts.arrivals})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("departures")}
            className={cn(
              "rounded-md px-2 sm:px-2.5 py-1 text-xs font-medium transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0",
              activeTab === "departures"
                ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Departures</span>
            <span className="font-mono text-[11px] tabular-nums font-bold">({counts.departures})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("inHouse")}
            className={cn(
              "rounded-md px-2 sm:px-2.5 py-1 text-xs font-medium transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0",
              activeTab === "inHouse"
                ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="whitespace-nowrap">In-House</span>
            <span className="font-mono text-[11px] tabular-nums font-bold">({counts.inHouse})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("overdue")}
            className={cn(
              "rounded-md px-2 sm:px-2.5 py-1 text-xs font-medium transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0",
              activeTab === "overdue"
                ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={`${counts.overdue} overdue check-ins (all-time unresolved)`}
          >
            <span className="whitespace-nowrap">Overdue</span>
            <span
              className={cn(
                "font-mono text-[11px] tabular-nums font-bold",
                counts.overdue > 0 ? "text-amber-600/90 dark:text-amber-400/90" : "text-muted-foreground"
              )}
            >
              ({counts.overdue})
            </span>
          </button>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1">
        {/* ARRIVALS TAB */}
        {activeTab === "arrivals" && (
          arrivals.length === 0 ? (
            <div className="py-2.5 px-3 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/60">
              No arrivals scheduled for today
            </div>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
              {arrivals.map((alloc) => (
                <Link
                  key={alloc.id}
                  href={`/reservations/${alloc.reservationId}`}
                  className="flex items-center justify-between p-3 text-xs transition-colors hover:bg-muted/40 group"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="size-8 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/20">
                      {alloc.reservation.customer.firstName.charAt(0)}
                      {alloc.reservation.customer.lastName ? alloc.reservation.customer.lastName.charAt(0) : ""}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="font-mono tabular-nums font-bold text-foreground text-sm truncate max-w-[200px]"
                          title={`Room ${alloc.room.roomNo}`}
                        >
                          Room {alloc.room.roomNo}
                        </span>
                        <span
                          className="text-muted-foreground truncate text-[11px] min-w-0"
                          title={alloc.roomCategory.name}
                        >
                          • {alloc.roomCategory.name}
                        </span>
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        Guest:{" "}
                        <span className="font-semibold text-foreground">
                          {alloc.reservation.customer.firstName} {alloc.reservation.customer.lastName}
                        </span>{" "}
                        <span className="font-mono text-[11px] text-muted-foreground/70">
                          (#{alloc.reservation.reservationNo})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <StatusBadge status={alloc.room.status} size="sm" />
                    <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* DEPARTURES TAB */}
        {activeTab === "departures" && (
          departures.length === 0 ? (
            <div className="py-2.5 px-3 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/60">
              No departures scheduled for today
            </div>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
              {departures.map((alloc) => (
                <Link
                  key={alloc.id}
                  href={`/reservations/${alloc.reservationId}`}
                  className="flex items-center justify-between p-3 text-xs transition-colors hover:bg-muted/40 group"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="size-8 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-sky-500/20">
                      {alloc.reservation.customer.firstName.charAt(0)}
                      {alloc.reservation.customer.lastName ? alloc.reservation.customer.lastName.charAt(0) : ""}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="font-mono tabular-nums font-bold text-foreground text-sm truncate max-w-[200px]"
                          title={`Room ${alloc.room.roomNo}`}
                        >
                          Room {alloc.room.roomNo}
                        </span>
                        <span
                          className="text-muted-foreground truncate text-[11px] min-w-0"
                          title={alloc.roomCategory.name}
                        >
                          • {alloc.roomCategory.name}
                        </span>
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        Guest:{" "}
                        <span className="font-semibold text-foreground">
                          {alloc.reservation.customer.firstName} {alloc.reservation.customer.lastName}
                        </span>{" "}
                        <span className="font-mono text-[11px] text-muted-foreground/70">
                          (#{alloc.reservation.reservationNo})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <StatusBadge status={alloc.room.status} size="sm" />
                    <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* IN-HOUSE TAB */}
        {activeTab === "inHouse" && (
          <div className="rounded-xl border border-border/80 bg-card p-6 text-center space-y-3 shadow-2xs">
            <BedDouble className="size-8 mx-auto text-amber-500/70" />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-foreground">
                {counts.inHouse} Guests Currently In-House
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                View all resident guest folios, key status, and room allocations on the full Daily Operations board.
              </p>
            </div>
            <Link href={reportsHref}>
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Open In-House Roster</span>
                <ArrowUpRight className="size-3.5" />
              </button>
            </Link>
          </div>
        )}

        {/* OVERDUE TAB */}
        {activeTab === "overdue" && (
          <div className="rounded-xl border border-border/80 bg-card p-6 text-center space-y-3 shadow-2xs">
            <div className="size-8 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center mx-auto border border-amber-500/20 font-mono text-sm">
              !
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-foreground">
                {counts.overdue} Overdue Check-Ins (All-Time)
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Historical bookings with past arrival dates that were never checked in, cancelled, or marked as no-show.
              </p>
            </div>
            <Link href={reportsHref}>
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Review Overdue Arrivals</span>
                <ArrowUpRight className="size-3.5" />
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="flex items-center justify-end pt-2 border-t border-border/60 text-xs text-muted-foreground">
        <Link
          href={reportsHref}
          className="text-primary hover:underline font-mono text-xs inline-flex items-center gap-0.5"
        >
          <span>All Operations</span>
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </div>
  )
}
