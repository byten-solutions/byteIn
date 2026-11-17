import { notFound, redirect } from "next/navigation"
import { RoleName } from "@prisma/client"
import { getSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AppShell } from "@/components/app-shell"
import { getHotelTodayDate, getHotelTodayDateUtc } from "@/lib/date"
import { ReportDetailClient } from "./report-detail-client"
import {
  RECEPTIONIST_ALLOWED_REPORTS,
  resolveCanonicalReportType,
  isValidReportSlug,
} from "./report-configs"

export const dynamic = "force-dynamic"

export default async function ReportDetailPage(props: {
  params: Promise<{ type: string }>
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
    from?: string
    to?: string
    date?: string
    propertyId?: string
    accountId?: string
  }>
}) {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  const { type } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}

  // Canonical slug mapping (support aliases)
  const canonicalType = resolveCanonicalReportType(type)

  if (!isValidReportSlug(type)) {
    notFound()
  }

  // RBAC Checks: Front desk is strictly isolated from managerial and financial reports
  if (session.role === RoleName.RECEPTIONIST && !RECEPTIONIST_ALLOWED_REPORTS.has(canonicalType)) {
    redirect("/reports/daily-operations")
  }

  // Property Summary is strictly for SUPER_ADMIN
  if (canonicalType === "property-summary" && session.role !== RoleName.SUPER_ADMIN) {
    redirect("/reports/occupancy")
  }

  const todayStr = getHotelTodayDate()
  const [y, m] = todayStr.split("-")
  const defaultEndDate = todayStr

  // Default to rolling 12 months for Guest Analytics historical retention, and month-to-date for other operational reports
  const twelveMonthsAgo = new Date(Date.UTC(parseInt(y, 10) - 1, parseInt(m, 10) - 1, 1))
  const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().split("T")[0]!
  const defaultStartDate = canonicalType === "guests" ? twelveMonthsAgoStr : `${y}-${m}-01`

  const todayUtc = getHotelTodayDateUtc()
  const weekLater = new Date(todayUtc.getTime() + 6 * 24 * 60 * 60 * 1000)
  const weekLaterStr = weekLater.toISOString().split("T")[0]!

  let properties: Array<{ id: string; name: string; city: string | null; status: string }> = []
  if (session.role === RoleName.SUPER_ADMIN) {
    properties = await prisma.property.findMany({
      select: { id: true, name: true, city: true, status: true },
      orderBy: { name: "asc" },
    })
  }

  // Strictly enforce property scope: ADMIN is locked to session property
  const activePropertyId =
    session.role === RoleName.ADMIN
      ? session.propertyId || ""
      : searchParams.propertyId ||
        session.propertyId ||
        (properties.length > 0 ? properties[0].id : undefined)

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ReportDetailClient
          type={canonicalType}
          properties={properties}
          initialPropertyId={activePropertyId}
          isSuperAdmin={session.role === RoleName.SUPER_ADMIN}
          userRole={session.role}
          initialStartDate={searchParams.startDate || searchParams.from || defaultStartDate}
          initialEndDate={searchParams.endDate || searchParams.to || defaultEndDate}
          initialSingleDate={searchParams.date || defaultEndDate}
          initialWeekLaterDate={weekLaterStr}
          initialAccountId={searchParams.accountId}
        />
      </div>
    </AppShell>
  )
}
