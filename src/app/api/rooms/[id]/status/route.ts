import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { RoomService } from "@/modules/rooms/room.service";
import { updateRoomStatusSchema } from "@/modules/rooms/room.validation";
import { handleApiError } from "@/lib/errors";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST],
      req
    );
    const scope = resolveScope(session, null, { allowSuperAdminGlobal: true });
    const { id } = await params;
    const body = await req.json();
    const validated = updateRoomStatusSchema.parse(body);

    const room = await RoomService.updateRoomStatus(
      id,
      validated.status,
      validated.notes,
      {
        userId: session.sub,
        name: session.name,
      },
      { propertyId: scope ?? undefined }
    );

    return NextResponse.json({
      success: true,
      message: `Room status updated to ${room.status}`,
      room,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
