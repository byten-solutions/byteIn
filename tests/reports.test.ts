import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { prisma } from "../src/lib/prisma"
import {
  RoleName,
  RoomStatus,
  AllocationStatus,
  ReservationStatus,
  Prisma,
} from "@prisma/client"
import { ReportsService } from "../src/modules/reports/reports.service"
import { reportDateRangeSchema } from "../src/modules/reports/reports.validation"
import { ReservationService } from "../src/modules/reservations/reservation.service"
import { BillingService } from "../src/modules/billing/billing.service"
import { enforceRole } from "../src/lib/auth-guard"
import type { SessionPayload } from "../src/modules/auth/auth.types"

describe("Phase 7: Operational & Financial Reporting Tests", () => {
  let testStaffUserId: string
  let testPropertyId: string
  let testBuildingId: string
  let testFloorId: string
  let testCategoryId: string
  let room401Id: string
  let room402Id: string
  let testCustomerId: string

  let invoice1Id: string

  const adminSession: SessionPayload = {
    sub: "admin-user-id",
    role: RoleName.ADMIN,
    name: "Admin User",
    email: "admin@test.com",
  }

  const receptionistSession: SessionPayload = {
    sub: "reception-user-id",
    role: RoleName.RECEPTIONIST,
    name: "Receptionist User",
    email: "reception@test.com",
  }

  before(async () => {
    // 1. Create Staff User
    const staffRole = await prisma.role.findFirst({
      where: { name: RoleName.RECEPTIONIST },
    })
    const staffUser = await prisma.user.create({
      data: {
        name: "Reports Test Staff",
        email: `staff.reports.${Date.now()}@byteinn.test`,
        passwordHash: "hash-not-used-in-direct-service-test",
        roleId: staffRole!.id,
      },
    })
    testStaffUserId = staffUser.id

    // 2. Create Property, Building, Floor
    const property = await prisma.property.create({
      data: {
        name: "Reports Test Grand Hotel",
        address: "456 Analytics Blvd",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        status: "ACTIVE",
      },
    })
    testPropertyId = property.id

    const building = await prisma.building.create({
      data: {
        propertyId: testPropertyId,
        name: "Tower R",
      },
    })
    testBuildingId = building.id

    const floor = await prisma.floor.create({
      data: {
        buildingId: testBuildingId,
        floorNo: 4,
        name: "Floor 4",
      },
    })
    testFloorId = floor.id

    // 3. Create Room Category ($200.00 base rate)
    const category = await prisma.roomCategory.create({
      data: {
        propertyId: testPropertyId,
        name: "Reports Suite",
        basePrice: new Prisma.Decimal("200.00"),
        maxOccupancy: 2,
      },
    })
    testCategoryId = category.id

    // 4. Create Two Physical Rooms
    const r1 = await prisma.room.create({
      data: {
        propertyId: testPropertyId,
        buildingId: testBuildingId,
        floorId: testFloorId,
        roomCategoryId: testCategoryId,
        roomNo: `R401-${Date.now().toString().slice(-3)}`,
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    })
    room401Id = r1.id

    const r2 = await prisma.room.create({
      data: {
        propertyId: testPropertyId,
        buildingId: testBuildingId,
        floorId: testFloorId,
        roomCategoryId: testCategoryId,
        roomNo: `R402-${Date.now().toString().slice(-3)}`,
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    })
    room402Id = r2.id

    // 5. Create Customer
    const customer = await prisma.customer.create({
      data: {
        firstName: "Report",
        lastName: "Guest",
        phone: "+91-9876543210",
        email: `guest.reports.${Date.now()}@byteinn.test`,
      },
    })
    testCustomerId = customer.id

    // 6. Reservation 1: 3 nights in Room 401 (Nov 1 to Nov 4, 2026) -> $600
    const res1 = await ReservationService.createReservation(
      {
        customerId: testCustomerId,
        allocations: [
          {
            roomId: room401Id,
            arrivalDate: "2026-11-01",
            departureDate: "2026-11-04", // 3 nights @ $200 = $600
          },
        ],
        autoCreateInvoice: true,
      },
      testStaffUserId
    )

    const inv1 = await BillingService.getInvoiceByReservationId(res1.id)
    assert.ok(inv1)
    invoice1Id = inv1.id

    // Record partial payment of $250.00 on invoice 1 (UPI)
    await BillingService.recordPayment(
      invoice1Id,
      {
        amount: 250,
        paymentMethod: "UPI",
        referenceNumber: "UPI-RPT-001",
      },
      testStaffUserId
    )

    // Add extra charge of $50.00 on invoice 1 -> total becomes $650, balance $400
    await BillingService.addInvoiceItem(
      invoice1Id,
      {
        description: "Minibar Snacks",
        quantity: 1,
        unitPrice: 50,
        itemType: "EXTRA_CHARGE",
      },
      testStaffUserId
    )

    // 7. Reservation 2: 2 nights in Room 402 (Nov 2 to Nov 4, 2026) -> $400
    const res2 = await ReservationService.createReservation(
      {
        customerId: testCustomerId,
        allocations: [
          {
            roomId: room402Id,
            arrivalDate: "2026-11-02",
            departureDate: "2026-11-04", // 2 nights @ $200 = $400
          },
        ],
        autoCreateInvoice: true,
      },
      testStaffUserId
    )

    const inv2 = await BillingService.getInvoiceByReservationId(res2.id)
    assert.ok(inv2)

    // Record full payment of $400.00 on invoice 2 (Card)
    await BillingService.recordPayment(
      inv2.id,
      {
        amount: 400,
        paymentMethod: "CARD",
        referenceNumber: "CARD-RPT-002",
      },
      testStaffUserId
    )

    // 8. Reservation 3: CANCELLED reservation (Nov 1 to Nov 3) -> should not count towards occupancy!
    const res3 = await ReservationService.createReservation(
      {
        customerId: testCustomerId,
        allocations: [
          {
            roomId: room402Id,
            arrivalDate: "2026-11-05",
            departureDate: "2026-11-07",
          },
        ],
        autoCreateInvoice: false,
      },
      testStaffUserId
    )

    await prisma.reservation.update({
      where: { id: res3.id },
      data: { status: ReservationStatus.CANCELLED },
    })
    await prisma.reservationRoom.updateMany({
      where: { reservationId: res3.id },
      data: { status: AllocationStatus.CANCELLED },
    })
  })

  after(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({
      where: {
        userId: testStaffUserId,
      },
    })

    await prisma.payment.deleteMany({
      where: { createdBy: testStaffUserId },
    })

    await prisma.invoiceItem.deleteMany({
      where: {
        invoice: {
          reservation: { createdBy: testStaffUserId },
        },
      },
    })

    await prisma.invoice.deleteMany({
      where: {
        reservation: { createdBy: testStaffUserId },
      },
    })

    await prisma.reservationRoom.deleteMany({
      where: {
        roomId: { in: [room401Id, room402Id] },
      },
    })

    await prisma.reservation.deleteMany({
      where: { createdBy: testStaffUserId },
    })

    await prisma.customer.deleteMany({
      where: { id: testCustomerId },
    })

    await prisma.room.deleteMany({
      where: { propertyId: testPropertyId },
    })

    await prisma.roomCategory.deleteMany({
      where: { id: testCategoryId },
    })

    await prisma.floor.deleteMany({
      where: { id: testFloorId },
    })

    await prisma.building.deleteMany({
      where: { id: testBuildingId },
    })

    await prisma.property.deleteMany({
      where: { id: testPropertyId },
    })

    await prisma.user.deleteMany({
      where: { id: testStaffUserId },
    })
  })

  describe("1. Query Validation for Reports (reportDateRangeSchema)", () => {
    it("should accept valid ISO date range YYYY-MM-DD", () => {
      const parsed = reportDateRangeSchema.parse({
        startDate: "2026-11-01",
        endDate: "2026-11-07",
      })
      assert.equal(parsed.startDate, "2026-11-01")
      assert.equal(parsed.endDate, "2026-11-07")
    })

    it("should reject malformed or non-calendar date strings", () => {
      assert.throws(
        () => {
          reportDateRangeSchema.parse({
            startDate: "2026-02-30", // Feb 30 does not exist
            endDate: "2026-11-07",
          })
        },
        /must be a valid calendar date/
      )
    })

    it("should reject reversed date range where endDate is before startDate", () => {
      assert.throws(
        () => {
          reportDateRangeSchema.parse({
            startDate: "2026-11-10",
            endDate: "2026-11-05",
          })
        },
        /endDate must be on or after startDate/
      )
    })

    it("should reject date ranges exceeding 366 days", () => {
      assert.throws(
        () => {
          reportDateRangeSchema.parse({
            startDate: "2025-01-01",
            endDate: "2026-06-01", // > 500 days
          })
        },
        /Date range cannot exceed 366 days/
      )
    })
  })

  describe("2. Historical Occupancy Report (REP-004)", () => {
    it("should accurately calculate occupied room nights across half-open intervals", async () => {
      // Date range: 2026-11-01 to 2026-11-04 (4 calendar dates: Nov 1, Nov 2, Nov 3, Nov 4)
      // Room 401 is booked Nov 1 to Nov 4 -> occupied nights: Nov 1, Nov 2, Nov 3 = 3 nights
      // Room 402 is booked Nov 2 to Nov 4 -> occupied nights: Nov 2, Nov 3 = 2 nights
      // Nov 4 is departure day for both, so neither is occupied on the night of Nov 4!
      // Total occupied nights = 3 + 2 = 5 nights
      const report = await ReportsService.getOccupancyReport({
        startDate: "2026-11-01",
        endDate: "2026-11-04",
        propertyId: testPropertyId,
      })

      assert.equal(report.startDate, "2026-11-01")
      assert.equal(report.endDate, "2026-11-04")
      assert.equal(report.totalDays, 4)
      assert.equal(report.totalRooms, 2)
      assert.equal(report.totalOccupiedRoomNights, 5) // 3 + 2 = 5 nights

      // Occupancy Rate = 5 / 8 * 100 = 62.5%
      assert.equal(report.occupancyRate, 62.5)
      assert.equal(report.totalRoomRevenue, "1000.00")
      assert.equal(report.adr, "200.00") // $1000 / 5 occupied nights = $200
      assert.equal(report.revpar, "125.00") // $1000 / 8 available nights = $125

      // Category breakdown
      assert.ok(report.categoryBreakdown.length >= 1)
      const cat = report.categoryBreakdown.find((c) => c.categoryId === testCategoryId)
      assert.ok(cat)
      assert.equal(cat.categoryName, "Reports Suite")
      assert.equal(cat.occupiedRoomNights, 5)
      assert.equal(cat.roomRevenue, "1000.00")
      assert.equal(cat.adr, "200.00")
      assert.equal(cat.revpar, "125.00")

      assert.equal(report.dailyBreakdown.length, 4)

      // Nov 1: Room 401 occupied (1/2 = 50%)
      const nov1 = report.dailyBreakdown.find((d) => d.date === "2026-11-01")
      assert.ok(nov1)
      assert.equal(nov1.occupiedRooms, 1)
      assert.equal(nov1.availableRooms, 1)
      assert.equal(nov1.occupancyRate, 50.0)

      // Nov 2: Both 401 and 402 occupied (2/2 = 100%)
      const nov2 = report.dailyBreakdown.find((d) => d.date === "2026-11-02")
      assert.ok(nov2)
      assert.equal(nov2.occupiedRooms, 2)
      assert.equal(nov2.availableRooms, 0)
      assert.equal(nov2.occupancyRate, 100.0)

      // Nov 4: Both checked out, 0 occupied (0/2 = 0%)
      const nov4 = report.dailyBreakdown.find((d) => d.date === "2026-11-04")
      assert.ok(nov4)
      assert.equal(nov4.occupiedRooms, 0)
      assert.equal(nov4.occupancyRate, 0.0)
    })

    it("should strictly exclude cancelled allocations from occupied room counts", async () => {
      // Date range: 2026-11-05 to 2026-11-07
      // res3 was cancelled; it must NOT count as occupied!
      const report = await ReportsService.getOccupancyReport({
        startDate: "2026-11-05",
        endDate: "2026-11-07",
        propertyId: testPropertyId,
      })

      assert.equal(report.totalOccupiedRoomNights, 0)
      assert.equal(report.occupancyRate, 0.0)
    })

    it("should safely handle zero-inventory or empty property queries without division-by-zero errors", async () => {
      const report = await ReportsService.getOccupancyReport({
        startDate: "2026-11-01",
        endDate: "2026-11-03",
        propertyId: "non-existent-property-id",
      })

      assert.equal(report.totalRooms, 0)
      assert.equal(report.totalAvailableRoomNights, 0)
      assert.equal(report.totalOccupiedRoomNights, 0)
      assert.equal(report.occupancyRate, 0.0)
    })
  })

  describe("3. Revenue versus Collections Report (REP-005)", () => {
    it("should distinguish invoiced revenue from collections recorded", async () => {
      // Date range covers today (when tests created invoices and payments)
      const todayIso = new Date().toISOString().split("T")[0]
      const report = await ReportsService.getRevenueReport({
        startDate: todayIso,
        endDate: todayIso,
        propertyId: testPropertyId,
      })

      assert.ok(report)
      // Invoice 1: $600 room + $50 minibar = $650
      // Invoice 2: $400 room = $400
      // Total Invoiced = $1050.00
      assert.equal(report.totalInvoiced, "1050.00")
      assert.equal(report.roomChargesTotal, "1000.00")
      assert.equal(report.extraChargesTotal, "50.00")

      // Payments recorded:
      // $250.00 (UPI) + $400.00 (Card) = $650.00
      assert.equal(report.totalCollected, "650.00")

      // Outstanding balance:
      // Invoice 1 has $400 unpaid balance ($650 - $250)
      // Invoice 2 has $0 unpaid balance ($400 - $400)
      // Total Outstanding = $400.00
      assert.equal(report.totalOutstanding, "400.00")

      // Verify Payment Method Breakdown
      assert.equal(report.paymentMethodBreakdown.length, 2)
      const cardPm = report.paymentMethodBreakdown.find((p) => p.method === "CARD")
      assert.ok(cardPm)
      assert.equal(cardPm.amount, "400.00")
      assert.equal(cardPm.count, 1)

      const upiPm = report.paymentMethodBreakdown.find((p) => p.method === "UPI")
      assert.ok(upiPm)
      assert.equal(upiPm.amount, "250.00")
      assert.equal(upiPm.count, 1)

      // Verify Charge Type Breakdown
      assert.ok(report.chargeTypeBreakdown.length >= 2)
      const roomCharge = report.chargeTypeBreakdown.find((c) => c.itemType === "ROOM_CHARGE")
      assert.ok(roomCharge)
      assert.equal(roomCharge.amount, "1000.00")

      const extraCharge = report.chargeTypeBreakdown.find((c) => c.itemType === "EXTRA_CHARGE")
      assert.ok(extraCharge)
      assert.equal(extraCharge.amount, "50.00")
    })

    it("should exclude voided payments from collected totals", async () => {
      // Record a dummy payment and void it
      const { receipt } = await BillingService.recordPayment(
        invoice1Id,
        {
          amount: 50,
          paymentMethod: "CASH",
          referenceNumber: "CASH-TO-VOID",
        },
        testStaffUserId
      )

      await BillingService.voidPayment(receipt.paymentId, testStaffUserId)

      const todayIso = new Date().toISOString().split("T")[0]
      const report = await ReportsService.getRevenueReport({
        startDate: todayIso,
        endDate: todayIso,
        propertyId: testPropertyId,
      })

      // The voided $50 payment must NOT increase totalCollected!
      assert.equal(report.totalCollected, "650.00")
    })
  })

  describe("4. Reservation Status Breakdown Report (REP-006)", () => {
    it("should accurately group reservations by status and calculate metrics", async () => {
      const todayIso = new Date().toISOString().split("T")[0]
      const report = await ReportsService.getReservationStatusReport({
        startDate: todayIso,
        endDate: todayIso,
        propertyId: testPropertyId,
      })

      assert.ok(report)
      // 3 reservations created for this property: 2 CONFIRMED, 1 CANCELLED
      assert.equal(report.totalReservations, 3)
      assert.equal(report.totalAllocations, 3)

      // Total stay nights: 3 (res1) + 2 (res2) + 2 (res3) = 7 nights
      assert.equal(report.totalStayNights, 7)

      // Cancellation Rate = 1 / 3 * 100 = 33.3%
      assert.equal(report.cancellationRate, 33.3)

      const cancelledGroup = report.statusBreakdown.find(
        (s) => s.status === ReservationStatus.CANCELLED
      )
      assert.ok(cancelledGroup)
      assert.equal(cancelledGroup.count, 1)

      const confirmedGroup = report.statusBreakdown.find(
        (s) => s.status === ReservationStatus.CONFIRMED
      )
      assert.ok(confirmedGroup)
      assert.equal(confirmedGroup.count, 2)
    })
  })

  describe("5. Role Authorization & Access Control", () => {
    it("should permit RECEPTIONIST role for report access", () => {
      const permitted = enforceRole(receptionistSession, [
        RoleName.ADMIN,
        RoleName.RECEPTIONIST,
      ])
      assert.equal(permitted.role, RoleName.RECEPTIONIST)
    })

    it("should permit ADMIN role for report access", () => {
      const permitted = enforceRole(adminSession, [
        RoleName.ADMIN,
        RoleName.RECEPTIONIST,
      ])
      assert.equal(permitted.role, RoleName.ADMIN)
    })

    it("should reject unauthenticated requests with AuthError(401)", () => {
      assert.throws(
        () => {
          enforceRole(null, [RoleName.ADMIN, RoleName.RECEPTIONIST])
        },
        /Authentication required/
      )
    })
  })
})
