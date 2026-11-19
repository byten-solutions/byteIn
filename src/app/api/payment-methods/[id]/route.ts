import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PaymentMethodService } from "@/modules/payment-methods/payment-methods.service";
import { updatePaymentMethodSchema } from "@/modules/payment-methods/payment-methods.validation";
import { handleApiError, NotFoundError, BadRequestError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const { id } = await params;

    let propertyId = req.nextUrl.searchParams.get("propertyId");
    if (session.role === RoleName.SUPER_ADMIN && !propertyId) {
      const existing = await prisma.paymentMethod.findUnique({
        where: { id },
        select: { propertyId: true },
      });
      if (!existing) {
        throw new NotFoundError(`Payment method with ID '${id}' not found.`);
      }
      propertyId = existing.propertyId;
    } else {
      propertyId = resolveScope(session, propertyId);
    }

    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const paymentMethod = await PaymentMethodService.getPaymentMethodById(
      propertyId,
      id
    );

    return NextResponse.json({ success: true, paymentMethod });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const { id } = await params;
    const body = await req.json();
    const validated = updatePaymentMethodSchema.parse(body);

    let propertyId = req.nextUrl.searchParams.get("propertyId");
    if (session.role === RoleName.SUPER_ADMIN && !propertyId) {
      const existing = await prisma.paymentMethod.findUnique({
        where: { id },
        select: { propertyId: true },
      });
      if (!existing) {
        throw new NotFoundError(`Payment method with ID '${id}' not found.`);
      }
      propertyId = existing.propertyId;
    } else {
      propertyId = resolveScope(session, propertyId);
    }

    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const paymentMethod = await PaymentMethodService.updatePaymentMethod(
      propertyId,
      id,
      validated,
      session.sub
    );

    return NextResponse.json({ success: true, paymentMethod });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const { id } = await params;

    let propertyId = req.nextUrl.searchParams.get("propertyId");
    if (session.role === RoleName.SUPER_ADMIN && !propertyId) {
      const existing = await prisma.paymentMethod.findUnique({
        where: { id },
        select: { propertyId: true },
      });
      if (!existing) {
        throw new NotFoundError(`Payment method with ID '${id}' not found.`);
      }
      propertyId = existing.propertyId;
    } else {
      propertyId = resolveScope(session, propertyId);
    }

    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    await PaymentMethodService.deletePaymentMethod(propertyId, id, session.sub);

    return NextResponse.json({
      success: true,
      message: "Payment method deleted successfully.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
