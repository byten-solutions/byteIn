import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { RoleName } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";
import { recordPaymentSchema } from "@/modules/billing/billing.validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const validated = recordPaymentSchema.parse(body);
    const result = await BillingService.recordPayment(
      id,
      validated,
      session.sub
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to record payment";
    let status = 400;
    if (message.includes("not found")) {
      status = 404;
    } else if (message.includes("exceeds remaining balance")) {
      status = 422;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
