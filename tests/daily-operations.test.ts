import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { prisma } from "../src/lib/prisma"
import {
  RoleName,
  RoomStatus,
  AllocationStatus,
  Prisma,
} from "@prisma/client"
import { ReportsService } from "../src/modules/reports/reports.service"
import { ReservationService } from "../src/modules/reservations/reservation.service"
import { BillingService } from "../src/modules/billing/billing.service"

describe("PMS Daily Operations Report Tests (Arrivals, Departures, In-House, Overdue)", () => {
  let testStaffUserId: string
  let testPropertyId: string
  let testBuildingId: string
  let testFloorId: string
  let testCategoryId: string
  let room501Id: string
  let room502Id: string
  let testCustomerId: string

  const todayIso = new Date().toISOString().split("T")[0]!
  const yesterdayObj = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const yesterdayIso = yesterdayObj.toISOString().split("T")[0]!
  const tomorrowObj = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const tomorrowIso = tomorrowObj.toISOString().split("T")[0]!
  const twoDaysAgoObj = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const twoDaysAgoIso = twoDaysAgoObj.toISOString().split("T")[0]!


  before(async () => {
    // 1. Staff User
    const staffRole = await prisma.role.findFirst({
      where: { name: RoleName.RECEPTIONIST },
    })
    const staffUser = await prisma.user.create({
      data: {
        name: "Ops Test Staff",
        email: `ops.staff.${Date.now()}@byteinn.test`,
        passwordHash: "hash-not-used-in-tests",
        roleId: staffRole!.id,
      },
    })
    testStaffUserId = staffUser.id

    // 2. Property & Structure
    const property = await prisma.property.create({
      data: {
        name: "Ops Test Grand Hotel",
        city: "Bangalore",
        status: "ACTIVE",
      },
    })
    testPropertyId = property.id

    const building = await prisma.building.create({
      data: {
        propertyId: testPropertyId,
        name: "Ops Tower",
      },
    })
    testBuildingId = building.id

    const floor = await prisma.floor.create({
      data: {
        buildingId: testBuildingId,
        floorNo: 5,
        name: "Floor 5",
      },
    })
    testFloorId = floor.id

    const category = await prisma.roomCategory.create({
      data: {
        propertyId: testPropertyId,
        name: "Ops Suite",
        basePrice: new Prisma.Decimal("300.00"),
        maxOccupancy: 2,
      },
    })
    testCategoryId = category.id

    const r1 = await prisma.room.create({
      data: {
        propertyId: testPropertyId,
        buildingId: testBuildingId,
        floorId: testFloorId,
        roomCategoryId: testCategoryId,
        roomNo: `R501-${Date.now().toString().slice(-3)}`,
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    })
    room501Id = r1.id

    const r2 = await prisma.room.create({
      data: {
        propertyId: testPropertyId,
        buildingId: testBuildingId,
        floorId: testFloorId,
        roomCategoryId: testCategoryId,
        roomNo: `R502-${Date.now().toString().slice(-3)}`,
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    })
    room502Id = r2.id

    // 3. Customer
    const customer = await prisma.customer.create({
      data: {
        firstName: "Aarav",
        lastName: "Sharma",
        phone: "+91-9876500001",
        email: `aarav.${Date.now()}@byteinn.test`,
      },
    })
    testCustomerId = customer.id

    // 4. Scenario A: Expected Arrival today (Room 501, today to tomorrow) -> Unpaid balance $300
    await ReservationService.createReservation(
      {
        customerId: testCustomerId,
        allocations: [
          {
            roomId: room501Id,
            arrivalDate: todayIso,
            departureDate: tomorrowIso,
          },
        ],
        autoCreateInvoice: true,
      },
      testStaffUserId
    )

    // 5. Scenario B: Expected Departure today (Room 502, yesterday to today) -> Checked In, Departure today!
    const resB = await ReservationService.createReservation(
      {
        customerId: testCustomerId,
        allocations: [
          {
            roomId: room502Id,
            arrivalDate: yesterdayIso,
            departureDate: todayIso,
          },
        ],
        autoCreateInvoice: true,
      },
      testStaffUserId
    )
    const allocB = await prisma.reservationRoom.findFirst({
      where: { reservationId: resB.id },
    })
    await prisma.reservationRoom.update({
      where: { id: allocB!.id },
      data: { status: AllocationStatus.CHECKED_IN },
    })
    await prisma.room.update({
      where: { id: room502Id },
      data: { status: RoomStatus.OCCUPIED },
    })

    // Record partial payment on B's invoice
    const invB = await BillingService.getInvoiceByReservationId(resB.id)
    await BillingService.recordPayment(
      invB!.id,
      {
        amount: 100,
        paymentMethod: "CASH",
        referenceNumber: "CASH-OPS-01",
      },
      testStaffUserId
    )

    // 6. Scenario C: Overdue Check-In / No-show (arrival 2 days ago, still CONFIRMED)
    await ReservationService.createReservation(
      {
        customerId: testCustomerId,
        allocations: [
          {
            roomId: room501Id,
            arrivalDate: twoDaysAgoIso,
            departureDate: yesterdayIso,
          },
        ],
        autoCreateInvoice: false,
      },
      testStaffUserId
    )
  })

  after(async () => {
    // Cleanup in reverse foreign key order
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
        roomId: { in: [room501Id, room502Id] },
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

  it("should retrieve today's expected arrivals with customer details and outstanding balance", async () => {
    const report = await ReportsService.getDailyOperations(todayIso, testPropertyId)
    assert.ok(report)

    assert.ok(report.summary.expectedArrivalsCount >= 1)
    const arrival = report.arrivals.find((a) => a.roomId === room501Id)
    assert.ok(arrival, "Room 501 must be in expected arrivals")
    assert.equal(arrival.guestName, "Aarav Sharma")
    assert.equal(arrival.guestPhone, "+91-9876500001")
    assert.equal(arrival.arrivalDate, todayIso)
    assert.equal(arrival.departureDate, tomorrowIso)
    assert.equal(arrival.allocationStatus, AllocationStatus.CONFIRMED)
    assert.ok(arrival.invoiceNumber)
    assert.equal(arrival.invoiceBalanceDue, "300.00")
  })

  it("should retrieve today's expected departures with remaining balance due", async () => {
    const report = await ReportsService.getDailyOperations(todayIso, testPropertyId)
    assert.ok(report)

    assert.ok(report.summary.expectedDeparturesCount >= 1)
    const departure = report.departures.find((d) => d.roomId === room502Id)
    assert.ok(departure, "Room 502 must be in expected departures")
    assert.equal(departure.allocationStatus, AllocationStatus.CHECKED_IN)
    assert.equal(departure.departureDate, todayIso)
    // 1 night @ $300 - $100 paid = $200 remaining balance
    assert.equal(departure.invoiceBalanceDue, "200.00")
  })

  it("should flag overdue check-ins that were scheduled for prior dates but never checked in", async () => {
    const report = await ReportsService.getDailyOperations(todayIso, testPropertyId)
    assert.ok(report)

    assert.ok(report.summary.pendingArrivalsCount >= 1)
    const overdue = report.pendingArrivals.find((p) => p.arrivalDate === twoDaysAgoIso)
    assert.ok(overdue, "Past due allocation must appear in pending arrivals")
    assert.equal(overdue.allocationStatus, AllocationStatus.CONFIRMED)
  })
})
