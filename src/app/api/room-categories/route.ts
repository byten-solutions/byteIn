import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { RoleName } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { RoomCategoryService } from "@/modules/rooms/room.service";
import { createCategorySchema } from "@/modules/rooms/room.validation";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const propertyId = req.nextUrl.searchParams.get("propertyId") || undefined;
    const categories = await RoomCategoryService.getCategories(propertyId);
    return NextResponse.json({ success: true, categories });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/room-categories error:", error);
    return NextResponse.json({ error: "Failed to fetch room categories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth([RoleName.ADMIN]);
    const body = await req.json();
    const validated = createCategorySchema.parse(body);
    const category = await RoomCategoryService.createCategory(validated);
    return NextResponse.json({ success: true, category }, { status: 201 });
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
    const message = error instanceof Error ? error.message : "Failed to create category";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
