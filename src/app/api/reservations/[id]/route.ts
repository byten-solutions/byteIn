import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { ReservationService } from "@/modules/reservations/reservation.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const reservation = await ReservationService.getReservationById(id);
    return NextResponse.json({ success: true, reservation });
  } catch (error) {
    return handleApiError(error, "Failed to fetch reservation");
  }
}
