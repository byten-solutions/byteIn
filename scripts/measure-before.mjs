import { ReportsService } from "../src/modules/reports/reports.service.ts";
import { getHotelTodayDate } from "../src/lib/date.ts";

// Measure directly against ReportsService
const propertyId = "cprop366914525589ad143103";
const today = getHotelTodayDate();
const [y, m] = today.split("-");
const startDate = `${y}-${m}-01`;
const endDate = today;

const reports = [
  { name: "/api/reports/daily-operations/counts", fn: () => ReportsService.getDailyOperationsCounts(today, propertyId) },
  { name: "/api/reports/daily-operations/list", fn: () => ReportsService.getDailyOperationsList({ type: "arrivals", date: today, propertyId, limit: 25 }) },
  { name: "/api/reports/occupancy", fn: () => ReportsService.getOccupancyReport({ startDate, endDate, propertyId }) },
  { name: "/api/reports/revenue", fn: () => ReportsService.getRevenueReport({ startDate, endDate, propertyId }) },
  { name: "/api/reports/reservations", fn: () => ReportsService.getReservationStatusReport({ startDate, endDate, propertyId }) },
  { name: "/api/reports/receivables", fn: () => ReportsService.getReceivablesReport(propertyId, "all", { limit: 25 }) },
  { name: "/api/reports/collections", fn: () => ReportsService.getShiftCollections(today, startDate, endDate, undefined, propertyId, { limit: 25 }) },
  { name: "/api/reports/discounts", fn: () => ReportsService.getDiscountsReport({ startDate, endDate, propertyId }, { limit: 25 }) },
  { name: "/api/reports/availability-grid", fn: () => ReportsService.getAvailabilityGrid(startDate, undefined, propertyId, undefined, { limit: 25 }) },
];

async function measureAtDelay(delayMs) {
  process.env.SIMULATE_DB_LATENCY_MS = String(delayMs);
  const results = {};
  for (const r of reports) {
    const t0 = performance.now();
    await r.fn();
    const elapsed = Math.round(performance.now() - t0);
    results[r.name] = elapsed;
  }
  return results;
}

async function main() {
  console.log("Measuring BASELINE before optimization...");
  // Query counts for baseline:
  const baselineQueries = {
    "/api/reports/daily-operations/counts": 1,
    "/api/reports/daily-operations/list": 1,
    "/api/reports/occupancy": 2,
    "/api/reports/revenue": 6,
    "/api/reports/reservations": 1,
    "/api/reports/receivables": 2,
    "/api/reports/collections": 4,
    "/api/reports/discounts": 5,
    "/api/reports/availability-grid": 5,
  };

  const delay0 = await measureAtDelay(0);
  const delay100 = await measureAtDelay(100);
  const delay200 = await measureAtDelay(200);

  const table = reports.map(r => ({
    endpoint: r.name,
    queries: baselineQueries[r.name],
    "0ms (ms)": delay0[r.name],
    "100ms (ms)": delay100[r.name],
    "200ms (ms)": delay200[r.name],
  }));

  console.log("\n--- BASELINE (BEFORE) RESULTS ---");
  console.table(table);
}

main().catch(console.error);
