import { Suspense } from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  BedDouble,
  Plus,
  ShieldCheck,
  ArrowRight,
  LogIn,
  LogOut,
  ChevronRight,
  Building2,
  Users,
  Sparkles,
  ArrowUpRight,
} from "lucide-react"
import { RoleName } from "@prisma/client"
import { getSession } from "@/lib/auth-guard"
import { DashboardService } from "@/modules/dashboard/dashboard.service"
import { CheckInOutService } from "@/modules/check-in-out/check-in-out.service"
import { getHotelTodayDateUtc } from "@/lib/date"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  StatCard,
  StatusBadge,
  EmptyState,
} from "@/components/ui-kit"

export default async function Page() {
  const session = await getSession()
  if (session?.mustChangePassword) {
    redirect("/change-password")
  }

  // If Super Admin: Render Platform Overview Dashboard
  if (session?.role === RoleName.SUPER_ADMIN) {
    const {
      properties,
      totalRooms,
      activeHotels,
      totalUsers,
      totalConfirmedRes,
      totalRevenue,
    } = await DashboardService.getPlatformStats()

    return (
      <AppShell session={session}>
        <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-10">
          <div className="space-y-8">
            {/* Super Admin Platform Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    Platform Administration
                  </h1>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                    Super Admin
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Global System Console • Administrator: <span className="font-medium text-foreground">{session.name}</span> ({session.email})
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link href="/properties">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/80">
                    <Building2 className="size-3.5" />
                    Manage Hotels
                  </Button>
                </Link>
                <Link href="/users">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/80">
                    <Users className="size-3.5" />
                    Staff Accounts
                  </Button>
                </Link>
                <Link href="/reports">
                  <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs">
                    <Sparkles className="size-3.5" />
                    Global Reports
                  </Button>
                </Link>
              </div>
            </div>

            {/* Platform KPI Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                label="Properties"
                value={properties.length}
                subtext={`${activeHotels} Active • ${properties.length - activeHotels} Inactive`}
                indicatorColor="bg-purple-500"
                href="/properties"
              />
              <StatCard
                label="Total Rooms"
                value={totalRooms}
                subtext={`Across ${properties.length} properties`}
                indicatorColor="bg-emerald-500"
                href="/rooms"
              />
              <StatCard
                label="Active Staff"
                value={totalUsers}
                subtext="Hotel admins & receptionists"
                indicatorColor="bg-sky-500"
                href="/users"
              />
              <StatCard
                label="Platform Revenue"
                value={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtext={`${totalConfirmedRes} active confirmed bookings`}
                indicatorColor="bg-amber-500"
                href="/reports"
              />
            </div>

            {/* Hotel Portfolio Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Building2 className="size-4 text-primary" />
                    Hotel Portfolio Directory
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    All managed hotel properties, live operational capacity, and assigned staff
                  </p>
                </div>
                <Link href="/properties">
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-primary hover:text-primary">
                    View All
                    <ArrowUpRight className="size-3.5" />
                  </Button>
                </Link>
              </div>

              {properties.length === 0 ? (
                <EmptyState
                  icon={<Building2 className="size-6" />}
                  title="No properties configured"
                  description="Add hotel properties in the Property Manager to begin dispatching operations."
                  action={
                    <Link href="/properties">
                      <Button size="sm">Add First Property</Button>
                    </Link>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {properties.map((prop) => {
                    const cleanRooms = prop.cleanRooms
                    const occupiedRooms = prop.occupiedRooms

                    return (
                      <div
                        key={prop.id}
                        className="rounded-xl border border-border/80 bg-card p-5 shadow-2xs hover:border-primary/40 transition-colors flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                {prop.name}
                              </h3>
                              {prop.city && (
                                <p className="text-xs text-muted-foreground">
                                  {prop.city}{prop.country ? `, ${prop.country}` : ""}
                                </p>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full border ${
                                prop.status === "ACTIVE"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                                  : "bg-muted text-muted-foreground border-border"
                              }`}
                            >
                              {prop.status}
                            </span>
                          </div>

                          {prop.address && (
                            <p className="text-xs text-muted-foreground truncate" title={prop.address}>
                              {prop.address}
                              {prop.city ? `, ${prop.city}` : ""}
                            </p>
                          )}

                          {/* Quick stat counters */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center">
                            <div className="rounded-lg bg-muted/40 p-2">
                              <div className="text-xs font-bold text-foreground font-mono tabular-nums">
                                {prop._count.rooms}
                              </div>
                              <div className="text-[10px] text-muted-foreground">Total Rooms</div>
                            </div>
                            <div className="rounded-lg bg-emerald-500/10 p-2">
                              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">
                                {cleanRooms}
                              </div>
                              <div className="text-[10px] text-muted-foreground">Clean Ready</div>
                            </div>
                            <div className="rounded-lg bg-sky-500/10 p-2">
                              <div className="text-xs font-bold text-sky-700 dark:text-sky-300 font-mono tabular-nums">
                                {occupiedRooms}
                              </div>
                              <div className="text-[10px] text-muted-foreground">Occupied</div>
                            </div>
                          </div>
                        </div>

                        {/* Hotel Quick Actions */}
                        <div className="flex items-center gap-2 pt-4 mt-2 border-t border-border/60">
                          <Link href={`/rooms?propertyId=${prop.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full h-7 text-[11px] gap-1">
                              <BedDouble className="size-3" />
                              Rack
                            </Button>
                          </Link>
                          <Link href={`/reservations?propertyId=${prop.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full h-7 text-[11px] gap-1">
                              Bookings
                            </Button>
                          </Link>
                          <Link href={`/users?propertyId=${prop.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" title="Manage Staff">
                              <Users className="size-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  const counts = session
    ? await DashboardService.getHotelStats(session.propertyId || undefined)
    : {
        total: 0,
        clean: 0,
        dirty: 0,
        occupied: 0,
        maintenance: 0,
        outOfService: 0,
        confirmedReservations: 0,
      }

  const hotelName = session?.property?.name || "Hotel"

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
                    {hotelName} Reception Dispatch
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
            <Suspense fallback={<DailyOperationsSkeleton />}>
              <DailyOperationsSection propertyId={session.propertyId || undefined} />
            </Suspense>
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

function DailyOperationsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  )
}

const DAILY_OPS_PREVIEW_LIMIT = 5

async function DailyOperationsSection({ propertyId }: { propertyId?: string }) {
  const today = getHotelTodayDateUtc()
  const [arrivals, departures] = await Promise.all([
    CheckInOutService.getDailyArrivals(today, propertyId),
    CheckInOutService.getDailyDepartures(today, propertyId),
  ])

  const visibleArrivals = arrivals.slice(0, DAILY_OPS_PREVIEW_LIMIT)
  const visibleDepartures = departures.slice(0, DAILY_OPS_PREVIEW_LIMIT)

  const arrivalsHref = propertyId ? `/reports?propertyId=${encodeURIComponent(propertyId)}` : "/reports"
  const departuresHref = propertyId
    ? `/reports?subtab=departures&propertyId=${encodeURIComponent(propertyId)}`
    : "/reports?subtab=departures"

  return (
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
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2 py-0.5 text-xs font-mono tabular-nums font-semibold">
              {arrivals.length} scheduled
            </span>
            {arrivals.length > 0 && (
              <Link
                href={arrivalsHref}
                className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
              >
                <span>View more</span>
                <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
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
            {visibleArrivals.map((alloc) => (
              <Link
                key={alloc.id}
                href={`/reservations/${alloc.reservationId}`}
                className="flex items-center justify-between p-3.5 text-xs transition-colors hover:bg-muted/40 group"
              >
                <div className="space-y-1 min-w-0 pr-3">
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
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 px-2 py-0.5 text-xs font-mono tabular-nums font-semibold">
              {departures.length} scheduled
            </span>
            {departures.length > 0 && (
              <Link
                href={departuresHref}
                className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
              >
                <span>View more</span>
                <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
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
            {visibleDepartures.map((alloc) => (
              <Link
                key={alloc.id}
                href={`/reservations/${alloc.reservationId}`}
                className="flex items-center justify-between p-3.5 text-xs transition-colors hover:bg-muted/40 group"
              >
                <div className="space-y-1 min-w-0 pr-3">
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
  )
}
