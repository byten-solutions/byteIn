import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { paginationQuerySchema } from "@/lib/pagination";
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
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const { page, limit } = paginationQuerySchema.parse({
      page: pageParam ?? undefined,
      limit: limitParam ?? undefined,
    });

    const result = await UserService.listUsersPage(session, {
      propertyId,
      role,
      status,
      search,
      page,
      limit,
    });
    return NextResponse.json({
      success: true,
      data: result.users,
      users: result.users,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
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
