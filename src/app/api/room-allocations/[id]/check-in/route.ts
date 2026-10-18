import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { CheckInOutService } from "@/modules/check-in-out/check-in-out.service";
import { checkInSchema } from "@/modules/check-in-out/check-in-out.validation";

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

    const validated = checkInSchema.parse({
      ...body,
      allocationId: id,
    });

    const propertyId =
      session.role === RoleName.SUPER_ADMIN ? undefined : session.propertyId || undefined;

    const result = await CheckInOutService.checkIn(validated, session.sub, propertyId);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Room ${result.roomNo} successfully checked in.`,
    });
  } catch (error) {
    return handleApiError(error, "Failed to check in room");
  }
}
