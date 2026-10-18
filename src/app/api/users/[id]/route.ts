import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { UserService } from "@/modules/users/user.service";
import { updateUserSchema } from "@/modules/users/user.validation";
import { handleApiError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const { id } = await params;
    const user = await UserService.getUserById(id, session);
    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const { id } = await params;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const validated = updateUserSchema.parse(body);
    const updated = await UserService.updateUser(id, validated, session);
    return NextResponse.json({
      success: true,
      data: updated,
      message: "User successfully updated.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const { id } = await params;

    await UserService.deleteUser(id, session);
    return NextResponse.json({
      success: true,
      message: "User successfully deleted.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
