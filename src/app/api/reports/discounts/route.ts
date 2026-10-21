import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { ReportsService } from "@/modules/reports/reports.service";
import { handleApiError } from "@/lib/errors";
import { discountsReportSchema } from "@/modules/reports/reports.validation";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN], req);

    const { searchParams } = new URL(req.url);
    const query = discountsReportSchema.parse({
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      propertyId: searchParams.get("propertyId") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const effectivePropertyId =
      resolveScope(session, query.propertyId, { allowSuperAdminGlobal: true }) ?? undefined;

    const report = await ReportsService.getDiscountsReport(
      {
        startDate: query.startDate,
        endDate: query.endDate,
        propertyId: effectivePropertyId,
      },
      {
        page: query.page,
        limit: query.limit,
      }
    );

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
