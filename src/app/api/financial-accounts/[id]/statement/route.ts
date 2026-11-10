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

    let propertyId = req.nextUrl.searchParams.get("propertyId");
    if (session.role === RoleName.SUPER_ADMIN && !propertyId) {
      const existing = await prisma.financialAccount.findUnique({
        where: { id },
        select: { propertyId: true },
      });
      if (!existing) {
        throw new NotFoundError(`Financial account with ID '${id}' not found.`);
      }
      propertyId = existing.propertyId;
    } else {
      propertyId = resolveScope(session, propertyId);
    }

    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
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
