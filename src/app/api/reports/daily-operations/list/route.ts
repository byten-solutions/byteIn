import { NextRequest, NextResponse } from "next/server"
import { RoleName } from "@prisma/client"
import { requireAuth, resolveScope } from "@/lib/auth-guard"
import { handleApiError } from "@/lib/errors"
import { ReportsService } from "@/modules/reports/reports.service"
import { dailyOpsListSchema } from "@/modules/reports/reports.validation"
import { withReportTiming } from "@/lib/server-timing"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  return withReportTiming("/api/reports/daily-operations/list", req, async () => {
    try {
      const session = await requireAuth(
        [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST],
        req
      )

      const { searchParams } = new URL(req.url)
      const rawQuery = {
        type: searchParams.get("type") || undefined,
        date: searchParams.get("date") || undefined,
        propertyId: searchParams.get("propertyId") || undefined,
        q: searchParams.get("q") || undefined,
        page: searchParams.get("page") || undefined,
        limit: searchParams.get("limit") || undefined,
        sort: searchParams.get("sort") || undefined,
        dir: searchParams.get("dir") || undefined,
      }

      const query = dailyOpsListSchema.parse(rawQuery)
      const scope = resolveScope(session, query.propertyId, { allowSuperAdminGlobal: true })

      const data = await ReportsService.getDailyOperationsList({
        type: query.type,
        date: query.date,
        propertyId: scope ?? undefined,
        q: query.q,
        page: query.page,
        limit: query.limit,
        sort: query.sort,
        dir: query.dir,
      })
      return NextResponse.json({ success: true, data })
    } catch (error) {
      return handleApiError(error)
    }
  })
}
