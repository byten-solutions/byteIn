import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { CheckInOutService } from "@/modules/check-in-out/check-in-out.service";
import { checkOutSchema } from "@/modules/check-in-out/check-in-out.validation";

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

    const validated = checkOutSchema.parse({
      ...body,
      allocationId: id,
    });

    const propertyId =
      resolveScope(session, null, { allowSuperAdminGlobal: true }) ?? undefined;

    const result = await CheckInOutService.checkOut(validated, session.sub, propertyId);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Room ${result.roomNo} successfully checked out. Room transitioned to VACANT_DIRTY.`,
    });
  } catch (error) {
    return handleApiError(error, "Failed to check out room");
  }
}
