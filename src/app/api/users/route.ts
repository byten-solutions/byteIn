import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { UserService } from "@/modules/users/user.service";
import { handleApiError } from "@/lib/errors";

import { CreateUserInput } from "@/modules/users/user.types";

export async function GET(req: NextRequest) {
  try {
    await requireAuth([RoleName.ADMIN], req);
    const users = await UserService.listUsers();
    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth([RoleName.ADMIN], req);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const created = await UserService.createUser(body as unknown as CreateUserInput, session.sub);
    return NextResponse.json(
      {
        success: true,
        data: created,
        message: "User successfully created.",
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
