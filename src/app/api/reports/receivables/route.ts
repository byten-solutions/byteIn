import { NextRequest, NextResponse } from "next/server"
import { RoleName } from "@prisma/client"
import { requireAuth, resolveReportScope } from "@/lib/auth-guard"
import { handleApiError } from "@/lib/errors"
import { ReportsService } from "@/modules/reports/reports.service"
import { receivablesReportSchema } from "@/modules/reports/reports.validation"
import { withReportTiming } from "@/lib/server-timing"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  return withReportTiming("/api/reports/receivables", req, async () => {
    try {
      const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN], req)
      const searchParams = req.nextUrl.searchParams

      const query = receivablesReportSchema.parse({
        asOfDate: searchParams.get("asOfDate") || undefined,
        propertyId: searchParams.get("propertyId") || undefined,
        filter: (searchParams.get("filter") as "all" | "in_house" | "future" | "departed") || undefined,
        page: searchParams.get("page") || undefined,
        limit: searchParams.get("limit") || undefined,
      })

      const effectivePropertyId = await resolveReportScope(session, query.propertyId)

      const report = await ReportsService.getReceivablesReport(effectivePropertyId, query.filter, {
        page: query.page,
        limit: query.limit,
        asOfDate: query.asOfDate,
      })

      return NextResponse.json({ success: true, data: report })
    } catch (error) {
      return handleApiError(error, "Failed to fetch receivables report")
    }
  })
}
