import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { PropertyService } from "@/modules/properties/property.service";
import { createPropertySchema } from "@/modules/properties/property.validation";
import { handleApiError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(undefined, req);

    if (session.role === RoleName.SUPER_ADMIN) {
      const properties = await PropertyService.getProperties();
      return NextResponse.json({ success: true, properties });
    }

    if (!session.propertyId) {
      return NextResponse.json({ success: true, properties: [] });
    }

    const property = await PropertyService.getPropertyById(session.propertyId);
    return NextResponse.json({
      success: true,
      properties: property ? [property] : [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Only Super Admin has platform-wide hotel creation authority
    await requireAuth([RoleName.SUPER_ADMIN], req);
    const body = await req.json();
    const validated = createPropertySchema.parse(body);
    const property = await PropertyService.createProperty(validated);
    return NextResponse.json({ success: true, property }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
