import { NextResponse } from "next/server";
import { deleteSessionCookie } from "@/lib/session";

export async function POST() {
  await deleteSessionCookie();
  return NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });
}
