import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth-guard"
import { ReportsService } from "@/modules/reports/reports.service"
import { AppShell } from "@/components/app-shell"
import { ReportsView } from "./reports-view"

export default async function ReportsPage() {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, "0")
  const d = String(now.getUTCDate()).padStart(2, "0")

  // Default: from 1st of current month to today
  const defaultStartDate = `${y}-${m}-01`
  const defaultEndDate = `${y}-${m}-${d}`

  const [initialOccupancy, initialRevenue, initialReservations] = await Promise.all([
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
  ])

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <ReportsView
          initialStartDate={defaultStartDate}
          initialEndDate={defaultEndDate}
          initialOccupancy={initialOccupancy}
          initialRevenue={initialRevenue}
          initialReservations={initialReservations}
        />
      </div>
    </AppShell>
  )
}
