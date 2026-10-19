import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { RoomService } from "@/modules/rooms/room.service";
import { updateRoomSchema } from "@/modules/rooms/room.validation";
import { handleApiError, ForbiddenError, NotFoundError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(undefined, req);
    const { id } = await params;
    const room = await RoomService.getRoomById(id);
    if (!room) {
      throw new NotFoundError("Room not found");
    }

    if (session.role !== RoleName.SUPER_ADMIN && session.propertyId !== room.propertyId) {
      throw new NotFoundError("Room not found");
    }

    return NextResponse.json({ success: true, room });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN], req);
    const { id } = await params;

    const existingRoom = await RoomService.getRoomById(id);
    if (!existingRoom) {
      throw new NotFoundError("Room not found");
    }

    if (session.role === RoleName.ADMIN && session.propertyId !== existingRoom.propertyId) {
      throw new ForbiddenError("Cannot modify rooms in another hotel");
    }

    const scope = resolveScope(session, null, { allowSuperAdminGlobal: true });
    const body = await req.json();
    const validated = updateRoomSchema.parse(body);
    const room = await RoomService.updateRoom(id, validated, { propertyId: scope ?? undefined });
    return NextResponse.json({ success: true, room });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN], req);
    const { id } = await params;

    const existingRoom = await RoomService.getRoomById(id);
    if (!existingRoom) {
      throw new NotFoundError("Room not found");
    }

    if (session.role === RoleName.ADMIN && session.propertyId !== existingRoom.propertyId) {
      throw new ForbiddenError("Cannot delete rooms in another hotel");
    }

    const scope = resolveScope(session, null, { allowSuperAdminGlobal: true });
    await RoomService.deleteRoom(id, { propertyId: scope ?? undefined });
    return NextResponse.json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
