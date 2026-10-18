import { NextRequest, NextResponse } from "next/server"
import { RoleName } from "@prisma/client"
import { requireAuth } from "@/lib/auth-guard"
import { handleApiError } from "@/lib/errors"
import { ReportsService } from "@/modules/reports/reports.service"
import { availabilityGridSchema } from "@/modules/reports/reports.validation"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST])
    const searchParams = req.nextUrl.searchParams

    const query = availabilityGridSchema.parse({
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      propertyId: searchParams.get("propertyId") || undefined,
      buildingId: searchParams.get("buildingId") || undefined,
    })

    const report = await ReportsService.getAvailabilityGrid(
      query.startDate,
      query.endDate,
      query.propertyId,
      query.buildingId
    )

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return handleApiError(error, "Failed to fetch availability grid")
  }
}
