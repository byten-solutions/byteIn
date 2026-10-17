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
import { CheckInOutService } from "../src/modules/check-in-out/check-in-out.service"

describe("PMS Financial Reports Tests (Shift Collections & Receivables Aging)", () => {
  let testStaffUser1Id: string
  let testStaffUser2Id: string
  let testPropertyId: string
  let testBuildingId: string
  let testFloorId: string
  let testCategoryId: string
  let room601Id: string
  let room602Id: string
  let customer1Id: string
  let customer2Id: string

  const todayIso = new Date().toISOString().split("T")[0]!

  before(async () => {
    // 1. Two Staff Users for shift comparison
    const staffRole = await prisma.role.findFirst({
      where: { name: RoleName.RECEPTIONIST },
    })

    const staff1 = await prisma.user.create({
      data: {
        name: "Morning Shift Receptionist",
        email: `shift1.${Date.now()}@byteinn.test`,
        passwordHash: "hash-not-used",
        roleId: staffRole!.id,
      },
    })
    testStaffUser1Id = staff1.id

    const staff2 = await prisma.user.create({
      data: {
        name: "Evening Shift Receptionist",
        email: `shift2.${Date.now()}@byteinn.test`,
        passwordHash: "hash-not-used",
        roleId: staffRole!.id,
      },
    })
    testStaffUser2Id = staff2.id

    // 2. Property & Rooms
    const property = await prisma.property.create({
      data: {
        name: "Finance Test Resort",
        city: "Delhi",
        status: "ACTIVE",
      },
    })
    testPropertyId = property.id

    const building = await prisma.building.create({
      data: {
        propertyId: testPropertyId,
        name: "Wing F",
      },
    })
    testBuildingId = building.id

    const floor = await prisma.floor.create({
      data: {
        buildingId: testBuildingId,
        floorNo: 6,
        name: "Floor 6",
      },
    })
    testFloorId = floor.id

    const category = await prisma.roomCategory.create({
      data: {
        propertyId: testPropertyId,
        name: "Executive Suite",
        basePrice: new Prisma.Decimal("400.00"),
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
        roomNo: `F601-${Date.now().toString().slice(-3)}`,
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    })
    room601Id = r1.id

    const r2 = await prisma.room.create({
      data: {
        propertyId: testPropertyId,
        buildingId: testBuildingId,
        floorId: testFloorId,
        roomCategoryId: testCategoryId,
        roomNo: `F602-${Date.now().toString().slice(-3)}`,
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    })
    room602Id = r2.id

    // 3. Customers
    const c1 = await prisma.customer.create({
      data: {
        firstName: "Meera",
        lastName: "Nair",
        phone: "+91-9988776655",
        email: `meera.${Date.now()}@byteinn.test`,
      },
    })
    customer1Id = c1.id

    const c2 = await prisma.customer.create({
      data: {
        firstName: "Vikram",
        lastName: "Patel",
        phone: "+91-9876541230",
        email: `vikram.${Date.now()}@byteinn.test`,
      },
    })
    customer2Id = c2.id

    // 4. Case 1: In-House Guest (Room 601, 2 nights @ $400 = $800)
    // Recorded $300 payment (CASH) by Staff 1 -> Balance Due: $500
    const res1 = await ReservationService.createReservation(
      {
        customerId: customer1Id,
        allocations: [
          {
            roomId: room601Id,
            arrivalDate: todayIso,
            departureDate: "2026-12-20",
          },
        ],
        autoCreateInvoice: true,
      },
      testStaffUser1Id
    )
    const inv1 = await BillingService.getInvoiceByReservationId(res1.id)
    await BillingService.recordPayment(
      inv1!.id,
      {
        amount: 300,
        paymentMethod: "CASH",
        referenceNumber: "CASH-REC-01",
      },
      testStaffUser1Id
    )

    // Check-in guest 1
    const alloc1 = await prisma.reservationRoom.findFirst({
      where: { reservationId: res1.id },
    })
    await prisma.reservationRoom.update({
      where: { id: alloc1!.id },
      data: { status: AllocationStatus.CHECKED_IN },
    })

    // 5. Case 2: Departed Guest (Room 602, 1 night @ $400)
    // Recorded $150 payment (UPI) by Staff 2 -> Checked out with pending balance: $250
    const yesterdayDate = new Date(Date.now() - 86400000)
    const yesterdayIso = yesterdayDate.toISOString().slice(0, 10)
    const res2 = await ReservationService.createReservation(
      {
        customerId: customer2Id,
        allocations: [
          {
            roomId: room602Id,
            arrivalDate: yesterdayIso,
            departureDate: todayIso,
          },
        ],
        autoCreateInvoice: true,
      },
      testStaffUser2Id
    )
    const inv2 = await BillingService.getInvoiceByReservationId(res2.id)
    await BillingService.recordPayment(
      inv2!.id,
      {
        amount: 150,
        paymentMethod: "UPI",
        referenceNumber: "UPI-REC-02",
      },
      testStaffUser2Id
    )

    const alloc2 = await prisma.reservationRoom.findFirst({
      where: { reservationId: res2.id },
    })
    // Check in and check out
    await prisma.reservationRoom.update({
      where: { id: alloc2!.id },
      data: {
        status: AllocationStatus.CHECKED_IN,
        checkedInAt: yesterdayDate,
      },
    })
    await CheckInOutService.checkOut(
      { allocationId: alloc2!.id, notes: "Guest departed with pending balance" },
      testStaffUser2Id
    )
  })

  after(async () => {
    await prisma.payment.deleteMany({
      where: { createdBy: { in: [testStaffUser1Id, testStaffUser2Id] } },
    })
    await prisma.invoiceItem.deleteMany({
      where: {
        invoice: {
          reservation: { createdBy: { in: [testStaffUser1Id, testStaffUser2Id] } },
        },
      },
    })
    await prisma.invoice.deleteMany({
      where: {
        reservation: { createdBy: { in: [testStaffUser1Id, testStaffUser2Id] } },
      },
    })
    await prisma.reservationRoom.deleteMany({
      where: { roomId: { in: [room601Id, room602Id] } },
    })
    await prisma.reservation.deleteMany({
      where: { createdBy: { in: [testStaffUser1Id, testStaffUser2Id] } },
    })
    await prisma.customer.deleteMany({
      where: { id: { in: [customer1Id, customer2Id] } },
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
      where: { id: { in: [testStaffUser1Id, testStaffUser2Id] } },
    })
  })

  it("should generate shift collections report grouped by payment method and staff user", async () => {
    const report = await ReportsService.getShiftCollections(
      todayIso,
      undefined,
      undefined,
      undefined,
      testPropertyId
    )
    assert.ok(report)

    // Total collected: $300 (CASH) + $150 (UPI) = $450.00
    assert.equal(report.totalCollected, "450.00")
    assert.equal(report.totalTransactions, 2)

    // Method breakdown
    const cashMethod = report.methodBreakdown.find((m) => m.method === "CASH")
    assert.ok(cashMethod)
    assert.equal(cashMethod.amount, "300.00")

    const upiMethod = report.methodBreakdown.find((m) => m.method === "UPI")
    assert.ok(upiMethod)
    assert.equal(upiMethod.amount, "150.00")

    // Staff breakdown
    const staff1Entry = report.staffBreakdown.find((s) => s.userId === testStaffUser1Id)
    assert.ok(staff1Entry)
    assert.equal(staff1Entry.totalCollected, "300.00")
    assert.equal(staff1Entry.methods["CASH"], "300.00")

    const staff2Entry = report.staffBreakdown.find((s) => s.userId === testStaffUser2Id)
    assert.ok(staff2Entry)
    assert.equal(staff2Entry.totalCollected, "150.00")
    assert.equal(staff2Entry.methods["UPI"], "150.00")
  })

  it("should generate receivables report clearly distinguishing in-house guests from departed debtors", async () => {
    const report = await ReportsService.getReceivablesReport(testPropertyId, "all")
    assert.ok(report)

    // In-House receivable: Guest 1 in Room 601
    const inHouseRec = report.items.find((i) => i.customerId === customer1Id)
    assert.ok(inHouseRec)
    assert.equal(inHouseRec.isGuestInHouse, true)
    assert.equal(inHouseRec.agingBucket, "0-7")

    // Departed debtor: Guest 2 in Room 602
    const departedRec = report.items.find((i) => i.customerId === customer2Id)
    assert.ok(departedRec)
    assert.equal(departedRec.isGuestInHouse, false)
    assert.equal(departedRec.agingBucket, "0-7")

    // Verify filter by departed
    const departedOnlyReport = await ReportsService.getReceivablesReport(testPropertyId, "departed")
    assert.ok(departedOnlyReport.items.every((i) => !i.isGuestInHouse))
    assert.ok(departedOnlyReport.items.some((i) => i.customerId === customer2Id))
    assert.ok(!departedOnlyReport.items.some((i) => i.customerId === customer1Id))
  })
})
