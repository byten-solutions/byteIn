import { NextRequest, NextResponse } from "next/server";
import { ReservationStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { paginationQuerySchema } from "@/lib/pagination";
import { ReservationService } from "@/modules/reservations/reservation.service";
import { createReservationSchema } from "@/modules/reservations/reservation.validation";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const searchParams = req.nextUrl.searchParams;

    const search = searchParams.get("search") || undefined;
    const statusParam = searchParams.get("status");
    const status =
      statusParam && Object.values(ReservationStatus).includes(statusParam as ReservationStatus)
        ? (statusParam as ReservationStatus)
        : undefined;

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const { page, limit } = paginationQuerySchema.parse({
      page: pageParam ?? undefined,
      limit: limitParam ?? undefined,
    });

    const result = await ReservationService.getReservations({
      search,
      status,
      page,
      limit,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error, "Failed to fetch reservations");
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const validated = createReservationSchema.parse(body);

    const reservation = await ReservationService.createReservation(
      validated,
      session.sub
    );

    return NextResponse.json(
      { success: true, reservation },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "Failed to create reservation");
  }
}
