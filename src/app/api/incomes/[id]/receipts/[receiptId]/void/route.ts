import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { IncomeService } from "@/modules/income/income.service";
import { voidIncomeReceiptSchema } from "@/modules/income/income.validation";
import { handleApiError, NotFoundError, BadRequestError } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; receiptId: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const { id, receiptId } = await params;
    const body = await req.json();
    const validated = voidIncomeReceiptSchema.parse(body);

    const requestedPropertyId = req.nextUrl.searchParams.get("propertyId");
    const propertyId = resolveScope(session, requestedPropertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const existing = await prisma.income.findUnique({
      where: { id },
      select: { propertyId: true },
    });
    if (!existing) {
      throw new NotFoundError("Income record not found");
    }
    if (existing.propertyId !== propertyId) {
      if (session.role === RoleName.SUPER_ADMIN) {
        throw new BadRequestError(
          "The specified income does not belong to the selected property."
        );
      }
      throw new NotFoundError("Income record not found");
    }

    const income = await IncomeService.voidIncomeReceipt(
      propertyId,
      id,
      receiptId,
      validated,
      session.sub
    );

    return NextResponse.json({ success: true, income });
  } catch (error) {
    return handleApiError(error);
  }
}
