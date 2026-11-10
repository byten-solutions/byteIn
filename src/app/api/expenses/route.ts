import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { ExpenseService } from "@/modules/expenses/expense.service";
import {
  createExpenseSchema,
  expenseFilterSchema,
} from "@/modules/expenses/expenses.validation";
import { handleApiError, BadRequestError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = expenseFilterSchema.parse(searchParams);

    const propertyId = resolveScope(session, query.propertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const result = await ExpenseService.listExpenses(propertyId, query);

    if (query.summary) {
      const summary = await ExpenseService.getExpenseSummaryMetrics(
        propertyId,
        query
      );
      return NextResponse.json({ success: true, ...result, summary });
    }

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
    const validated = createExpenseSchema.parse(body);

    const propertyId = resolveScope(
      session,
      validated.propertyId || req.nextUrl.searchParams.get("propertyId")
    );
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const expense = await ExpenseService.createExpense(
      propertyId,
      validated,
      session.sub
    );

    return NextResponse.json({ success: true, expense }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
