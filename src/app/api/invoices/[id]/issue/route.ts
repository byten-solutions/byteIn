import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";
import { handleApiError } from "@/lib/errors";

export async function POST(
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
      session.role === RoleName.SUPER_ADMIN ? undefined : session.propertyId || undefined;

    // Verify invoice belongs to the caller's hotel before issuing
    await BillingService.getInvoiceById(id, propertyId);

    const updated = await BillingService.issueInvoice(id, session.sub);
    return NextResponse.json({
      success: true,
      data: updated,
      message: `Invoice ${updated.invoiceNumber} has been issued.`,
    });
  } catch (error) {
    return handleApiError(error, "Failed to issue invoice");
  }
}
