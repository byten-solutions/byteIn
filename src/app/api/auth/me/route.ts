import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-guard";
import { AuthService } from "@/modules/auth/auth.service";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await AuthService.getCurrentUser(session.sub);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Account is disabled. Please contact an administrator." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    success: true,
    user,
  });
}
