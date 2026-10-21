import { NextRequest, NextResponse } from "next/server";
import { RoleName, RoomStatus } from "@prisma/client";
import { requireAuth, requireHotelContext } from "@/lib/auth-guard";
import { RoomService } from "@/modules/rooms/room.service";
import { createRoomSchema } from "@/modules/rooms/room.validation";
import { handleApiError, BadRequestError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(undefined, req);
    const searchParams = req.nextUrl.searchParams;

    const requestedPropertyId = searchParams.get("propertyId") || undefined;
    const effectivePropertyId = requireHotelContext(session, requestedPropertyId, {
      allowSuperAdminGlobal: true,
    });

    const buildingId = searchParams.get("buildingId") || undefined;
    const floorId = searchParams.get("floorId") || undefined;
    const roomCategoryId = searchParams.get("roomCategoryId") || undefined;
    const statusParam = searchParams.get("status");
    const status =
      statusParam && Object.values(RoomStatus).includes(statusParam as RoomStatus)
        ? (statusParam as RoomStatus)
        : undefined;
    const search = searchParams.get("search") || undefined;
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const cursor = searchParams.get("cursor") || undefined;
    const page = pageParam ? parseInt(pageParam, 10) : undefined;
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    if (searchParams.get("summary") === "true") {
      const summary = await RoomService.getRoomsSummary(effectivePropertyId || undefined);
      return NextResponse.json({ success: true, ...summary });
    }

    if (cursor !== undefined || page !== undefined || limit !== undefined) {
      const result = await RoomService.getRoomsPage({
        propertyId: effectivePropertyId || undefined,
        buildingId,
        floorId,
        roomCategoryId,
        status,
        search,
        page,
        limit,
        cursor,
      });

      return NextResponse.json({
        success: true,
        rooms: result.rooms,
        nextCursor: result.nextCursor,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          nextCursor: result.nextCursor,
        },
      });
    }

    const rooms = await RoomService.getRooms({
      propertyId: effectivePropertyId || undefined,
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
    const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN], req);
    const body = await req.json();
    const validated = createRoomSchema.parse(body);

    const effectivePropertyId = requireHotelContext(session, validated.propertyId);
    if (!effectivePropertyId) {
      throw new BadRequestError("propertyId is required to create a room");
    }

    const room = await RoomService.createRoom({
      ...validated,
      propertyId: effectivePropertyId,
    });
    return NextResponse.json({ success: true, room }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
