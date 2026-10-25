import { PrismaClient } from "@prisma/client";
import { ReportsService } from "../src/modules/reports/reports.service.ts";
import { getHotelTodayDate } from "../src/lib/date.ts";

const prisma = new PrismaClient({
  log: [{ emit: "event", level: "query" }],
});

let queryCount = 0;
let totalDbDurationMs = 0;

prisma.$on("query", (e) => {
  queryCount++;
  totalDbDurationMs += e.duration;
});

async function measure(name, fn) {
  queryCount = 0;
  totalDbDurationMs = 0;
  const start = performance.now();
  const res = await fn();
  const totalMs = performance.now() - start;
  return {
    name,
    queries: queryCount,
    dbMs: Math.round(totalDbDurationMs * 10) / 10,
    totalMs: Math.round(totalMs * 10) / 10,
    hasData: !!res,
  };
}

async function run() {
  const today = getHotelTodayDate();
  const [y, m] = today.split("-");
  const startDate = `${y}-${m}-01`;
  const endDate = today;
  const propertyId = "cprop366914525589ad143103";

  console.log(`Testing reports with propertyId=${propertyId}, range=${startDate} to ${endDate}...\n`);

  const results = [];

  // 1. Daily operations counts
  results.push(await measure("daily-operations/counts", () =>
    ReportsService.getDailyOperationsCounts(today, propertyId)
  ));

  // 2. Daily operations list
  results.push(await measure("daily-operations/list", () =>
    ReportsService.getDailyOperationsList({ type: "arrivals", date: today, propertyId, limit: 25 })
  ));

  // 3. Occupancy
  results.push(await measure("occupancy", () =>
    ReportsService.getOccupancyReport({ startDate, endDate, propertyId })
  ));

  // 4. Revenue
  results.push(await measure("revenue", () =>
    ReportsService.getRevenueReport({ startDate, endDate, propertyId })
  ));

  // 5. Reservations
  results.push(await measure("reservations", () =>
    ReportsService.getReservationStatusReport({ startDate, endDate, propertyId })
  ));

  // 6. Receivables
  results.push(await measure("receivables", () =>
    ReportsService.getReceivablesReport(propertyId, "all", { limit: 25 })
  ));

  // 7. Collections
  results.push(await measure("collections", () =>
    ReportsService.getShiftCollections(today, startDate, endDate, undefined, propertyId, { limit: 25 })
  ));

  // 8. Discounts
  results.push(await measure("discounts", () =>
    ReportsService.getDiscountsReport({ startDate, endDate, propertyId }, { limit: 25 })
  ));

  // 9. Availability grid
  results.push(await measure("availability-grid", () =>
    ReportsService.getAvailabilityGrid(startDate, undefined, propertyId, undefined, { limit: 25 })
  ));

  console.table(results);
  await prisma.$disconnect();
}

run().catch(console.error);
