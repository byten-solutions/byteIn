import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";
import { handleApiError } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const session = await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST], req);
    const { id: invoiceId, paymentId } = await params;

    const updated = await BillingService.voidPayment(invoiceId, paymentId, session.sub);
    return NextResponse.json({
      success: true,
      data: updated,
      message: "Payment successfully voided.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
