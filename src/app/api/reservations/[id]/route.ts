import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { handleApiError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { ReservationService } from "@/modules/reservations/reservation.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(undefined, req);
    const { id } = await params;
    const reservation = await ReservationService.getReservationById(id);
    if (!reservation) {
      throw new NotFoundError("Reservation not found");
    }

    if (session.role !== RoleName.SUPER_ADMIN && session.propertyId) {
      const belongsToHotel = reservation.rooms.some(
        (r) => r.room.propertyId === session.propertyId
      );
      if (!belongsToHotel) {
        throw new ForbiddenError("Access denied: Reservation belongs to another property");
      }
    }

    return NextResponse.json({ success: true, reservation });
  } catch (error) {
    return handleApiError(error, "Failed to fetch reservation");
  }
}
