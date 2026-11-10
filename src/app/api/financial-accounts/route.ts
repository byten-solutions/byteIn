import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { FinancialAccountService } from "@/modules/financial-accounts/financial-accounts.service";
import {
  createFinancialAccountSchema,
  listAccountsQuerySchema,
} from "@/modules/financial-accounts/financial-accounts.validation";
import { handleApiError, BadRequestError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(undefined, req);
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = listAccountsQuerySchema.parse(searchParams);

    const propertyId = resolveScope(session, query.propertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    // Receptionists are strictly restricted to active accounts only
    const isActiveFilter =
      session.role === RoleName.RECEPTIONIST ? true : query.isActive;

    const accounts = await FinancialAccountService.getAccounts(propertyId, {
      isActive: isActiveFilter,
      accountType: query.accountType,
    });

    return NextResponse.json({ success: true, accounts });
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
    const validated = createFinancialAccountSchema.parse(body);

    const propertyId = resolveScope(
      session,
      validated.propertyId || req.nextUrl.searchParams.get("propertyId")
    );
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const account = await FinancialAccountService.createAccount(
      propertyId,
      validated,
      session.sub
    );

    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
