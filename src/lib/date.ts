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
