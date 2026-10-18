import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { ReservationService } from "@/modules/reservations/reservation.service";
import { extendStaySchema } from "@/modules/reservations/reservation.validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST],
      req
    );
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const validated = extendStaySchema.parse(body);
    const propertyId =
      session.role === RoleName.SUPER_ADMIN ? undefined : session.propertyId || undefined;

    const result = await ReservationService.extendStay(
      id,
      validated,
      session.sub,
      propertyId
    );

    return NextResponse.json({
      success: true,
      data: result,
      message: `Stay extended successfully to ${result.departureDate.toISOString().split("T")[0]}`,
    });
  } catch (error) {
    return handleApiError(error, "Failed to extend stay");
  }
}
