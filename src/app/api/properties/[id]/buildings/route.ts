import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { RoleName } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { PropertyService } from "@/modules/properties/property.service";
import { createBuildingSchema } from "@/modules/properties/property.validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const buildings = await PropertyService.getBuildings(id);
    return NextResponse.json({ success: true, buildings });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/properties/[id]/buildings error:", error);
    return NextResponse.json({ error: "Failed to fetch buildings" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth([RoleName.ADMIN]);
    const { id: propertyId } = await params;
    const body = await req.json();
    const validated = createBuildingSchema.parse(body);
    const building = await PropertyService.createBuilding({
      propertyId,
      ...validated,
    });
    return NextResponse.json({ success: true, building }, { status: 201 });
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
    const message = error instanceof Error ? error.message : "Failed to create building";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
