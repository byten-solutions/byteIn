import { ReportsService } from "../src/modules/reports/reports.service.ts";
import { getHotelTodayDate } from "../src/lib/date.ts";
import { requestMetricsStorage } from "../src/lib/server-timing.ts";

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

const baseline = {
  "/api/reports/daily-operations/counts": { queries: 1, ms0: 801, ms100: 409, ms200: 400 },
  "/api/reports/daily-operations/list": { queries: 1, ms0: 222, ms100: 129, ms200: 309 },
  "/api/reports/occupancy": { queries: 2, ms0: 200, ms100: 516, ms200: 850 },
  "/api/reports/revenue": { queries: 6, ms0: 1148, ms100: 954, ms200: 1712 },
  "/api/reports/reservations": { queries: 1, ms0: 336, ms100: 153, ms200: 338 },
  "/api/reports/receivables": { queries: 2, ms0: 468, ms100: 312, ms200: 739 },
  "/api/reports/collections": { queries: 4, ms0: 88, ms100: 478, ms200: 882 },
  "/api/reports/discounts": { queries: 5, ms0: 1021, ms100: 673, ms200: 1234 },
  "/api/reports/availability-grid": { queries: 5, ms0: 71, ms100: 438, ms200: 840 },
};

async function measureAtDelay(delayMs) {
  process.env.SIMULATE_DB_LATENCY_MS = String(delayMs);
  const results = {};
  for (const r of reports) {
    const metrics = { queryCount: 0, dbMs: 0 };
    const t0 = performance.now();
    await requestMetricsStorage.run(metrics, async () => {
      await r.fn();
    });
    const elapsed = Math.round(performance.now() - t0);
    results[r.name] = { elapsed, queryCount: metrics.queryCount };
  }
  return results;
}

async function main() {
  console.log("Measuring AFTER optimization across 0ms, 100ms, and 200ms simulated DB latency...\n");

  // Warmup run
  process.env.SIMULATE_DB_LATENCY_MS = "0";
  for (const r of reports) {
    await r.fn();
  }

  const delay0 = await measureAtDelay(0);
  const delay100 = await measureAtDelay(100);
  const delay200 = await measureAtDelay(200);

  console.log("| Report Endpoint | Queries Before | Queries After | 100ms Latency Before | 100ms Latency After | Speedup (at 100ms) |");
  console.log("| :--- | :---: | :---: | :---: | :---: | :---: |");

  for (const r of reports) {
    const b = baseline[r.name];
    const qAfter = delay0[r.name].queryCount;
    const a100 = delay100[r.name].elapsed;
    const speedup = (b.ms100 / a100).toFixed(1) + "x";
    console.log(`| \`${r.name}\` | ${b.queries} | ${qAfter} | ${b.ms100} ms | ${a100} ms | **${speedup}** |`);
  }

  console.log("\nFull After Measurements:");
  console.table(reports.map(r => ({
    endpoint: r.name,
    queries: delay0[r.name].queryCount,
    "0ms (ms)": delay0[r.name].elapsed,
    "100ms (ms)": delay100[r.name].elapsed,
    "200ms (ms)": delay200[r.name].elapsed,
  })));
}

main().catch(console.error);
