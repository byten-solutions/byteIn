import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { RoleName } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { PropertyService } from "@/modules/properties/property.service";
import { createPropertySchema } from "@/modules/properties/property.validation";

export async function GET() {
  try {
    await requireAuth();
    const properties = await PropertyService.getProperties();
    return NextResponse.json({ success: true, properties });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/properties error:", error);
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth([RoleName.ADMIN]);
    const body = await req.json();
    const validated = createPropertySchema.parse(body);
    const property = await PropertyService.createProperty(validated);
    return NextResponse.json({ success: true, property }, { status: 201 });
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
    console.error("POST /api/properties error:", error);
    return NextResponse.json({ error: "Failed to create property" }, { status: 500 });
  }
}
