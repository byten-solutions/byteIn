import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";
import { updateInvoiceItemSchema } from "@/modules/billing/billing.validation";
import { handleApiError } from "@/lib/errors";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST],
      req
    );
    const { id, itemId } = await params;

    const propertyId =
      session.role === RoleName.SUPER_ADMIN ? undefined : session.propertyId || undefined;

    // Verify invoice belongs to the caller's hotel
    await BillingService.getInvoiceById(id, propertyId);

    const body = await req.json();
    const validated = updateInvoiceItemSchema.parse(body);

    const updated = await BillingService.updateInvoiceItem(
      id,
      itemId,
      validated,
      session.sub
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Invoice item updated successfully.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST],
      req
    );
    const { id, itemId } = await params;

    const propertyId =
      session.role === RoleName.SUPER_ADMIN ? undefined : session.propertyId || undefined;

    // Verify invoice belongs to the caller's hotel
    await BillingService.getInvoiceById(id, propertyId);

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
    return handleApiError(error);
  }
}
