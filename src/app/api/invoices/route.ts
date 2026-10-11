import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { RoleName } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";
import {
  createInvoiceSchema,
  invoiceListQuerySchema,
} from "@/modules/billing/billing.validation";

export async function GET(req: NextRequest) {
  try {
    await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST]);
    const { searchParams } = new URL(req.url);

    const query = invoiceListQuerySchema.parse({
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      reservationId: searchParams.get("reservationId") || undefined,
      customerId: searchParams.get("customerId") || undefined,
    });

    const result = await BillingService.getInvoices(query);
    return NextResponse.json({ success: true, data: result });
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST]);
    const body = await req.json().catch(() => ({}));
    const validated = createInvoiceSchema.parse(body);

    const invoice = await BillingService.createInvoiceForReservation(
      validated,
      session.sub
    );

    return NextResponse.json(
      {
        success: true,
        data: invoice,
        message: `Invoice ${invoice.invoiceNumber} successfully created.`,
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
    const message = error instanceof Error ? error.message : "Failed to create invoice";
    let status = 400;
    if (message.includes("not found")) {
      status = 404;
    } else if (message.includes("already exists")) {
      status = 409;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
