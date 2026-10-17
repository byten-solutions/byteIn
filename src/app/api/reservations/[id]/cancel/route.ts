import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { ReservationService } from "@/modules/reservations/reservation.service";
import { cancelReservationSchema } from "@/modules/reservations/reservation.validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST], req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const validated = cancelReservationSchema.parse(body);
    const result = await ReservationService.cancelReservation(
      id,
      session.sub,
      validated.reason
    );

    return NextResponse.json({
      success: true,
      data: result,
      message: `Reservation ${result.reservationNo} cancelled successfully`,
    });
  } catch (error) {
    return handleApiError(error, "Failed to cancel reservation");
  }
}
