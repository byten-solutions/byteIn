import { NextRequest, NextResponse } from "next/server"
import { RoleName } from "@prisma/client"
import { requireAuth } from "@/lib/auth-guard"
import { handleApiError } from "@/lib/errors"
import { ReportsService } from "@/modules/reports/reports.service"
import { collectionsReportSchema } from "@/modules/reports/reports.validation"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])
    const searchParams = req.nextUrl.searchParams

    const query = collectionsReportSchema.parse({
      date: searchParams.get("date") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      staffUserId: searchParams.get("staffUserId") || undefined,
      propertyId: searchParams.get("propertyId") || undefined,
    })

    const report = await ReportsService.getShiftCollections(
      query.date,
      query.startDate,
      query.endDate,
      query.staffUserId,
      query.propertyId
    )

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return handleApiError(error, "Failed to fetch shift collections report")
  }
}
