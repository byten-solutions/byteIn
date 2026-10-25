import { NextRequest, NextResponse } from "next/server"
import { RoleName } from "@prisma/client"
import { requireAuth, resolveScope } from "@/lib/auth-guard"
import { handleApiError } from "@/lib/errors"
import { ReportsService } from "@/modules/reports/reports.service"
import { singleDateReportSchema } from "@/modules/reports/reports.validation"
import { withReportTiming } from "@/lib/server-timing"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  return withReportTiming("/api/reports/daily-operations", req, async () => {
    try {
      const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST], req)
      const searchParams = req.nextUrl.searchParams

      const query = singleDateReportSchema.parse({
        date: searchParams.get("date") || undefined,
        propertyId: searchParams.get("propertyId") || undefined,
      })

      const effectivePropertyId =
        resolveScope(session, query.propertyId, { allowSuperAdminGlobal: true }) ?? undefined

      const report = await ReportsService.getDailyOperations(query.date, effectivePropertyId)

      return NextResponse.json({ success: true, data: report })
    } catch (error) {
      return handleApiError(error, "Failed to fetch daily operations report")
    }
  })
}
