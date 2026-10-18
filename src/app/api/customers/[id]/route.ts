import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireHotelContext } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { CustomerService } from "@/modules/customers/customer.service";
import { updateCustomerSchema } from "@/modules/customers/customer.validation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(undefined, req);
    const effectivePropertyId = requireHotelContext(session, undefined, {
      allowSuperAdminGlobal: true,
    });
    const { id } = await params;
    const customer = await CustomerService.getCustomerById(
      id,
      effectivePropertyId || undefined
    );
    return NextResponse.json({ success: true, customer });
  } catch (error) {
    return handleApiError(error, "Failed to fetch customer");
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(undefined, req);
    const effectivePropertyId = requireHotelContext(session, undefined, {
      allowSuperAdminGlobal: true,
    });
    const { id } = await params;
    const body = await req.json();
    const validated = updateCustomerSchema.parse(body);
    const customer = await CustomerService.updateCustomer(
      id,
      validated,
      effectivePropertyId || undefined
    );
    return NextResponse.json({ success: true, customer });
  } catch (error) {
    return handleApiError(error, "Failed to update customer");
  }
}
