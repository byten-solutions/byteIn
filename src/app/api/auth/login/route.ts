import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthService } from "@/modules/auth/auth.service";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const ip = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const { user, token } = await AuthService.login(body, { ip, userAgent });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Authentication failed";

    if (message === "Account is disabled. Please contact an administrator.") {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (message === "Invalid email or password") {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    console.error("Unhandled login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during authentication" },
      { status: 500 }
    );
  }
}
