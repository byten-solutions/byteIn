import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { RoleName } from "@/modules/auth/auth.types";

export async function GET(req: NextRequest) {
  try {
    const roleParam = req.nextUrl.searchParams.get("role");
    const allowedRoles: RoleName[] =
      roleParam && Object.values(RoleName).includes(roleParam as RoleName)
        ? [roleParam as RoleName]
        : [RoleName.ADMIN, RoleName.RECEPTIONIST];

    const session = await requireAuth(allowedRoles);

    return NextResponse.json({
      success: true,
      message: `Access granted for role ${session.role}`,
      user: {
        id: session.sub,
        email: session.email,
        name: session.name,
        role: session.role,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
