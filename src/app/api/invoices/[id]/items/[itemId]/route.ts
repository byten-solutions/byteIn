import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST]);
    const { id, itemId } = await params;

    const updated = await BillingService.removeInvoiceItem(
      id,
      itemId,
      session.sub
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Invoice item removed successfully.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to remove invoice item";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
