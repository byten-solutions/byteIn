import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { FinancialAccountService } from "@/modules/financial-accounts/financial-accounts.service";
import { accountStatementQuerySchema } from "@/modules/financial-accounts/financial-accounts.validation";
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
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = accountStatementQuerySchema.parse(searchParams);

    const requestedPropertyId = req.nextUrl.searchParams.get("propertyId");
    const propertyId = resolveScope(session, requestedPropertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const existing = await prisma.financialAccount.findUnique({
      where: { id },
      select: { propertyId: true },
    });
    if (!existing) {
      throw new NotFoundError(`Financial account with ID '${id}' not found.`);
    }
    if (existing.propertyId !== propertyId) {
      if (session.role === RoleName.SUPER_ADMIN) {
        throw new BadRequestError(
          "The specified financial account does not belong to the selected property."
        );
      }
      throw new NotFoundError(`Financial account with ID '${id}' not found.`);
    }

    const statement = await FinancialAccountService.getAccountStatement(
      propertyId,
      id,
      query
    );

    return NextResponse.json({ success: true, statement });
  } catch (error) {
    return handleApiError(error);
  }
}
