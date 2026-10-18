import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { RoomCategoryService } from "@/modules/rooms/room.service";
import { updateCategorySchema } from "@/modules/rooms/room.validation";
import { handleApiError, ForbiddenError, NotFoundError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(undefined, req);
    const { id } = await params;
    const category = await RoomCategoryService.getCategoryById(id);
    if (!category) {
      throw new NotFoundError("Room category not found");
    }

    if (
      session.role !== RoleName.SUPER_ADMIN &&
      category.propertyId &&
      category.propertyId !== session.propertyId
    ) {
      throw new NotFoundError("Room category not found");
    }

    return NextResponse.json({ success: true, category });
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

    const existing = await RoomCategoryService.getCategoryById(id);
    if (!existing) {
      throw new NotFoundError("Room category not found");
    }

    if (
      session.role === RoleName.ADMIN &&
      existing.propertyId &&
      existing.propertyId !== session.propertyId
    ) {
      throw new ForbiddenError("Cannot modify categories for another hotel");
    }

    const body = await req.json();
    const validated = updateCategorySchema.parse(body);
    const category = await RoomCategoryService.updateCategory(id, validated);
    return NextResponse.json({ success: true, category });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN], req);
    const { id } = await params;

    const existing = await RoomCategoryService.getCategoryById(id);
    if (!existing) {
      throw new NotFoundError("Room category not found");
    }

    if (
      session.role === RoleName.ADMIN &&
      existing.propertyId &&
      existing.propertyId !== session.propertyId
    ) {
      throw new ForbiddenError("Cannot delete categories for another hotel");
    }

    await RoomCategoryService.deleteCategory(id);
    return NextResponse.json({
      success: true,
      message: "Room category deleted successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
