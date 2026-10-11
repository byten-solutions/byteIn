const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/**
 * Formats a date to "DD MMM YYYY" (e.g. "11 Oct 2026") in en-IN and IST.
 * For date-only strings (YYYY-MM-DD), parses the components directly
 * without timezone conversions so date-only fields never shift by a day.
 */
export function formatDate(
  input: string | Date | null | undefined
): string {
  if (!input) return "";

  // Date-only string: YYYY-MM-DD
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    const [yearStr, monthStr, dayStr] = input.trim().split("-");
    const year = parseInt(yearStr!, 10);
    const monthIdx = parseInt(monthStr!, 10) - 1;
    const day = parseInt(dayStr!, 10);
    const month = MONTH_NAMES[monthIdx] || "";
    return `${day} ${month} ${year}`;
  }

  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "";

  return dateFormatter.format(d);
}

/**
 * Formats a timestamp to "DD MMM YYYY, h:mm A" (e.g. "11 Oct 2026, 7:30 PM") in en-IN and IST.
 */
export function formatDateTime(
  input: string | Date | null | undefined
): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "";

  const formatted = dateTimeFormatter.format(d);
  // Normalize lowercase am/pm to uppercase AM/PM
  return formatted.replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());
}

/**
 * Formats a stay range from arrival and departure dates without date shifting.
 */
export function formatStayRange(
  arrival: string | Date,
  departure: string | Date
): string {
  const arrStr = formatDate(arrival);
  const depStr = formatDate(departure);
  return `${arrStr} – ${depStr}`;
}
