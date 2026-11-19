import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { ExpenseService } from "@/modules/expenses/expense.service";
import { updateExpenseSchema } from "@/modules/expenses/expenses.validation";
import { handleApiError, NotFoundError, BadRequestError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const { id } = await params;

    const requestedPropertyId = req.nextUrl.searchParams.get("propertyId");
    const propertyId = resolveScope(session, requestedPropertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const existing = await prisma.expense.findUnique({
      where: { id },
      select: { propertyId: true },
    });
    if (!existing) {
      throw new NotFoundError("Expense record not found");
    }
    if (existing.propertyId !== propertyId) {
      throw new BadRequestError("The specified expense does not belong to the selected property.");
    }

    const expense = await ExpenseService.getExpenseById(propertyId, id);

    return NextResponse.json({ success: true, expense });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const { id } = await params;
    const body = await req.json();
    const validated = updateExpenseSchema.parse(body);

    const requestedPropertyId =
      req.nextUrl.searchParams.get("propertyId") || validated.propertyId;
    const propertyId = resolveScope(session, requestedPropertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const existing = await prisma.expense.findUnique({
      where: { id },
      select: { propertyId: true },
    });
    if (!existing) {
      throw new NotFoundError("Expense record not found");
    }
    if (existing.propertyId !== propertyId) {
      throw new BadRequestError("The specified expense does not belong to the selected property.");
    }

    const expense = await ExpenseService.updateExpense(
      propertyId,
      id,
      validated,
      session.sub
    );

    return NextResponse.json({ success: true, expense });
  } catch (error) {
    return handleApiError(error);
  }
}
