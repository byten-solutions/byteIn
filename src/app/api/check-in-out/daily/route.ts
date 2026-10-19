import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveScope } from "@/lib/auth-guard";
import { handleApiError } from "@/lib/errors";
import { CheckInOutService } from "@/modules/check-in-out/check-in-out.service";
import { normalizeDate } from "@/modules/reservations/reservation.validation";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(undefined, req);
    const searchParams = req.nextUrl.searchParams;
    const dateParam = searchParams.get("date");

    let targetDate = new Date();
    if (dateParam) {
      try {
        targetDate = normalizeDate(dateParam);
      } catch {
        return NextResponse.json(
          { error: "Invalid date format. Expected YYYY-MM-DD" },
          { status: 400 }
        );
      }
    }

    const scope = resolveScope(session, searchParams.get("propertyId"), {
      allowSuperAdminGlobal: true,
    });
    const [arrivals, departures] = await Promise.all([
      CheckInOutService.getDailyArrivals(targetDate, scope ?? undefined),
      CheckInOutService.getDailyDepartures(targetDate, scope ?? undefined),
    ]);

    return NextResponse.json({
      success: true,
      arrivalsCount: arrivals.length,
      departuresCount: departures.length,
      arrivals,
      departures,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch daily arrivals and departures");
  }
}
