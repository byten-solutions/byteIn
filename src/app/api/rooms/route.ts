import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { RoleName, RoomStatus } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { RoomService } from "@/modules/rooms/room.service";
import { createRoomSchema } from "@/modules/rooms/room.validation";

import { handleApiError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(undefined, req);
    const searchParams = req.nextUrl.searchParams;

    const propertyId = searchParams.get("propertyId") || undefined;
    const buildingId = searchParams.get("buildingId") || undefined;
    const floorId = searchParams.get("floorId") || undefined;
    const roomCategoryId = searchParams.get("roomCategoryId") || undefined;
    const statusParam = searchParams.get("status");
    const status =
      statusParam && Object.values(RoomStatus).includes(statusParam as RoomStatus)
        ? (statusParam as RoomStatus)
        : undefined;
    const search = searchParams.get("search") || undefined;

    const rooms = await RoomService.getRooms({
      propertyId,
      buildingId,
      floorId,
      roomCategoryId,
      status,
      search,
    });

    return NextResponse.json({ success: true, rooms });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth([RoleName.ADMIN], req);
    const body = await req.json();
    const validated = createRoomSchema.parse(body);
    const room = await RoomService.createRoom(validated);
    return NextResponse.json({ success: true, room }, { status: 201 });
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
    const message = error instanceof Error ? error.message : "Failed to create room";
    let status = 400;
    if (message.includes("already exists")) {
      status = 409;
    } else if (message.includes("not found")) {
      status = 404;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
