import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { FinancialAccountService } from "@/modules/financial-accounts/financial-accounts.service";
import {
  createAccountTransferSchema,
  listTransfersQuerySchema,
} from "@/modules/financial-accounts/financial-accounts.validation";
import { handleApiError, BadRequestError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = listTransfersQuerySchema.parse(searchParams);

    const propertyId = resolveScope(session, query.propertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const result = await FinancialAccountService.getTransfers(propertyId, query);

    return NextResponse.json({
      success: true,
      transfers: result.transfers,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
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
    const validated = createAccountTransferSchema.parse(body);

    const propertyId = resolveScope(
      session,
      validated.propertyId || req.nextUrl.searchParams.get("propertyId")
    );
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const transfer = await FinancialAccountService.createTransfer(
      propertyId,
      validated,
      session.sub
    );

    return NextResponse.json({ success: true, transfer }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
