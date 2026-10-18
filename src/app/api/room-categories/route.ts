import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, requireHotelContext } from "@/lib/auth-guard";
import { RoomCategoryService } from "@/modules/rooms/room.service";
import { createCategorySchema } from "@/modules/rooms/room.validation";
import { handleApiError, BadRequestError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(undefined, req);
    const requestedPropertyId = req.nextUrl.searchParams.get("propertyId") || undefined;
    const effectivePropertyId = requireHotelContext(session, requestedPropertyId, {
      allowSuperAdminGlobal: true,
    });
    const categories = await RoomCategoryService.getCategories(effectivePropertyId || undefined);
    return NextResponse.json({ success: true, categories });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN], req);
    const body = await req.json();
    const validated = createCategorySchema.parse(body);

    const effectivePropertyId = requireHotelContext(session, validated.propertyId);
    if (!effectivePropertyId) {
      throw new BadRequestError("propertyId is required to create a room category");
    }

    const category = await RoomCategoryService.createCategory({
      ...validated,
      propertyId: effectivePropertyId,
    });
    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
