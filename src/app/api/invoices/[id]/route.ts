import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";
import { handleApiError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST],
      req
    );
    const { id } = await params;
    const propertyId =
      resolveScope(session, null, { allowSuperAdminGlobal: true }) ?? undefined;

    const invoice = await BillingService.getInvoiceById(id, propertyId);
    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    return handleApiError(error, "Failed to fetch invoice");
  }
}
