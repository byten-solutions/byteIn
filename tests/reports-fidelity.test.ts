import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ReportsService } from "../src/modules/reports/reports.service";
import { ReportsService as ReportsServiceLegacy } from "./helpers/reports-legacy";

interface ShiftCollectionsComparable {
  methodBreakdown: Array<{ method: string }>;
  staffBreakdown: Array<{ userId: string }>;
  [key: string]: unknown;
}

async function assertFidelity<T>(
  fnOld: () => Promise<T>,
  fnNew: () => Promise<T>,
  normalize?: (v: T) => unknown
) {
  const oldRes = await fnOld();
  const newRes = await fnNew();
  const finalOld = normalize ? normalize(oldRes) : oldRes;
  const finalNew = normalize ? normalize(newRes) : newRes;
  try {
    assert.deepStrictEqual(finalNew, finalOld);
  } catch (_err) {
    // If concurrent test in test-concurrency suite wrote to the database between calls,
    // pause briefly and re-read to verify identical outputs on stable database state.
    await new Promise((r) => setTimeout(r, 100));
    const oldRetry = await fnOld();
    const newRetry = await fnNew();
    const finalOldRetry = normalize ? normalize(oldRetry) : oldRetry;
    const finalNewRetry = normalize ? normalize(newRetry) : newRetry;
    assert.deepStrictEqual(finalNewRetry, finalOldRetry);
  }
}

describe("Reports Optimization Fidelity Verification Suite (Old vs New Exact Match)", () => {
  const propertyId = "cprop366914525589ad143103";

  const dateRanges = [
    { name: "month", startDate: "2026-10-01", endDate: "2026-10-21" },
    { name: "quarter", startDate: "2026-07-01", endDate: "2026-09-30" },
    { name: "year_boundary", startDate: "2025-12-15", endDate: "2026-01-15" },
    { name: "single_day", startDate: "2026-10-15", endDate: "2026-10-15" },
    { name: "today", startDate: "2026-10-21", endDate: "2026-10-21" },
  ];

  const scopes = [
    { name: "Scoped Hotel", propertyId },
    { name: "SUPER_ADMIN (Global)", propertyId: undefined },
  ];

  for (const scope of scopes) {
    for (const range of dateRanges) {
      describe(`${scope.name} - ${range.name} (${range.startDate} to ${range.endDate})`, () => {
        it("1. getOccupancyReport matches old output field-by-field", async () => {
          await assertFidelity(
            () =>
              ReportsServiceLegacy.getOccupancyReport({
                startDate: range.startDate,
                endDate: range.endDate,
                propertyId: scope.propertyId,
              }),
            () =>
              ReportsService.getOccupancyReport({
                startDate: range.startDate,
                endDate: range.endDate,
                propertyId: scope.propertyId,
              })
          );
        });

        it("2. getRevenueReport matches old output field-by-field", async () => {
          await assertFidelity(
            () =>
              ReportsServiceLegacy.getRevenueReport({
                startDate: range.startDate,
                endDate: range.endDate,
                propertyId: scope.propertyId,
              }),
            () =>
              ReportsService.getRevenueReport({
                startDate: range.startDate,
                endDate: range.endDate,
                propertyId: scope.propertyId,
              })
          );
        });

        it("3. getReservationStatusReport matches old output field-by-field", async () => {
          await assertFidelity(
            () =>
              ReportsServiceLegacy.getReservationStatusReport({
                startDate: range.startDate,
                endDate: range.endDate,
                propertyId: scope.propertyId,
              }),
            () =>
              ReportsService.getReservationStatusReport({
                startDate: range.startDate,
                endDate: range.endDate,
                propertyId: scope.propertyId,
              })
          );
        });

        it("4. getShiftCollections matches old output field-by-field", async () => {
          const normalizeCollections = (c: unknown) => {
            const typed = c as ShiftCollectionsComparable;
            return {
              ...typed,
              methodBreakdown: [...typed.methodBreakdown].sort((a, b) =>
                a.method.localeCompare(b.method)
              ),
              staffBreakdown: [...typed.staffBreakdown].sort((a, b) =>
                a.userId.localeCompare(b.userId)
              ),
            };
          };
          await assertFidelity(
            () =>
              ReportsServiceLegacy.getShiftCollections(
                range.endDate,
                range.startDate,
                range.endDate,
                undefined,
                scope.propertyId,
                { limit: 25, page: 1 }
              ),
            () =>
              ReportsService.getShiftCollections(
                range.endDate,
                range.startDate,
                range.endDate,
                undefined,
                scope.propertyId,
                { limit: 25, page: 1 }
              ),
            normalizeCollections
          );
        });

        it("5. getDiscountsReport matches old output field-by-field", async () => {
          await assertFidelity(
            () =>
              ReportsServiceLegacy.getDiscountsReport(
                { startDate: range.startDate, endDate: range.endDate, propertyId: scope.propertyId },
                { limit: 25, page: 1 }
              ),
            () =>
              ReportsService.getDiscountsReport(
                { startDate: range.startDate, endDate: range.endDate, propertyId: scope.propertyId },
                { limit: 25, page: 1 }
              )
          );
        });
      });
    }

    // Point in time operations
    describe(`${scope.name} - Point in time operations`, () => {
      it("6. getDailyOperationsCounts matches old output field-by-field", async () => {
        await assertFidelity(
          () => ReportsServiceLegacy.getDailyOperationsCounts("2026-10-21", scope.propertyId),
          () => ReportsService.getDailyOperationsCounts("2026-10-21", scope.propertyId)
        );
      });

      it("7. getDailyOperationsList matches old output field-by-field", async () => {
        await assertFidelity(
          () =>
            ReportsServiceLegacy.getDailyOperationsList({
              type: "arrivals",
              date: "2026-10-21",
              propertyId: scope.propertyId,
              limit: 25,
            }),
          () =>
            ReportsService.getDailyOperationsList({
              type: "arrivals",
              date: "2026-10-21",
              propertyId: scope.propertyId,
              limit: 25,
            })
        );
      });

      it("8. getAvailabilityGrid matches old output field-by-field", async () => {
        await assertFidelity(
          () =>
            ReportsServiceLegacy.getAvailabilityGrid(
              "2026-10-21",
              undefined,
              scope.propertyId,
              undefined,
              { limit: 25 }
            ),
          () =>
            ReportsService.getAvailabilityGrid(
              "2026-10-21",
              undefined,
              scope.propertyId,
              undefined,
              { limit: 25 }
            )
        );
      });
    });
  }
});
