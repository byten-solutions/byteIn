import { redirect } from "next/navigation"
import Link from "next/link"
import {
  ShieldCheck,
  ArrowRight,
  Building2,
  Users,
  Sparkles,
  ArrowUpRight,
} from "lucide-react"
import { RoleName } from "@prisma/client"
import { getSession } from "@/lib/auth-guard"
import {
  DashboardService,
  type AdminDashboardMetrics,
  type HotelDashboardStats,
  type PlatformPropertyOverview,
} from "@/modules/dashboard/dashboard.service"
import { CheckInOutService } from "@/modules/check-in-out/check-in-out.service"
import { ReportsService } from "@/modules/reports/reports.service"
import { PropertyService } from "@/modules/properties/property.service"
import { getHotelTodayDate, getHotelTodayDateUtc } from "@/lib/date"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import {
  ShiftCollectionsCard,
  RoomInventoryStatusCard,
  CompactMetricBand,
  TodayArrivalsPreview,
  TodayDeparturesPreview,
  DashboardQuickActions,
  PropertyContextSelector,
} from "@/components/dashboard"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ShiftCollectionsReportDTO } from "@/modules/reports/reports.types"

interface PageProps {
  searchParams?: Promise<{ propertyId?: string }>
}

function getEmptyShiftCollections(dateStr: string): ShiftCollectionsReportDTO {
  return {
    targetDate: dateStr,
    startDate: dateStr,
    endDate: dateStr,
    totalCollected: "0.00",
    totalTransactions: 0,
    methodBreakdown: [],
    staffBreakdown: [],
    transactions: [],
    pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
  }
}

