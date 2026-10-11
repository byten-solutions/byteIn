import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST]);
    const { id } = await params;

    const updated = await BillingService.issueInvoice(id, session.sub);
    return NextResponse.json({
      success: true,
      data: updated,
      message: `Invoice ${updated.invoiceNumber} has been issued.`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to issue invoice";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
