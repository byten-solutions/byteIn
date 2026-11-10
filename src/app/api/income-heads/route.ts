import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { IncomeHeadService } from "@/modules/income/income-head.service";
import {
  createIncomeHeadSchema,
  incomeHeadFilterSchema,
} from "@/modules/income/income.validation";
import { handleApiError, BadRequestError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = incomeHeadFilterSchema.parse(searchParams);

    const propertyId = resolveScope(session, query.propertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const incomeHeads = await IncomeHeadService.getIncomeHeads(propertyId, {
      isActive: query.isActive,
    });

    return NextResponse.json({ success: true, incomeHeads });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const body = await req.json();

    // Check if seeding action requested
    if (body && typeof body === "object" && "action" in body && body.action === "seed") {
      const targetPropertyId = typeof body.propertyId === "string" ? body.propertyId : req.nextUrl.searchParams.get("propertyId");
      const propertyId = resolveScope(session, targetPropertyId);
      if (!propertyId) {
        throw new BadRequestError("Property ID is required.");
      }
      const result = await IncomeHeadService.seedDefaultIncomeHeads(propertyId, session.sub);
      return NextResponse.json(
        { success: true, seededCount: result.seededCount },
        { status: 201 }
      );
    }

    const validated = createIncomeHeadSchema.parse(body);

    const propertyId = resolveScope(
      session,
      validated.propertyId || req.nextUrl.searchParams.get("propertyId")
    );
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const incomeHead = await IncomeHeadService.createIncomeHead(
      propertyId,
      validated,
      session.sub
    );

    return NextResponse.json({ success: true, incomeHead }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
