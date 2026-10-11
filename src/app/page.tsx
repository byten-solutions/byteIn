import Link from "next/link"
import {
  BedDouble,
  CalendarDays,
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
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import {
  PageHeader,
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
    const today = new Date()
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
          <div className="space-y-8">
            {/* Header */}
            <PageHeader
              title={`Welcome back, ${session.name}`}
              description={`Reception Desk • Role: ${session.role}`}
              action={
                <div className="flex items-center gap-2">
                  <Link href="/rooms">
                    <Button variant="outline" size="sm" className="h-9">
                      <BedDouble className="mr-1.5 size-4" />
                      Rooms
                    </Button>
                  </Link>
                  <Link href="/reservations/new">
                    <Button size="sm" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90">
                      <Plus className="mr-1.5 size-4" />
                      New Reservation
                    </Button>
                  </Link>
                </div>
              }
            />

            {/* Stat Row (4) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                subtext={`${counts.confirmedReservations} active reservation${counts.confirmedReservations === 1 ? "" : "s"}`}
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

            {/* Active reservations inline link strip */}
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/60 px-5 py-3.5 text-xs">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Active confirmed reservations:{" "}
                  <strong className="font-mono text-foreground font-semibold">
                    {counts.confirmedReservations}
                  </strong>{" "}
                  of {counts.reservations} total
                </span>
              </div>
              <Link
                href="/reservations"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <span>View all reservations</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </div>

            {/* Arrivals and Departures today */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Arrivals Today */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LogIn className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      Arrivals Today
                    </h2>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono font-medium text-muted-foreground">
                    {arrivals.length}
                  </span>
                </div>

                {arrivals.length === 0 ? (
                  <EmptyState
                    icon={<LogIn className="size-5" />}
                    title="No arrivals scheduled today"
                    description="No confirmed guest check-ins arriving today."
                    className="min-h-48"
                  />
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs">
                    {arrivals.map((alloc) => (
                      <Link
                        key={alloc.id}
                        href={`/reservations/${alloc.reservationId}`}
                        className="flex items-center justify-between p-4 text-xs transition-colors hover:bg-muted/40 group"
                      >
                        <div className="space-y-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground text-sm">
                              Room {alloc.room.roomNo}
                            </span>
                            <span className="text-muted-foreground truncate">
                              • {alloc.roomCategory.name}
                            </span>
                          </div>
                          <div className="text-muted-foreground truncate">
                            Guest:{" "}
                            <span className="font-medium text-foreground">
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
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LogOut className="size-4 text-sky-600 dark:text-sky-400" />
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      Departures Today
                    </h2>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono font-medium text-muted-foreground">
                    {departures.length}
                  </span>
                </div>

                {departures.length === 0 ? (
                  <EmptyState
                    icon={<LogOut className="size-5" />}
                    title="No departures scheduled today"
                    description="No guest check-outs scheduled for today."
                    className="min-h-48"
                  />
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs">
                    {departures.map((alloc) => (
                      <Link
                        key={alloc.id}
                        href={`/reservations/${alloc.reservationId}`}
                        className="flex items-center justify-between p-4 text-xs transition-colors hover:bg-muted/40 group"
                      >
                        <div className="space-y-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground text-sm">
                              Room {alloc.room.roomNo}
                            </span>
                            <span className="text-muted-foreground truncate">
                              • {alloc.roomCategory.name}
                            </span>
                          </div>
                          <div className="text-muted-foreground truncate">
                            Guest:{" "}
                            <span className="font-medium text-foreground">
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
