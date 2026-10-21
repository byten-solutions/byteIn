import { NextRequest, NextResponse } from "next/server"
import { RoleName } from "@prisma/client"
import { requireAuth, resolveScope } from "@/lib/auth-guard"
import { handleApiError } from "@/lib/errors"
import { ReportsService } from "@/modules/reports/reports.service"
import { dailyOpsCountsSchema } from "@/modules/reports/reports.validation"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST],
      req
    )

    const { searchParams } = new URL(req.url)
    const rawQuery = {
      date: searchParams.get("date") || undefined,
      propertyId: searchParams.get("propertyId") || undefined,
    }

    const query = dailyOpsCountsSchema.parse(rawQuery)
    const scope = resolveScope(session, query.propertyId, { allowSuperAdminGlobal: true })

    const data = await ReportsService.getDailyOperationsCounts(query.date, scope ?? undefined)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return handleApiError(error)
  }
}
