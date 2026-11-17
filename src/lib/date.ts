import { HOTEL_TIMEZONE } from "@/config/hotel";

export { HOTEL_TIMEZONE };

/**
 * Returns the current date in the hotel's operating timezone formatted as "YYYY-MM-DD".
 * This prevents the midnight to 05:30 AM IST boundary shift where UTC evaluates to yesterday.
 * 
 * @param date Optional Date instance (defaults to current system time)
 * @param timeZone Optional timezone (defaults to HOTEL_TIMEZONE = "Asia/Kolkata")
 */
export function getHotelTodayDate(
  date: Date = new Date(),
  timeZone: string = HOTEL_TIMEZONE
): string {
  // Using en-CA locale formats to ISO YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Returns a UTC Midnight Date object (00:00:00.000Z) corresponding to the hotel's
 * current date in its operating timezone.
 * 
 * PostgreSQL @db.Date columns are queried against UTC midnight boundaries.
 */
export function getHotelTodayDateUtc(
  date: Date = new Date(),
  timeZone: string = HOTEL_TIMEZONE
): Date {
  const ymd = getHotelTodayDate(date, timeZone);
  const [yearStr, monthStr, dayStr] = ymd.split("-");
  const year = parseInt(yearStr!, 10);
  const month = parseInt(monthStr!, 10) - 1;
  const day = parseInt(dayStr!, 10);
  return new Date(Date.UTC(year, month, day));
}

/**
 * Returns a Date object representing 00:00:00.000 in the specified timezone
 * for a given "YYYY-MM-DD" date string.
 *
 * This provides the exact half-open lower bound (>= startOfDay) in UTC.
 */
export function getHotelDateBoundaryUtc(
  dateStr: string,
  timeZone: string = HOTEL_TIMEZONE
): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid date format for boundary: "${dateStr}". Expected YYYY-MM-DD`);
  }
  const approx = new Date(`${dateStr}T12:00:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  }).formatToParts(approx);

  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+0";
  const offsetMatch = tzPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  let offsetStr = "+00:00";
  if (offsetMatch) {
    const sign = offsetMatch[1];
    const hours = offsetMatch[2]!.padStart(2, "0");
    const mins = (offsetMatch[3] || "00").padStart(2, "0");
    offsetStr = `${sign}${hours}:${mins}`;
  }
  return new Date(`${dateStr}T00:00:00.000${offsetStr}`);
}

/**
 * Returns "YYYY-MM-DD" string with the given number of days added.
 */
export function addDaysToYmd(ymd: string, days: number): string {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid date format for addDaysToYmd: "${ymd}". Expected YYYY-MM-DD`);
  }
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
}

