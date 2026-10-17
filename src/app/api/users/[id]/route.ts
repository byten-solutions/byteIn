import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { UserService } from "@/modules/users/user.service";
import { handleApiError } from "@/lib/errors";

import { UpdateUserInput } from "@/modules/users/user.types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth([RoleName.ADMIN], req);
    const { id } = await params;
    const user = await UserService.getUserById(id);
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
    const session = await requireAuth([RoleName.ADMIN], req);
    const { id } = await params;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const updated = await UserService.updateUser(id, body as unknown as UpdateUserInput, session.sub);
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
    const session = await requireAuth([RoleName.ADMIN], req);
    const { id } = await params;

    await UserService.deleteUser(id, session.sub);
    return NextResponse.json({
      success: true,
      message: "User successfully deleted.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
