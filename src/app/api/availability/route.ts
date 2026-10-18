import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireHotelContext } from "@/lib/auth-guard";
import { ReservationService } from "@/modules/reservations/reservation.service";
import { checkAvailabilitySchema } from "@/modules/reservations/reservation.validation";
import { handleApiError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(undefined, req);
    const searchParams = req.nextUrl.searchParams;

    const arrivalDate = searchParams.get("arrivalDate");
    const departureDate = searchParams.get("departureDate");
    const requestedPropertyId = searchParams.get("propertyId") || undefined;
    const effectivePropertyId = requireHotelContext(session, requestedPropertyId, {
      allowSuperAdminGlobal: true,
    });
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
      propertyId: effectivePropertyId || undefined,
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
    return handleApiError(error);
  }
}
