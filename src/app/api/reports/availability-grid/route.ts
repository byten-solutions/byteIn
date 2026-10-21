import { NextRequest, NextResponse } from "next/server"
import { RoleName } from "@prisma/client"
import { requireAuth, resolveScope } from "@/lib/auth-guard"
import { handleApiError } from "@/lib/errors"
import { ReportsService } from "@/modules/reports/reports.service"
import { availabilityGridSchema } from "@/modules/reports/reports.validation"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST], req)
    const searchParams = req.nextUrl.searchParams

    const query = availabilityGridSchema.parse({
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      propertyId: searchParams.get("propertyId") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      buildingId: searchParams.get("buildingId") || undefined,
      floorId: searchParams.get("floorId") || undefined,
      q: searchParams.get("q") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    })

    const effectivePropertyId =
      resolveScope(session, query.propertyId, { allowSuperAdminGlobal: true }) ?? undefined

    const report = await ReportsService.getAvailabilityGrid(
      query.startDate,
      query.endDate,
      effectivePropertyId,
      query.buildingId,
      {
        categoryId: query.categoryId,
        floorId: query.floorId,
        q: query.q,
        page: query.page,
        limit: query.limit,
      }
    )

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return handleApiError(error, "Failed to fetch availability grid")
  }
}
