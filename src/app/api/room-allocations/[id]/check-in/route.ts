import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { RoleName } from "@prisma/client";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { CheckInOutService } from "@/modules/check-in-out/check-in-out.service";
import { checkInSchema } from "@/modules/check-in-out/check-in-out.validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const validated = checkInSchema.parse({
      ...body,
      allocationId: id,
    });

    const result = await CheckInOutService.checkIn(validated, session.sub);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Room ${result.roomNo} successfully checked in.`,
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
    const message = error instanceof Error ? error.message : "Failed to check in room";
    let status = 400;
    if (message.includes("not found")) {
      status = 404;
    } else if (message.includes("already checked in")) {
      status = 409;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
