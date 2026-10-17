import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { ReservationService } from "@/modules/reservations/reservation.service";
import { markNoShowSchema } from "@/modules/reservations/reservation.validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST], req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const validated = markNoShowSchema.parse(body);
    const result = await ReservationService.markNoShow(
      id,
      session.sub,
      validated.notes
    );

    return NextResponse.json({
      success: true,
      data: result,
      message: `Room allocation marked as NO_SHOW and room released`,
    });
  } catch (error) {
    return handleApiError(error, "Failed to mark allocation as NO_SHOW");
  }
}