export default async function Page(props: PageProps) {
  const searchParams = props.searchParams ? await props.searchParams : undefined
  const session = await getSession()

  if (session?.mustChangePassword) {
    redirect("/change-password")
  }

  // 1. Unauthenticated Visitor Landing
  if (!session) {
    return (
      <AppShell session={null}>
        <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
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
        </div>
      </AppShell>
    )
  }

  const todayStr = getHotelTodayDate()
  const todayUtc = getHotelTodayDateUtc()

  // 2. SUPER_ADMIN: Handle Single Hotel Mode vs Portfolio Overview Mode
  if (session.role === RoleName.SUPER_ADMIN) {
    const rawProperties = await PropertyService.getProperties()
    const activeProperties = rawProperties.map((p) => ({
      id: p.id,
      name: p.name,
      city: p.city,
      status: p.status,
    }))

    // If Super Admin has selected an explicit hotel (Hotel Mode):
    if (searchParams?.propertyId) {
      const targetProperty = activeProperties.find((p) => p.id === searchParams.propertyId)
      if (targetProperty) {
        const shiftCollectionsPromise = ReportsService.getShiftCollections(
          todayStr,
          undefined,
          undefined,
          undefined,
          targetProperty.id
        ).catch((err) => {
          console.error("Dashboard Super Admin hotel shift collections fetch failed:", err)
          return getEmptyShiftCollections(todayStr)
        })

        const [adminMetrics, hotelStats, arrivals, departures, opsCounts, shiftCollections] = await Promise.all([
          DashboardService.getAdminDashboardMetrics(targetProperty.id),
          DashboardService.getHotelStats(targetProperty.id),
          CheckInOutService.getDailyArrivals(todayUtc, targetProperty.id, 5),
          CheckInOutService.getDailyDepartures(todayUtc, targetProperty.id, 5),
          ReportsService.getDailyOperationsCounts(todayStr, targetProperty.id),
          shiftCollectionsPromise,
        ])

        const superAdminBanner = (
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300">
                <Building2 className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground">
                    {targetProperty.name}
                  </h2>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                    Super Admin: Hotel Mode
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Inspecting single hotel dashboard with full administrative controls
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <PropertyContextSelector
                properties={activeProperties}
                selectedPropertyId={targetProperty.id}
              />
              <Link href="/">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Portfolio Overview
                </Button>
              </Link>
            </div>
          </div>
        )

        return (
          <AppShell
            session={session}
            stats={{ cleanRooms: hotelStats.clean, dirtyRooms: hotelStats.dirty }}
          >
            <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
              <AdminDashboardView
                hotelName={targetProperty.name}
                propertyId={targetProperty.id}
                role={RoleName.SUPER_ADMIN}
                adminMetrics={adminMetrics}
                arrivals={arrivals}
                arrivalsCount={opsCounts.arrivals}
                departures={departures}
                departuresCount={opsCounts.departures}
                shiftCollections={shiftCollections}
                superAdminBanner={superAdminBanner}
              />
            </div>
          </AppShell>
        )
      }
    }

    // Default: Super Admin Global Portfolio Overview Mode
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
        platformCollections: 0,
      }
    }

    return (
      <AppShell session={session}>
        <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-10">
          <SuperAdminPortfolioView
            session={session}
            platformStats={platformStats}
            activeProperties={activeProperties}
          />
        </div>
      </AppShell>
    )
  }

  // 3. ADMIN: Curated Operational & Financial Overview
  if (session.role === RoleName.ADMIN) {
    const propertyId = session.propertyId
    if (!propertyId) {
      return (
        <AppShell session={session}>
          <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
            <EmptyState
              icon={<Building2 className="size-6" />}
              title="No property assigned"
              description="Your account is not currently linked to an active hotel property."
            />
          </div>
        </AppShell>
      )
    }

    const shiftCollectionsPromise = ReportsService.getShiftCollections(
      todayStr,
      undefined,
      undefined,
      undefined,
      propertyId
    ).catch((err) => {
      console.error("Dashboard Admin shift collections fetch failed:", err)
      return getEmptyShiftCollections(todayStr)
    })

    const [adminMetrics, hotelStats, arrivals, departures, opsCounts, shiftCollections] = await Promise.all([
      DashboardService.getAdminDashboardMetrics(propertyId),
      DashboardService.getHotelStats(propertyId),
      CheckInOutService.getDailyArrivals(todayUtc, propertyId, 5),
      CheckInOutService.getDailyDepartures(todayUtc, propertyId, 5),
      ReportsService.getDailyOperationsCounts(todayStr, propertyId),
      shiftCollectionsPromise,
    ])

    const hotelName = session.property?.name || "Hotel Administration"

    return (
      <AppShell
        session={session}
        stats={{ cleanRooms: hotelStats.clean, dirtyRooms: hotelStats.dirty }}
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
          <AdminDashboardView
            hotelName={hotelName}
            propertyId={propertyId}
            role={RoleName.ADMIN}
            adminMetrics={adminMetrics}
            arrivals={arrivals}
            arrivalsCount={opsCounts.arrivals}
            departures={departures}
            departuresCount={opsCounts.departures}
            shiftCollections={shiftCollections}
          />
        </div>
      </AppShell>
    )
  }

  // 4. RECEPTIONIST: Pure Front-Desk Operational Dispatch
  const receptionistPropertyId = session.propertyId
  if (!receptionistPropertyId) {
    return (
      <AppShell session={session}>
        <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
          <EmptyState
            icon={<Building2 className="size-6" />}
            title="No property assigned"
            description="Your receptionist account is not currently linked to an active hotel property."
          />
        </div>
      </AppShell>
    )
  }

  const shiftCollectionsPromise = ReportsService.getShiftCollections(
    todayStr,
    undefined,
    undefined,
    undefined,
    receptionistPropertyId
  ).catch((err) => {
    console.error("Dashboard Receptionist shift collections fetch failed:", err)
    return getEmptyShiftCollections(todayStr)
  })

  const [receptionistStats, arrivals, departures, opsCounts, shiftCollections] = await Promise.all([
    DashboardService.getHotelStats(receptionistPropertyId),
    CheckInOutService.getDailyArrivals(todayUtc, receptionistPropertyId, 5),
    CheckInOutService.getDailyDepartures(todayUtc, receptionistPropertyId, 5),
    ReportsService.getDailyOperationsCounts(todayStr, receptionistPropertyId),
    shiftCollectionsPromise,
  ])
  const receptionistHotelName = session.property?.name || "Reception Desk"

  return (
    <AppShell
      session={session}
      stats={{ cleanRooms: receptionistStats.clean, dirtyRooms: receptionistStats.dirty }}
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
        <ReceptionistDashboardView
          hotelName={receptionistHotelName}
          propertyId={receptionistPropertyId}
          hotelStats={receptionistStats}
          arrivals={arrivals}
          arrivalsCount={opsCounts.arrivals}
          departures={departures}
          departuresCount={opsCounts.departures}
          shiftCollections={shiftCollections}
        />
      </div>
    </AppShell>
  )
}

