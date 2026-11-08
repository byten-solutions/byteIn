import { Suspense } from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  BedDouble,
  Plus,
  ShieldCheck,
  ArrowRight,
  Building2,
  Users,
  Sparkles,
  ArrowUpRight,
} from "lucide-react"
import { RoleName } from "@prisma/client"
import { getSession } from "@/lib/auth-guard"
import { DashboardService } from "@/modules/dashboard/dashboard.service"
import { CheckInOutService } from "@/modules/check-in-out/check-in-out.service"
import { ReportsService } from "@/modules/reports/reports.service"
import { getHotelTodayDate, getHotelTodayDateUtc } from "@/lib/date"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  StatCard,
  EmptyState,
} from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import {
  RoomInventoryDonut,
  OccupancyRevenueChart,
  OccupancyRevenueSkeleton,
  ShiftCollectionsCard,
  ShiftCollectionsSkeleton,
  OperationsDispatchCard,
  PlatformCapacityBar,
  PropertyMiniCapacityBar,
} from "@/components/dashboard"

export default async function Page() {
  const session = await getSession()
  if (session?.mustChangePassword) {
    redirect("/change-password")
  }

  // If Super Admin: Render Platform Overview Dashboard
  if (session?.role === RoleName.SUPER_ADMIN) {
    let platformStats
    try {
      platformStats = await DashboardService.getPlatformStats()
    } catch (err) {
      console.error("Failed to load platform stats:", err)
      platformStats = {
        properties: [],
        totalRooms: 0,
        activeHotels: 0,
        totalUsers: 0,
        totalConfirmedRes: 0,
        totalRevenue: 0,
      }
    }
    const {
      properties,
      totalRooms,
      activeHotels,
      totalUsers,
      totalConfirmedRes,
      totalRevenue,
    } = platformStats

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
                value={formatMoney(totalRevenue)}
                subtext={`${totalConfirmedRes} active confirmed bookings`}
                indicatorColor="bg-amber-500"
                href="/reports"
              />
            </div>

            {/* Global Portfolio Capacity Visualization */}
            <PlatformCapacityBar properties={properties} totalRooms={totalRooms} />

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
                              className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full border ${prop.status === "ACTIVE"
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

                          {/* Mini Capacity Bar */}
                          <PropertyMiniCapacityBar
                            cleanRooms={cleanRooms}
                            occupiedRooms={occupiedRooms}
                            totalRooms={prop._count.rooms}
                          />

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

  let counts = {
    total: 0,
    clean: 0,
    dirty: 0,
    occupied: 0,
    maintenance: 0,
    outOfService: 0,
    confirmedReservations: 0,
  }

  if (session) {
    try {
      counts = await DashboardService.getHotelStats(session.propertyId || undefined)
    } catch (err) {
      console.error("Failed to load hotel stats:", err)
    }
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
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {hotelName}
                </h1>
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
                subtext="Currently in-house"
                indicatorColor="bg-sky-500"
                href="/rooms?status=OCCUPIED"
              />
              <StatCard
                label="Maint & OOS"
                value={counts.maintenance + counts.outOfService}
                subtext={
                  counts.outOfService > 0
                    ? `${counts.maintenance} maint · ${counts.outOfService} out of service`
                    : "Maintenance & out of service"
                }
                indicatorColor="bg-purple-500"
                href="/rooms?status=MAINTENANCE"
              />
            </div>

            {/* Middle Section: Occupancy & Revenue Spline Area Chart (2/3) + Room Inventory Donut (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <Suspense fallback={<OccupancyRevenueSkeleton />}>
                  <OccupancyRevenueChart propertyId={session.propertyId || undefined} />
                </Suspense>
              </div>

              <div className="lg:col-span-1">
                <RoomInventoryDonut counts={counts} />
              </div>
            </div>

            {/* Bottom Section: Operations Dispatch (2/3) + Shift Drawer & Collections (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <Suspense fallback={<DailyOperationsSkeleton />}>
                  <DailyOperationsSection propertyId={session.propertyId || undefined} />
                </Suspense>
              </div>

              <div className="lg:col-span-1">
                <Suspense fallback={<ShiftCollectionsSkeleton />}>
                  <ShiftCollectionsCard propertyId={session.propertyId || undefined} />
                </Suspense>
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

function DailyOperationsSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs h-full flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-64 rounded-lg" />
      </div>
      <div className="space-y-2 flex-1">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <div className="pt-2 border-t border-border/60 flex items-center justify-end">
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

const DAILY_OPS_PREVIEW_LIMIT = 6

async function DailyOperationsSection({ propertyId }: { propertyId?: string }) {
  const todayStr = getHotelTodayDate()
  const todayUtc = getHotelTodayDateUtc()

  let opsCounts: Awaited<ReturnType<typeof ReportsService.getDailyOperationsCounts>> = {
    targetDate: todayStr,
    arrivals: 0,
    checkedInArrivals: 0,
    departures: 0,
    checkedOutDepartures: 0,
    inHouse: 0,
    overdue: 0,
    expectedArrivalsCount: 0,
    expectedDeparturesCount: 0,
    inHouseCount: 0,
    pendingArrivalsCount: 0,
  }
  let arrivals: Awaited<ReturnType<typeof CheckInOutService.getDailyArrivals>> = []
  let departures: Awaited<ReturnType<typeof CheckInOutService.getDailyDepartures>> = []

  try {
    const res = await Promise.all([
      ReportsService.getDailyOperationsCounts(todayStr, propertyId),
      CheckInOutService.getDailyArrivals(todayUtc, propertyId, DAILY_OPS_PREVIEW_LIMIT),
      CheckInOutService.getDailyDepartures(todayUtc, propertyId, DAILY_OPS_PREVIEW_LIMIT),
    ])
    opsCounts = res[0]
    arrivals = res[1]
    departures = res[2]
  } catch (err) {
    console.error("Failed to load daily operations in DailyOperationsSection:", err)
  }

  return (
    <OperationsDispatchCard
      counts={opsCounts}
      arrivals={arrivals}
      departures={departures}
      propertyId={propertyId}
    />
  )
}
