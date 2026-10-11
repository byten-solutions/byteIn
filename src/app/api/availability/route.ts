import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { ReservationService } from "@/modules/reservations/reservation.service";
import { checkAvailabilitySchema } from "@/modules/reservations/reservation.validation";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const searchParams = req.nextUrl.searchParams;

    const arrivalDate = searchParams.get("arrivalDate");
    const departureDate = searchParams.get("departureDate");
    const propertyId = searchParams.get("propertyId") || undefined;
    const roomCategoryId = searchParams.get("roomCategoryId") || undefined;
    const minCapacity = searchParams.get("minCapacity") || undefined;

    if (!arrivalDate || !departureDate) {
      return NextResponse.json(
        { error: "Both arrivalDate and departureDate query parameters are required" },
        { status: 400 }
      );
    }

    const validated = checkAvailabilitySchema.parse({
      arrivalDate,
      departureDate,
      propertyId,
      roomCategoryId,
      minCapacity,
    });

    const rooms = await ReservationService.checkAvailability(validated);

    return NextResponse.json({
      success: true,
      count: rooms.length,
      rooms,
    });
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
    const message = error instanceof Error ? error.message : "Failed to check availability";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
