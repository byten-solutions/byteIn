import { NextRequest, NextResponse } from "next/server"
import { RoleName } from "@prisma/client"
import { requireAuth } from "@/lib/auth-guard"
import { handleApiError } from "@/lib/errors"
import { ReportsService } from "@/modules/reports/reports.service"
import { receivablesReportSchema } from "@/modules/reports/reports.validation"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])
    const searchParams = req.nextUrl.searchParams

    const query = receivablesReportSchema.parse({
      propertyId: searchParams.get("propertyId") || undefined,
      filter: (searchParams.get("filter") as "all" | "in_house" | "departed") || undefined,
    })

    const report = await ReportsService.getReceivablesReport(query.propertyId, query.filter)

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return handleApiError(error, "Failed to fetch receivables report")
  }
}
