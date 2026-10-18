import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireHotelContext } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { paginationQuerySchema } from "@/lib/pagination";
import { CustomerService } from "@/modules/customers/customer.service";
import { createCustomerSchema } from "@/modules/customers/customer.validation";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(undefined, req);
    const searchParams = req.nextUrl.searchParams;
    const requestedPropertyId = searchParams.get("propertyId") || undefined;
    const effectivePropertyId = requireHotelContext(session, requestedPropertyId, {
      allowSuperAdminGlobal: true,
    });
    const search = searchParams.get("search") || undefined;

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const { page, limit } = paginationQuerySchema.parse({
      page: pageParam ?? undefined,
      limit: limitParam ?? undefined,
    });

    const result = await CustomerService.getCustomers({
      search,
      page,
      limit,
      propertyId: effectivePropertyId || undefined,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error, "Failed to fetch customers");
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(undefined, req);
    const searchParams = req.nextUrl.searchParams;
    const requestedPropertyId = searchParams.get("propertyId") || undefined;
    const effectivePropertyId = requireHotelContext(session, requestedPropertyId, {
      allowSuperAdminGlobal: true,
    });
    const body = await req.json();
    const validated = createCustomerSchema.parse(body);
    const customer = await CustomerService.createCustomer(validated, effectivePropertyId || null);
    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to create customer");
  }
}
