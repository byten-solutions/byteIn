import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { ExpenseHeadService } from "@/modules/expenses/expense-head.service";
import {
  createExpenseHeadSchema,
  expenseHeadFilterSchema,
} from "@/modules/expenses/expenses.validation";
import { handleApiError, BadRequestError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = expenseHeadFilterSchema.parse(searchParams);

    const propertyId = resolveScope(session, query.propertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const expenseHeads = await ExpenseHeadService.listExpenseHeads(
      propertyId,
      query.includeInactive
    );

    return NextResponse.json({ success: true, expenseHeads });
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
      const targetPropertyId =
        typeof body.propertyId === "string"
          ? body.propertyId
          : req.nextUrl.searchParams.get("propertyId");
      const propertyId = resolveScope(session, targetPropertyId);
      if (!propertyId) {
        throw new BadRequestError("Property ID is required.");
      }
      const result = await ExpenseHeadService.seedDefaultExpenseHeads(
        propertyId,
        session.sub
      );
      return NextResponse.json(
        { success: true, seededCount: result.seededCount },
        { status: 201 }
      );
    }

    const validated = createExpenseHeadSchema.parse(body);

    const propertyId = resolveScope(
      session,
      validated.propertyId || req.nextUrl.searchParams.get("propertyId")
    );
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const expenseHead = await ExpenseHeadService.createExpenseHead(
      propertyId,
      validated,
      session.sub
    );

    return NextResponse.json({ success: true, expenseHead }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
