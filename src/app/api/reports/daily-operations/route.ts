import { NextRequest, NextResponse } from "next/server"
import { RoleName } from "@prisma/client"
import { requireAuth } from "@/lib/auth-guard"
import { handleApiError } from "@/lib/errors"
import { ReportsService } from "@/modules/reports/reports.service"
import { singleDateReportSchema } from "@/modules/reports/reports.validation"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])
    const searchParams = req.nextUrl.searchParams

    const query = singleDateReportSchema.parse({
      date: searchParams.get("date") || undefined,
      propertyId: searchParams.get("propertyId") || undefined,
    })

    const report = await ReportsService.getDailyOperations(query.date, query.propertyId)

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return handleApiError(error, "Failed to fetch daily operations report")
  }
}
