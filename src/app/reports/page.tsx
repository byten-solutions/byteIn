import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth-guard"
import { ReportsService } from "@/modules/reports/reports.service"
import { AppShell } from "@/components/app-shell"
import { ReportsView } from "./reports-view"

import { getHotelTodayDate, getHotelTodayDateUtc } from "@/lib/date"

export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  const todayStr = getHotelTodayDate()
  const [y, m] = todayStr.split("-")

  // Default: from 1st of current month to today
  const defaultStartDate = `${y}-${m}-01`
  const defaultEndDate = todayStr

  const todayUtc = getHotelTodayDateUtc()
  const weekLater = new Date(todayUtc.getTime() + 6 * 24 * 60 * 60 * 1000)
  const weekLaterStr = weekLater.toISOString().split("T")[0]!

  const [
    initialOccupancy,
    initialRevenue,
    initialReservations,
    initialDailyOps,
    initialAvailabilityGrid,
    initialCollections,
    initialReceivables,
  ] = await Promise.all([
    ReportsService.getOccupancyReport({
      startDate: defaultStartDate,
      endDate: defaultEndDate,
    }),
    ReportsService.getRevenueReport({
      startDate: defaultStartDate,
      endDate: defaultEndDate,
    }),
    ReportsService.getReservationStatusReport({
      startDate: defaultStartDate,
      endDate: defaultEndDate,
    }),
    ReportsService.getDailyOperations(defaultEndDate),
    ReportsService.getAvailabilityGrid(defaultEndDate, weekLaterStr),
    ReportsService.getShiftCollections(defaultEndDate),
    ReportsService.getReceivablesReport(),
  ])

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ReportsView
          initialStartDate={defaultStartDate}
          initialEndDate={defaultEndDate}
          initialTodayDate={defaultEndDate}
          initialWeekLaterDate={weekLaterStr}
          initialOccupancy={initialOccupancy}
          initialRevenue={initialRevenue}
          initialReservations={initialReservations}
          initialDailyOps={initialDailyOps}
          initialAvailabilityGrid={initialAvailabilityGrid}
          initialCollections={initialCollections}
          initialReceivables={initialReceivables}
        />
      </div>
    </AppShell>
  )
}
