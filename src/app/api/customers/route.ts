import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { CustomerService } from "@/modules/customers/customer.service";
import { createCustomerSchema } from "@/modules/customers/customer.validation";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await CustomerService.getCustomers({ search, page, limit });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/customers error:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const validated = createCustomerSchema.parse(body);
    const customer = await CustomerService.createCustomer(validated);
    return NextResponse.json({ success: true, customer }, { status: 201 });
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
    const message = error instanceof Error ? error.message : "Failed to create customer";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