// ----------------------------------------------------------------------------
// ADMIN / SUPER ADMIN HOTEL VIEW
// ----------------------------------------------------------------------------
function AdminDashboardView({
  hotelName,
  propertyId,
  role,
  adminMetrics,
  arrivals,
  arrivalsCount,
  departures,
  departuresCount,
  shiftCollections,
  superAdminBanner,
}: {
  hotelName: string
  propertyId: string
  role: RoleName
  adminMetrics: AdminDashboardMetrics
  arrivals: Awaited<ReturnType<typeof CheckInOutService.getDailyArrivals>>
  arrivalsCount: number
  departures: Awaited<ReturnType<typeof CheckInOutService.getDailyDepartures>>
  departuresCount: number
  shiftCollections: ShiftCollectionsReportDTO
  superAdminBanner?: React.ReactNode
}) {
  const hotelStats = {
    total: adminMetrics.totalRooms,
    clean: adminMetrics.cleanRooms,
    dirty: adminMetrics.dirtyRooms,
    occupied: adminMetrics.occupiedRooms,
    maintenance: adminMetrics.maintenanceRooms,
    outOfService: 0,
  }

  const adminKpiMetrics = [
    {
      label: "Occupancy Rate",
      value: `${adminMetrics.occupancyRate}%`,
      detail: `${adminMetrics.occupiedRooms}/${adminMetrics.totalRooms} rooms occupied`,
      indicatorColor: "bg-sky-500",
      href: `/rooms?propertyId=${propertyId}`,
    },
    {
      label: "Available Clean",
      value: adminMetrics.cleanRooms,
      detail: "Ready for check-in",
      indicatorColor: "bg-emerald-500",
      href: `/rooms?status=VACANT_CLEAN&propertyId=${propertyId}`,
    },
    {
      label: "Today's Collections",
      value: formatMoney(adminMetrics.todayCollections),
      detail: "Realized receipts",
      indicatorColor: "bg-indigo-500",
      href: `/reports/collections?propertyId=${propertyId}`,
    },
    {
      label: "Today's Disbursements",
      value: formatMoney(adminMetrics.todayOutgoingPayments),
      detail: "Cash disbursed",
      indicatorColor: "bg-rose-500",
      href: `/finance?tab=expenses&propertyId=${propertyId}`,
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      {superAdminBanner}

      {/* 1. Hotel Heading */}
      <div className="pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {hotelName}
          </h1>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
            Hotel Administration
          </span>
        </div>
      </div>

      {/* 2. Four Primary KPIs in One Compact Horizontal Metric Band */}
      <CompactMetricBand metrics={adminKpiMetrics} />

      {/* 3. Dashboard Quick Links */}
      <DashboardQuickActions role={role} propertyId={propertyId} />

      {/* 4. Side-by-Side Operational Dispatch: Arrivals (50%) & Departures (50%) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <TodayArrivalsPreview
          arrivals={arrivals}
          totalCount={arrivalsCount}
          propertyId={propertyId}
        />
        <TodayDeparturesPreview
          departures={departures}
          totalCount={departuresCount}
          propertyId={propertyId}
        />
      </div>

      {/* 5. Front Desk Financial & Room Turnover Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <ShiftCollectionsCard propertyId={propertyId} initialData={shiftCollections} />
        <RoomInventoryStatusCard propertyId={propertyId} stats={hotelStats} />
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// RECEPTIONIST VIEW (PURE OPERATIONAL FOCUS)
// ----------------------------------------------------------------------------
function ReceptionistDashboardView({
  hotelName,
  propertyId,
  hotelStats,
  arrivals,
  arrivalsCount,
  departures,
  departuresCount,
  shiftCollections,
}: {
  hotelName: string
  propertyId: string
  hotelStats: HotelDashboardStats
  arrivals: Awaited<ReturnType<typeof CheckInOutService.getDailyArrivals>>
  arrivalsCount: number
  departures: Awaited<ReturnType<typeof CheckInOutService.getDailyDepartures>>
  departuresCount: number
  shiftCollections: ShiftCollectionsReportDTO
}) {
  const receptionistKpiMetrics = [
    {
      label: "Vacant Clean",
      value: hotelStats.clean,
      detail: "Ready for check-in",
      indicatorColor: "bg-emerald-500",
      href: "/rooms?status=VACANT_CLEAN",
    },
    {
      label: "Vacant Dirty",
      value: hotelStats.dirty,
      detail: "Turnover needed",
      indicatorColor: "bg-amber-500",
      href: "/rooms?status=VACANT_DIRTY",
    },
    {
      label: "Occupied",
      value: hotelStats.occupied,
      detail: "Currently in-house",
      indicatorColor: "bg-sky-500",
      href: "/rooms?status=OCCUPIED",
    },
    {
      label: "Maint & OOS",
      value: hotelStats.maintenance + hotelStats.outOfService,
      detail:
        hotelStats.outOfService > 0
          ? `${hotelStats.maintenance} maint · ${hotelStats.outOfService} OOS`
          : "Maintenance & OOS",
      indicatorColor: "bg-purple-500",
      href: "/rooms?status=MAINTENANCE",
    },
  ]

  return (
    <div className="space-y-5">
      {/* 1. Hotel Heading */}
      <div className="pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {hotelName}
          </h1>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
            Reception Desk
          </span>
        </div>
      </div>

      {/* 2. Four Room Status KPIs in One Compact Horizontal Metric Band */}
      <CompactMetricBand metrics={receptionistKpiMetrics} />

      {/* 3. Compact Quick Links Row: New Reservation & Collect Payment */}
      <DashboardQuickActions
        role={RoleName.RECEPTIONIST}
        propertyId={propertyId}
      />

      {/* 4. Side-by-Side Operational Dispatch: Arrivals & Departures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <TodayArrivalsPreview
          arrivals={arrivals}
          totalCount={arrivalsCount}
          propertyId={propertyId}
        />
        <TodayDeparturesPreview
          departures={departures}
          totalCount={departuresCount}
          propertyId={propertyId}
        />
      </div>

      {/* 5. Front Desk Financial & Room Turnover Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <ShiftCollectionsCard propertyId={propertyId} initialData={shiftCollections} />
        <RoomInventoryStatusCard propertyId={propertyId} stats={hotelStats} />
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// SUPER ADMIN PORTFOLIO VIEW
// ----------------------------------------------------------------------------
function SuperAdminPortfolioView({
  session,
  platformStats,
  activeProperties,
}: {
  session: { name: string; email: string }
  platformStats: {
    properties: PlatformPropertyOverview[]
    totalRooms: number
    activeHotels: number
    totalUsers: number
    totalConfirmedRes: number
    totalRevenue: number
    platformCollections: number
  }
  activeProperties: Array<{ id: string; name: string; city?: string | null }>
}) {
  const {
    properties,
    totalRooms,
    activeHotels,
    totalUsers,
    totalRevenue,
    platformCollections,
  } = platformStats

  const platformKpiMetrics = [
    {
      label: "Properties",
      value: properties.length,
      detail: `${activeHotels} active · ${properties.length - activeHotels} inactive`,
      indicatorColor: "bg-purple-500",
      href: "/properties",
    },
    {
      label: "Total Rooms",
      value: totalRooms,
      detail: `Across ${properties.length} properties`,
      indicatorColor: "bg-emerald-500",
      href: "/rooms",
    },
    {
      label: "Active Staff",
      value: totalUsers,
      detail: "Hotel admins & receptionists",
      indicatorColor: "bg-sky-500",
      href: "/users",
    },
    {
      label: "Gross Platform Revenue",
      value: formatMoney(totalRevenue),
      detail: `${formatMoney(platformCollections)} collected`,
      indicatorColor: "bg-amber-500",
      href: "/reports",
    },
  ]

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 1. Super Admin Platform Header */}
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
            Global Portfolio Console • Administrator: <span className="font-medium text-foreground">{session.name}</span> ({session.email})
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <PropertyContextSelector properties={activeProperties} />
          <Link href="/properties">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/80">
              <Building2 className="size-3.5" />
              Hotels
            </Button>
          </Link>
          <Link href="/users">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/80">
              <Users className="size-3.5" />
              Staff
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

      {/* 2. Platform KPI Metrics */}
      <CompactMetricBand metrics={platformKpiMetrics} />

      {/* 3. Hotel Portfolio Directory Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Hotel Portfolio Directory
            </h2>
            <p className="text-xs text-muted-foreground">
              All managed hotel properties, live operational capacity, and property dashboard inspection
            </p>
          </div>
          <Link href="/properties">
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-primary hover:text-primary">
              Manage All
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
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold text-xs text-foreground">Property</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground text-center">Rooms</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground">Operational Status</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground text-center">Staff</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((prop) => (
                  <TableRow key={prop.id} className="hover:bg-muted/20">
                    <TableCell className="py-3">
                      <Link
                        href={`/?propertyId=${prop.id}`}
                        className="font-bold text-sm text-foreground hover:text-primary transition-colors block"
                      >
                        {prop.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {prop.city ? `${prop.city}${prop.country ? `, ${prop.country}` : ""}` : "Location not set"}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <span
                        className={`text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full border ${
                          prop.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {prop.status}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-center font-mono font-medium text-xs">
                      {prop._count.rooms}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {prop.cleanRooms} clean
                          </span>
                          <span className="text-muted-foreground/40">•</span>
                          <span className="text-sky-600 dark:text-sky-400 font-medium">
                            {prop.occupiedRooms} occupied
                          </span>
                        </div>
                        <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden flex">
                          <div
                            className="bg-sky-500 h-full"
                            style={{
                              width: `${prop._count.rooms > 0 ? (prop.occupiedRooms / prop._count.rooms) * 100 : 0}%`,
                            }}
                          />
                          <div
                            className="bg-emerald-500 h-full"
                            style={{
                              width: `${prop._count.rooms > 0 ? (prop.cleanRooms / prop._count.rooms) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-center font-mono font-medium text-xs">
                      {prop._count.users}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Link href={`/?propertyId=${prop.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          Inspect Dashboard →
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
