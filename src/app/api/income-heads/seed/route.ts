import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { IncomeHeadService } from "@/modules/income/income-head.service";
import { handleApiError, BadRequestError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );

    let requestedPropertyId: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.propertyId === "string") {
        requestedPropertyId = body.propertyId;
      }
    } catch {
      // Body may be empty, fall back to query param
      requestedPropertyId = req.nextUrl.searchParams.get("propertyId") || undefined;
    }

    if (!requestedPropertyId) {
      requestedPropertyId = req.nextUrl.searchParams.get("propertyId") || undefined;
    }

    const propertyId = resolveScope(session, requestedPropertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const result = await IncomeHeadService.seedDefaultIncomeHeads(
      propertyId,
      session.sub
    );

    return NextResponse.json(
      { success: true, seededCount: result.seededCount },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
