import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";
import { recordPaymentSchema } from "@/modules/billing/billing.validation";
import { handleApiError } from "@/lib/errors";
import { REQUIRE_PAYMENT_IDEMPOTENCY_KEY } from "@/config/billing";

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
    const body = await req.json().catch(() => ({}));

    const idempotencyHeader = req.headers.get("idempotency-key");
    const idempotencyKey = idempotencyHeader || body.idempotencyKey || undefined;

    if (REQUIRE_PAYMENT_IDEMPOTENCY_KEY && !idempotencyKey) {
      return NextResponse.json(
        { error: "Idempotency-Key header is required for payment submission." },
        { status: 400 }
      );
    }

    const validated = recordPaymentSchema.parse({
      ...body,
      idempotencyKey: idempotencyKey || null,
    });

    const propertyId =
      resolveScope(session, null, { allowSuperAdminGlobal: true }) ?? undefined;

    const result = await BillingService.recordPayment(
      id,
      validated,
      session.sub,
      propertyId
    );

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: `Payment of $${result.receipt.amountPaid} recorded successfully.`,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Failed to record payment");
  }
}
