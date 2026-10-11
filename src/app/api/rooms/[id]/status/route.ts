import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { RoleName } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { RoomService } from "@/modules/rooms/room.service";
import { updateRoomStatusSchema } from "@/modules/rooms/room.validation";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST]);
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
      }
    );

    return NextResponse.json({
      success: true,
      message: `Room status updated to ${room.status}`,
      room,
    });
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
    const message = error instanceof Error ? error.message : "Failed to update room status";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
