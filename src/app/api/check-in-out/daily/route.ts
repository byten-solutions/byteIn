import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth-guard";
import { CheckInOutService } from "@/modules/check-in-out/check-in-out.service";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const searchParams = req.nextUrl.searchParams;
    const dateParam = searchParams.get("date");
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    const [arrivals, departures] = await Promise.all([
      CheckInOutService.getDailyArrivals(targetDate),
      CheckInOutService.getDailyDepartures(targetDate),
    ]);

    return NextResponse.json({
      success: true,
      arrivalsCount: arrivals.length,
      departuresCount: departures.length,
      arrivals,
      departures,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/check-in-out/daily error:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily arrivals and departures" },
      { status: 500 }
    );
  }
}
