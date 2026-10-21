import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, invalidateSessionUserCache } from "@/lib/auth-guard";
import { deleteSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (session?.sub) {
      invalidateSessionUserCache(session.sub);
      await prisma.user.update({
        where: { id: session.sub },
        data: { tokenVersion: { increment: 1 } },
      });
    }
  } catch (error) {
    // If DB update fails, log the error but proceed to ensure client cookie is cleared
    console.error("[Logout] Failed to increment tokenVersion:", error);
  }

  await deleteSessionCookie();

  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
