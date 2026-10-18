import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { ReportsService } from "@/modules/reports/reports.service";
import { handleApiError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN], req);

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const propertyId = searchParams.get("propertyId") || undefined;

    const effectivePropertyId =
      session.role === RoleName.SUPER_ADMIN
        ? propertyId
        : (session.propertyId || undefined);

    const report = await ReportsService.getDiscountsReport({
      startDate,
      endDate,
      propertyId: effectivePropertyId,
    });

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
