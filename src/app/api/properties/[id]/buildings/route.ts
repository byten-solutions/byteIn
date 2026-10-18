import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { PropertyService } from "@/modules/properties/property.service";
import { createBuildingSchema } from "@/modules/properties/property.validation";
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

    const buildings = await PropertyService.getBuildings(id);
    return NextResponse.json({ success: true, buildings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN], req);
    const { id: propertyId } = await params;

    if (session.role === RoleName.ADMIN && session.propertyId !== propertyId) {
      throw new ForbiddenError("Cannot add buildings to another hotel");
    }

    const body = await req.json();
    const validated = createBuildingSchema.parse(body);
    const building = await PropertyService.createBuilding({
      propertyId,
      ...validated,
    });
    return NextResponse.json({ success: true, building }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
