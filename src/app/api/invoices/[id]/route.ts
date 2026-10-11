import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST]);
    const { id } = await params;

    const invoice = await BillingService.getInvoiceById(id);
    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch invoice";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
