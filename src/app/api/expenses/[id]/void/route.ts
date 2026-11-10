import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { ExpenseService } from "@/modules/expenses/expense.service";
import { voidExpenseSchema } from "@/modules/expenses/expenses.validation";
import { handleApiError, NotFoundError, BadRequestError } from "@/lib/errors";

export async function POST(
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
    const validated = voidExpenseSchema.parse(body);

    let propertyId = req.nextUrl.searchParams.get("propertyId");
    if (session.role === RoleName.SUPER_ADMIN && !propertyId) {
      const existing = await prisma.expense.findUnique({
        where: { id },
        select: { propertyId: true },
      });
      if (!existing) {
        throw new NotFoundError("Expense record not found");
      }
      propertyId = existing.propertyId;
    } else {
      propertyId = resolveScope(session, propertyId);
    }

    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const expense = await ExpenseService.voidExpense(
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
