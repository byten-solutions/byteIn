import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, requireAuth } from "@/lib/auth-guard";
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch customer";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to update customer";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
