import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { ExpenseHeadService } from "@/modules/expenses/expense-head.service";
import { updateExpenseHeadSchema } from "@/modules/expenses/expenses.validation";
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

    let propertyId = req.nextUrl.searchParams.get("propertyId");
    if (session.role === RoleName.SUPER_ADMIN && !propertyId) {
      const existing = await prisma.expenseHead.findUnique({
        where: { id },
        select: { propertyId: true },
      });
      if (!existing) {
        throw new NotFoundError("Expense category not found");
      }
      propertyId = existing.propertyId;
    } else {
      propertyId = resolveScope(session, propertyId);
    }

    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const expenseHead = await ExpenseHeadService.getExpenseHeadById(propertyId, id);

    return NextResponse.json({ success: true, expenseHead });
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
    const validated = updateExpenseHeadSchema.parse(body);

    let propertyId = req.nextUrl.searchParams.get("propertyId");
    if (session.role === RoleName.SUPER_ADMIN && !propertyId) {
      const existing = await prisma.expenseHead.findUnique({
        where: { id },
        select: { propertyId: true },
      });
      if (!existing) {
        throw new NotFoundError("Expense category not found");
      }
      propertyId = existing.propertyId;
    } else {
      propertyId = resolveScope(session, propertyId);
    }

    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const expenseHead = await ExpenseHeadService.updateExpenseHead(
      propertyId,
      id,
      validated,
      session.sub
    );

    return NextResponse.json({ success: true, expenseHead });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const { id } = await params;

    let propertyId = req.nextUrl.searchParams.get("propertyId");
    if (session.role === RoleName.SUPER_ADMIN && !propertyId) {
      const existing = await prisma.expenseHead.findUnique({
        where: { id },
        select: { propertyId: true },
      });
      if (!existing) {
        throw new NotFoundError("Expense category not found");
      }
      propertyId = existing.propertyId;
    } else {
      propertyId = resolveScope(session, propertyId);
    }

    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const result = await ExpenseHeadService.deleteOrDeactivateExpenseHead(
      propertyId,
      id,
      session.sub
    );

    return NextResponse.json({
      success: true,
      message: result.message,
      deactivated: result.deactivated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
