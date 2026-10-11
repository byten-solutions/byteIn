import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { ReservationStatus } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import {
  ReservationService,
  ReservationConflictError,
} from "@/modules/reservations/reservation.service";
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
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await ReservationService.getReservations({
      search,
      status,
      page,
      limit,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/reservations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservations" },
      { status: 500 }
    );
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    if (error instanceof ReservationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "Failed to create reservation";
    let status = 400;
    if (message.includes("already booked") || message.includes("concurrent")) {
      status = 409;
    } else if (message.includes("not found")) {
      status = 404;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
