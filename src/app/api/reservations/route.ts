import { NextRequest, NextResponse } from "next/server";
import { ReservationStatus, RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { handleApiError, ForbiddenError } from "@/lib/errors";
import { paginationQuerySchema } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { ReservationService } from "@/modules/reservations/reservation.service";
import { createReservationSchema } from "@/modules/reservations/reservation.validation";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(undefined, req);
    const searchParams = req.nextUrl.searchParams;

    const search = searchParams.get("search") || undefined;
    const statusParam = searchParams.get("status");
    const status =
      statusParam && Object.values(ReservationStatus).includes(statusParam as ReservationStatus)
        ? (statusParam as ReservationStatus)
        : undefined;

    const effectivePropertyId =
      resolveScope(session, searchParams.get("propertyId"), { allowSuperAdminGlobal: true }) ?? undefined;

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const { page, limit } = paginationQuerySchema.parse({
      page: pageParam ?? undefined,
      limit: limitParam ?? undefined,
    });

    const result = await ReservationService.getReservations({
      search,
      status,
      propertyId: effectivePropertyId,
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
    const session = await requireAuth(undefined, req);
    const body = await req.json();
    const validated = createReservationSchema.parse(body);

    if (session.role !== RoleName.SUPER_ADMIN && session.propertyId) {
      const roomIds = validated.allocations.map((a) => a.roomId);
      const invalidRooms = await prisma.room.findMany({
        where: {
          id: { in: roomIds },
          propertyId: { not: session.propertyId },
        },
        select: { id: true, roomNo: true },
      });
      if (invalidRooms.length > 0) {
        throw new ForbiddenError("Cannot allocate rooms belonging to another property");
      }
    }

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
