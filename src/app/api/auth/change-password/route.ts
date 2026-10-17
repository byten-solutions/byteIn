import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { AuthService } from "@/modules/auth/auth.service";
import { setSessionCookie } from "@/lib/session";
import { handleApiError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(undefined, req);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    const userAgent = req.headers.get("user-agent") || undefined;
    const ip = req.headers.get("x-forwarded-for") || undefined;

    const result = await AuthService.changePassword(
      session.sub,
      { currentPassword, newPassword },
      { ip, userAgent }
    );

    // Set new session cookie with updated tokenVersion
    await setSessionCookie(result.token);

    return NextResponse.json({
      success: true,
      data: result.user,
      message: "Password successfully changed. Other active sessions have been invalidated.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
