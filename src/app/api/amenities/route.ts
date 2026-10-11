import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { RoleName } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { AmenityService } from "@/modules/rooms/room.service";
import { createAmenitySchema } from "@/modules/rooms/room.validation";

export async function GET() {
  try {
    await requireAuth();
    const amenities = await AmenityService.getAmenities();
    return NextResponse.json({ success: true, amenities });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/amenities error:", error);
    return NextResponse.json({ error: "Failed to fetch amenities" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth([RoleName.ADMIN]);
    const body = await req.json();
    const validated = createAmenitySchema.parse(body);
    const amenity = await AmenityService.createAmenity(validated);
    return NextResponse.json({ success: true, amenity }, { status: 201 });
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
    console.error("POST /api/amenities error:", error);
    return NextResponse.json({ error: "Failed to create amenity" }, { status: 500 });
  }
}
