import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, requireHotelContext } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { BillingService } from "@/modules/billing/billing.service";
import {
  createInvoiceSchema,
  invoiceListQuerySchema,
} from "@/modules/billing/billing.validation";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST],
      req
    );
    const { searchParams } = new URL(req.url);

    const requestedPropertyId = searchParams.get("propertyId") || undefined;
    const effectivePropertyId = requireHotelContext(session, requestedPropertyId, {
      allowSuperAdminGlobal: true,
    });

    const query = invoiceListQuerySchema.parse({
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      reservationId: searchParams.get("reservationId") || undefined,
      customerId: searchParams.get("customerId") || undefined,
      propertyId: effectivePropertyId || undefined,
    });

    const result = await BillingService.getInvoices(query);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error, "Failed to fetch invoices");
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST],
      req
    );
    const body = await req.json().catch(() => ({}));
    const validated = createInvoiceSchema.parse(body);

    const propertyId =
      session.role === RoleName.SUPER_ADMIN ? undefined : session.propertyId || undefined;

    try {
      const invoice = await BillingService.createInvoiceForReservation(
        validated,
        session.sub,
        propertyId
      );

      return NextResponse.json(
        {
          success: true,
          data: invoice,
          message: `Invoice ${invoice.invoiceNumber} successfully created.`,
        },
        { status: 201 }
      );
    } catch (innerError: unknown) {
      const msg = innerError instanceof Error ? innerError.message : String(innerError);
      if (msg.includes("already exists for this reservation")) {
        const existing = await BillingService.getInvoiceByReservationId(validated.reservationId);
        if (existing) {
          return NextResponse.json(
            {
              success: true,
              data: existing,
              message: `Active invoice ${existing.invoiceNumber} retrieved.`,
            },
            { status: 200 }
          );
        }
      }
      throw innerError;
    }
  } catch (error) {
    return handleApiError(error, "Failed to create invoice");
  }
}
