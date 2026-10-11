import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { RoleName } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";
import { addInvoiceItemSchema } from "@/modules/billing/billing.validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST]);
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to add invoice item";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
