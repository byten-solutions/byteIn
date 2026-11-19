import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { IncomeService } from "@/modules/income/income.service";
import {
  createIncomeSchema,
  incomeFilterSchema,
} from "@/modules/income/income.validation";
import { handleApiError, BadRequestError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = incomeFilterSchema.parse(searchParams);

    const propertyId = resolveScope(session, query.propertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const result = await IncomeService.getIncomes(propertyId, query);

    return NextResponse.json({ success: true, ...result });
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
    const validated = createIncomeSchema.parse(body);

    const propertyId = resolveScope(
      session,
      validated.propertyId || req.nextUrl.searchParams.get("propertyId")
    );
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const income = await IncomeService.createIncome(
      propertyId,
      validated,
      session.sub
    );

    return NextResponse.json({ success: true, income }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
