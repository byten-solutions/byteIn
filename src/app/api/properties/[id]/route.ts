import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { PropertyService } from "@/modules/properties/property.service";
import { updatePropertySchema } from "@/modules/properties/property.validation";
import { handleApiError, ForbiddenError, NotFoundError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(undefined, req);
    const { id } = await params;

    if (session.role !== RoleName.SUPER_ADMIN && session.propertyId !== id) {
      throw new NotFoundError("Property not found");
    }

    const property = await PropertyService.getPropertyById(id);
    if (!property) {
      throw new NotFoundError("Property not found");
    }

    return NextResponse.json({ success: true, property });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN], req);
    const { id } = await params;

    if (session.role === RoleName.ADMIN && session.propertyId !== id) {
      throw new ForbiddenError("Cannot modify settings for another hotel");
    }

    const body = await req.json();
    const validated = updatePropertySchema.parse(body);
    const property = await PropertyService.updateProperty(id, validated);
    return NextResponse.json({ success: true, property });
  } catch (error) {
    return handleApiError(error);
  }
}
