import { NextRequest, NextResponse } from "next/server"
import { RoleName } from "@prisma/client"
import { requireAuth, resolveScope } from "@/lib/auth-guard"
import { handleApiError } from "@/lib/errors"
import { ReportsService } from "@/modules/reports/reports.service"
import { receivablesReportSchema } from "@/modules/reports/reports.validation"
import { withReportTiming } from "@/lib/server-timing"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  return withReportTiming("/api/reports/receivables", req, async () => {
    try {
      const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST], req)
      const searchParams = req.nextUrl.searchParams

      const query = receivablesReportSchema.parse({
        propertyId: searchParams.get("propertyId") || undefined,
        filter: (searchParams.get("filter") as "all" | "in_house" | "future" | "departed") || undefined,
        page: searchParams.get("page") || undefined,
        limit: searchParams.get("limit") || undefined,
      })

      const effectivePropertyId =
        resolveScope(session, query.propertyId, { allowSuperAdminGlobal: true }) ?? undefined

      const report = await ReportsService.getReceivablesReport(effectivePropertyId, query.filter, {
        page: query.page,
        limit: query.limit,
      })

      return NextResponse.json({ success: true, data: report })
    } catch (error) {
      return handleApiError(error, "Failed to fetch receivables report")
    }
  })
}
