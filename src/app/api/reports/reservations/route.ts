import { NextRequest, NextResponse } from "next/server"
import { RoleName } from "@prisma/client"
import { requireAuth, resolveScope } from "@/lib/auth-guard"
import { handleApiError } from "@/lib/errors"
import { ReportsService } from "@/modules/reports/reports.service"
import { reportDateRangeSchema } from "@/modules/reports/reports.validation"

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST], req)
    const searchParams = req.nextUrl.searchParams

    const query = reportDateRangeSchema.parse({
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      propertyId: searchParams.get("propertyId") || undefined,
    })

    const effectivePropertyId =
      resolveScope(session, query.propertyId, { allowSuperAdminGlobal: true }) ?? undefined

    const report = await ReportsService.getReservationStatusReport({
      ...query,
      propertyId: effectivePropertyId,
    })

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return handleApiError(error, "Failed to fetch reservation status report")
  }
}
