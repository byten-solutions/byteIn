import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";
import { addInvoiceItemSchema } from "@/modules/billing/billing.validation";
import { handleApiError } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST], req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const validated = addInvoiceItemSchema.parse(body);
    const updated = await BillingService.addInvoiceItem(
      id,
      validated,
      session.sub
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Invoice item added successfully.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
