import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { AmenityService } from "@/modules/rooms/room.service";
import { createAmenitySchema } from "@/modules/rooms/room.validation";
import { handleApiError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(undefined, req);
    const amenities = await AmenityService.getAmenities();
    return NextResponse.json({ success: true, amenities });
  } catch (error) {
    return handleApiError(error, "Failed to fetch amenities");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN], req);
    const body = await req.json();
    const validated = createAmenitySchema.parse(body);
    const amenity = await AmenityService.createAmenity(validated);
    return NextResponse.json({ success: true, amenity }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to create amenity");
  }
}
