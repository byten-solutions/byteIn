import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { CustomerService } from "@/modules/customers/customer.service";
import { updateCustomerSchema } from "@/modules/customers/customer.validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const customer = await CustomerService.getCustomerById(id);
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
    await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const validated = updateCustomerSchema.parse(body);
    const customer = await CustomerService.updateCustomer(id, validated);
    return NextResponse.json({ success: true, customer });
  } catch (error) {
    return handleApiError(error, "Failed to update customer");
  }
}
