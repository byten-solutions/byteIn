import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { UserService } from "@/modules/users/user.service";
import { createUserSchema } from "@/modules/users/user.validation";
import { handleApiError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );
    const searchParams = req.nextUrl.searchParams;
    const propertyId = searchParams.get("propertyId") || undefined;
    const roleParam = searchParams.get("role") as RoleName | null;
    const role =
      roleParam && Object.values(RoleName).includes(roleParam)
        ? roleParam
        : undefined;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;

    const users = await UserService.listUsers(session, {
      propertyId,
      role,
      status,
      search,
    });
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
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const validated = createUserSchema.parse(body);
    const created = await UserService.createUser(validated, session);
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
