import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth-guard";
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch reservation";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
