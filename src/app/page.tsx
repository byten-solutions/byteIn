import Link from "next/link"
import {
  BedDouble,
  Plus,
  ShieldCheck,
  ArrowRight,
  LogIn,
  LogOut,
  ChevronRight,
} from "lucide-react"
import { RoomStatus, ReservationStatus } from "@prisma/client"
import { getSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { CheckInOutService } from "@/modules/check-in-out/check-in-out.service"
import { getHotelTodayDateUtc } from "@/lib/date"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import {
  StatCard,
  StatusBadge,
  EmptyState,
} from "@/components/ui-kit"

export default async function Page() {
  const session = await getSession()

  let counts = {
    total: 0,
    clean: 0,
    dirty: 0,
    occupied: 0,
    maintenance: 0,
    outOfService: 0,
    reservations: 0,
    confirmedReservations: 0,
  }

  let arrivals: Awaited<ReturnType<typeof CheckInOutService.getDailyArrivals>> = []
  let departures: Awaited<ReturnType<typeof CheckInOutService.getDailyDepartures>> = []

  if (session) {
    const today = getHotelTodayDateUtc()
    const [
      total,
      clean,
      dirty,
      occupied,
      maintenance,
      outOfService,
      totalRes,
      confirmedRes,
      todayArrivals,
      todayDepartures,
    ] = await Promise.all([
      prisma.room.count(),
      prisma.room.count({ where: { status: RoomStatus.VACANT_CLEAN } }),
      prisma.room.count({ where: { status: RoomStatus.VACANT_DIRTY } }),
      prisma.room.count({ where: { status: RoomStatus.OCCUPIED } }),
      prisma.room.count({ where: { status: RoomStatus.MAINTENANCE } }),
      prisma.room.count({ where: { status: RoomStatus.OUT_OF_SERVICE } }),
      prisma.reservation.count(),
      prisma.reservation.count({ where: { status: ReservationStatus.CONFIRMED } }),
      CheckInOutService.getDailyArrivals(today),
      CheckInOutService.getDailyDepartures(today),
    ])

    counts = {
      total,
      clean,
      dirty,
      occupied,
      maintenance,
      outOfService,
      reservations: totalRes,
      confirmedReservations: confirmedRes,
    }

    arrivals = todayArrivals
    departures = todayDepartures
  }

  return (
    <AppShell
      session={session}
      stats={session ? { cleanRooms: counts.clean, dirtyRooms: counts.dirty } : undefined}
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
        {session ? (
          <div className="space-y-6">
            {/* Reception Header & Quick Actions */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    Reception Dispatch
                  </h1>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                    Live Shift
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Front Desk Console • Operator: <span className="font-medium text-foreground">{session.name}</span> ({session.role})
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link href="/rooms">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/80">
                    <BedDouble className="size-3.5" />
                    Room Rack
                  </Button>
                </Link>
                <Link href="/reservations/new">
                  <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs">
                    <Plus className="size-3.5" />
                    New Reservation
                  </Button>
                </Link>
              </div>
            </div>

            {/* Shift Pulse & Operational Inventory Metrics (4 columns) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                label="Vacant Clean"
                value={counts.clean}
                subtext="Ready for check-in"
                indicatorColor="bg-emerald-500"
                href="/rooms?status=VACANT_CLEAN"
              />
              <StatCard
                label="Vacant Dirty"
                value={counts.dirty}
                subtext="Turnover needed"
                indicatorColor="bg-amber-500"
                href="/rooms?status=VACANT_DIRTY"
              />
              <StatCard
                label="Occupied"
                value={counts.occupied}
                subtext={`${counts.confirmedReservations} active booking${counts.confirmedReservations === 1 ? "" : "s"}`}
                indicatorColor="bg-sky-500"
                href="/rooms?status=OCCUPIED"
              />
              <StatCard
                label="Maintenance"
                value={counts.maintenance}
                subtext={`${counts.outOfService} out of service`}
                indicatorColor="bg-purple-500"
                href="/rooms?status=MAINTENANCE"
              />
            </div>

            {/* Operational Shift Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-3 sm:px-4 sm:py-3 text-xs shadow-2xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-primary shrink-0" />
                  <span className="font-semibold text-foreground font-mono tabular-nums">
                    {counts.total > 0 ? Math.round((counts.occupied / counts.total) * 100) : 0}%
                  </span>
                  <span>Occupancy</span>
                </div>
                <span className="hidden sm:inline text-border">|</span>
                <div className="text-muted-foreground">
                  Turnover Pressure:{" "}
                  <span className="font-mono tabular-nums font-semibold text-foreground">
                    {counts.dirty}
                  </span>{" "}
                  dirty room{counts.dirty === 1 ? "" : "s"} awaiting turnover
                </div>
              </div>

              <Link
                href="/reservations"
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline self-end sm:self-auto text-xs"
              >
                <span>{counts.confirmedReservations} Confirmed Bookings</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </div>

            {/* Daily Operations: Arrivals & Departures Matrices */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Arrivals Today */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <LogIn className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <h2 className="text-sm font-bold tracking-tight text-foreground uppercase tracking-wider font-mono text-xs">
                      Arrivals Today
                    </h2>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2 py-0.5 text-xs font-mono tabular-nums font-semibold">
                    {arrivals.length} scheduled
                  </span>
                </div>

                {arrivals.length === 0 ? (
                  <EmptyState
                    icon={<LogIn className="size-5" />}
                    title="No arrivals scheduled today"
                    description="No confirmed guest check-ins scheduled for today's shift."
                    className="min-h-44"
                  />
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
                    {arrivals.map((alloc) => (
                      <Link
                        key={alloc.id}
                        href={`/reservations/${alloc.reservationId}`}
                        className="flex items-center justify-between p-3.5 text-xs transition-colors hover:bg-muted/40 group"
                      >
                        <div className="space-y-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono tabular-nums font-bold text-foreground text-sm">
                              Room {alloc.room.roomNo}
                            </span>
                            <span className="text-muted-foreground truncate text-[11px]">
                              • {alloc.roomCategory.name}
                            </span>
                          </div>
                          <div className="text-muted-foreground truncate text-xs">
                            Guest:{" "}
                            <span className="font-semibold text-foreground">
                              {alloc.reservation.customer.firstName}{" "}
                              {alloc.reservation.customer.lastName}
                            </span>{" "}
                            <span className="font-mono text-[11px] text-muted-foreground/70">
                              (#{alloc.reservation.reservationNo})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <StatusBadge status={alloc.room.status} size="sm" />
                          <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Departures Today */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <LogOut className="size-4 text-sky-600 dark:text-sky-400" />
                    <h2 className="text-sm font-bold tracking-tight text-foreground uppercase tracking-wider font-mono text-xs">
                      Departures Today
                    </h2>
                  </div>
                  <span className="rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 px-2 py-0.5 text-xs font-mono tabular-nums font-semibold">
                    {departures.length} scheduled
                  </span>
                </div>

                {departures.length === 0 ? (
                  <EmptyState
                    icon={<LogOut className="size-5" />}
                    title="No departures scheduled today"
                    description="No guest check-outs scheduled for today's shift."
                    className="min-h-44"
                  />
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
                    {departures.map((alloc) => (
                      <Link
                        key={alloc.id}
                        href={`/reservations/${alloc.reservationId}`}
                        className="flex items-center justify-between p-3.5 text-xs transition-colors hover:bg-muted/40 group"
                      >
                        <div className="space-y-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono tabular-nums font-bold text-foreground text-sm">
                              Room {alloc.room.roomNo}
                            </span>
                            <span className="text-muted-foreground truncate text-[11px]">
                              • {alloc.roomCategory.name}
                            </span>
                          </div>
                          <div className="text-muted-foreground truncate text-xs">
                            Guest:{" "}
                            <span className="font-semibold text-foreground">
                              {alloc.reservation.customer.firstName}{" "}
                              {alloc.reservation.customer.lastName}
                            </span>{" "}
                            <span className="font-mono text-[11px] text-muted-foreground/70">
                              (#{alloc.reservation.reservationNo})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <StatusBadge status={alloc.room.status} size="sm" />
                          <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-8 text-center shadow-lg">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="size-6" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                byteInn Reception PMS
              </h2>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Internal property management system for reception desk staff.
                Please sign in to access room allocations, operational status boards,
                and reservations.
              </p>
              <div className="mt-6">
                <Link href="/login" className="block w-full">
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    Sign in to byteInn
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
