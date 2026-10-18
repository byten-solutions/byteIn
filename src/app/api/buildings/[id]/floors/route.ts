import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PropertyService } from "@/modules/properties/property.service";
import { createFloorSchema } from "@/modules/properties/property.validation";
import { handleApiError, ForbiddenError, NotFoundError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(undefined, req);
    const { id } = await params;

    const building = await prisma.building.findUnique({
      where: { id },
      select: { propertyId: true },
    });

    if (!building) {
      throw new NotFoundError("Building not found");
    }

    if (session.role !== RoleName.SUPER_ADMIN && session.propertyId !== building.propertyId) {
      throw new NotFoundError("Building not found");
    }

    const floors = await PropertyService.getFloors(id);
    return NextResponse.json({ success: true, floors });
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
    const { id: buildingId } = await params;

    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { propertyId: true },
    });

    if (!building) {
      throw new NotFoundError("Building not found");
    }

    if (session.role === RoleName.ADMIN && session.propertyId !== building.propertyId) {
      throw new ForbiddenError("Cannot add floors to another hotel's building");
    }

    const body = await req.json();
    const validated = createFloorSchema.parse(body);
    const floor = await PropertyService.createFloor({
      buildingId,
      ...validated,
    });
    return NextResponse.json({ success: true, floor }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
