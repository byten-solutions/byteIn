import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { RoleName } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { RoomCategoryService } from "@/modules/rooms/room.service";
import { updateCategorySchema } from "@/modules/rooms/room.validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const category = await RoomCategoryService.getCategoryById(id);
    if (!category) {
      return NextResponse.json({ error: "Room category not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, category });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/room-categories/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch room category" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth([RoleName.ADMIN]);
    const { id } = await params;
    const body = await req.json();
    const validated = updateCategorySchema.parse(body);
    const category = await RoomCategoryService.updateCategory(id, validated);
    return NextResponse.json({ success: true, category });
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
    const message = error instanceof Error ? error.message : "Failed to update category";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth([RoleName.ADMIN]);
    const { id } = await params;
    await RoomCategoryService.deleteCategory(id);
    return NextResponse.json({
      success: true,
      message: "Room category deleted successfully",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to delete category";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
