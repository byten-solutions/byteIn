import { NextRequest, NextResponse } from "next/server";
import { RoleName } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(
      [RoleName.SUPER_ADMIN, RoleName.ADMIN],
      req
    );

    const roles = await prisma.role.findMany({
      orderBy: { name: "asc" },
    });

    // Hotel Admin can only assign RECEPTIONIST role
    const filteredRoles =
      session.role === RoleName.ADMIN
        ? roles.filter((r) => r.name === RoleName.RECEPTIONIST)
        : roles;

    return NextResponse.json({
      success: true,
      data: filteredRoles,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
