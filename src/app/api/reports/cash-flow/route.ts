import { NextRequest, NextResponse } from "next/server"
import { RoleName } from "@prisma/client"
import { requireAuth, resolveReportScope } from "@/lib/auth-guard"
import { handleApiError } from "@/lib/errors"
import { ReportsService } from "@/modules/reports/reports.service"
import { reportDateRangeSchema } from "@/modules/reports/reports.validation"
import { withReportTiming } from "@/lib/server-timing"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  return withReportTiming("/api/reports/cash-flow", req, async () => {
    try {
      const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN], req)
      const searchParams = req.nextUrl.searchParams

      const query = reportDateRangeSchema.parse({
        startDate: searchParams.get("startDate") || searchParams.get("from") || undefined,
        endDate: searchParams.get("endDate") || searchParams.get("to") || undefined,
        propertyId: searchParams.get("propertyId") || undefined,
      })

      const effectivePropertyId = await resolveReportScope(session, query.propertyId)

      const report = await ReportsService.getCashFlowReport({
        ...query,
        propertyId: effectivePropertyId,
      })

      return NextResponse.json({ success: true, data: report })
    } catch (error) {
      return handleApiError(error, "Failed to fetch cash flow and financial performance report")
    }
  })
}
