import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BillingService } from "../src/modules/billing/billing.service";
import { ReservationService } from "../src/modules/reservations/reservation.service";
import { CustomerService } from "../src/modules/customers/customer.service";

describe("Phase 3: Performance Cache & Scoped Queries Tests", () => {
  it("BillingService.getBillingSummary() returns valid aggregate numbers", async () => {
    const summary = await BillingService.getBillingSummary();
    assert.ok(typeof summary.totalInvoiced === "string");
    assert.ok(typeof summary.totalCollected === "string");
    assert.ok(typeof summary.totalOutstanding === "string");
    assert.ok(!isNaN(Number(summary.totalInvoiced)));
    assert.ok(!isNaN(Number(summary.totalCollected)));
    assert.ok(!isNaN(Number(summary.totalOutstanding)));
  });

  it("BillingService.getUnfilteredInvoiceCount() returns numeric count", async () => {
    const count = await BillingService.getUnfilteredInvoiceCount();
    assert.ok(typeof count === "number");
    assert.ok(count >= 0);
  });

  it("BillingService.invalidateBillingCache() safely executes without throwing", () => {
    assert.doesNotThrow(() => {
      BillingService.invalidateBillingCache();
    });
  });

  it("ReservationService.getUnfilteredReservationCount() returns numeric count", async () => {
    const count = await ReservationService.getUnfilteredReservationCount();
    assert.ok(typeof count === "number");
    assert.ok(count >= 0);
  });

  it("ReservationService.invalidateReservationCache() safely executes without throwing", () => {
    assert.doesNotThrow(() => {
      ReservationService.invalidateReservationCache();
    });
  });

  it("CustomerService.getCustomers() runs scoped query successfully", async () => {
    const result = await CustomerService.getCustomers({ page: 1, limit: 10 });
    assert.ok(Array.isArray(result.customers));
    assert.ok(result.pagination);
    assert.ok(typeof result.pagination.total === "number");
    if (result.customers.length > 0) {
      const first = result.customers[0];
      assert.ok(typeof first._count?.reservations === "number");
      assert.ok(Array.isArray(first.reservations));
      assert.ok(first.reservations.length <= 5);
    }
  });

  it("RoomService.getRoomsSummary() returns valid status counts and facets", async () => {
    const { RoomService } = await import("../src/modules/rooms/room.service");
    const summary = await RoomService.getRoomsSummary();
    assert.ok(typeof summary.counts.total === "number");
    assert.ok(typeof summary.counts.clean === "number");
    assert.ok(typeof summary.counts.dirty === "number");
    assert.ok(Array.isArray(summary.facets));
  });

  it("RoomService.getRoomsPage() returns paginated rooms with total count", async () => {
    const { RoomService } = await import("../src/modules/rooms/room.service");
    const pageResult = await RoomService.getRoomsPage({ page: 1, limit: 20 });
    assert.ok(Array.isArray(pageResult.rooms));
    assert.ok(pageResult.rooms.length <= 20);
    assert.ok(typeof pageResult.total === "number");
    assert.equal(pageResult.page, 1);
    assert.equal(pageResult.limit, 20);
    assert.ok(pageResult.totalPages >= 1);
  });

  it("RoomService.invalidateRoomsCache() executes safely", async () => {
    const { RoomService } = await import("../src/modules/rooms/room.service");
    assert.doesNotThrow(() => {
      RoomService.invalidateRoomsCache();
    });
  });
});

