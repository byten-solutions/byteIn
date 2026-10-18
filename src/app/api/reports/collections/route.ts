import { NextRequest, NextResponse } from "next/server"
import { RoleName } from "@prisma/client"
import { requireAuth, resolveScope } from "@/lib/auth-guard"
import { handleApiError } from "@/lib/errors"
import { ReportsService } from "@/modules/reports/reports.service"
import { collectionsReportSchema } from "@/modules/reports/reports.validation"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST], req)
    const searchParams = req.nextUrl.searchParams

    const query = collectionsReportSchema.parse({
      date: searchParams.get("date") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      staffUserId: searchParams.get("staffUserId") || undefined,
      propertyId: searchParams.get("propertyId") || undefined,
    })

    const effectivePropertyId =
      resolveScope(session, query.propertyId, { allowSuperAdminGlobal: true }) ?? undefined

    const report = await ReportsService.getShiftCollections(
      query.date,
      query.startDate,
      query.endDate,
      query.staffUserId,
      effectivePropertyId
    )

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return handleApiError(error, "Failed to fetch shift collections report")
  }
}
