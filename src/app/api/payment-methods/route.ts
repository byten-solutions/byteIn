import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { PaymentMethodService } from "@/modules/payment-methods/payment-methods.service";
import {
  createPaymentMethodSchema,
  listPaymentMethodsQuerySchema,
} from "@/modules/payment-methods/payment-methods.validation";
import { handleApiError, BadRequestError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(undefined, req);
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = listPaymentMethodsQuerySchema.parse(searchParams);

    const propertyId = resolveScope(session, query.propertyId);
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    // Receptionists are strictly restricted to active payment methods only
    const isActiveFilter =
      session.role === RoleName.RECEPTIONIST ? true : query.isActive;

    const paymentMethods = await PaymentMethodService.getPaymentMethods(
      propertyId,
      { isActive: isActiveFilter }
    );

    return NextResponse.json({ success: true, paymentMethods });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const body = await req.json();
    const validated = createPaymentMethodSchema.parse(body);

    const propertyId = resolveScope(
      session,
      validated.propertyId || req.nextUrl.searchParams.get("propertyId")
    );
    if (!propertyId) {
      throw new BadRequestError("Property ID is required.");
    }

    const paymentMethod = await PaymentMethodService.createPaymentMethod(
      propertyId,
      validated,
      session.sub
    );

    return NextResponse.json(
      { success: true, paymentMethod },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
