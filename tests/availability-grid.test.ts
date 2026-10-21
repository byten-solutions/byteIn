import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { prisma } from "../src/lib/prisma"
import {
  RoleName,
  RoomStatus,
  Prisma,
} from "@prisma/client"
import { ReportsService } from "../src/modules/reports/reports.service"
import { ReservationService } from "../src/modules/reservations/reservation.service"

describe("Room Availability Grid / Tape Chart Tests", () => {
  let testStaffUserId: string
  let testPropertyId: string
  let testBuildingId: string
  let testFloorId: string
  let testCategoryId: string
  let bookedRoomId: string
  let vacantRoomId: string
  let maintenanceRoomId: string
  let testCustomerId: string

  const startIso = "2026-12-01"
  const endIso = "2026-12-07" // 7 days window

  before(async () => {
    // 1. Staff User
    const staffRole = await prisma.role.findFirst({
      where: { name: RoleName.RECEPTIONIST },
    })
    const staffUser = await prisma.user.create({
      data: {
        name: "Grid Test Staff",
        email: `grid.staff.${Date.now()}@byteinn.test`,
        passwordHash: "hash-not-used",
        roleId: staffRole!.id,
      },
    })
    testStaffUserId = staffUser.id

    // 2. Property & Rooms
    const property = await prisma.property.create({
      data: {
        name: "Grid Grand Resort",
        city: "Goa",
        status: "ACTIVE",
      },
    })
    testPropertyId = property.id

    const building = await prisma.building.create({
      data: {
        propertyId: testPropertyId,
        name: "Beach Block",
      },
    })
    testBuildingId = building.id

    const floor = await prisma.floor.create({
      data: {
        buildingId: testBuildingId,
        floorNo: 1,
        name: "Ground Floor",
      },
    })
    testFloorId = floor.id

    const category = await prisma.roomCategory.create({
      data: {
        propertyId: testPropertyId,
        name: "Ocean Deluxe",
        basePrice: new Prisma.Decimal("500.00"),
        maxOccupancy: 2,
      },
    })
    testCategoryId = category.id

    // Room 1: Booked for 2026-12-02 to 2026-12-05 (3 nights)
    const r1 = await prisma.room.create({
      data: {
        propertyId: testPropertyId,
        buildingId: testBuildingId,
        floorId: testFloorId,
        roomCategoryId: testCategoryId,
        roomNo: `G101-${Date.now().toString().slice(-3)}`,
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    })
    bookedRoomId = r1.id

    // Room 2: Vacant clean throughout
    const r2 = await prisma.room.create({
      data: {
        propertyId: testPropertyId,
        buildingId: testBuildingId,
        floorId: testFloorId,
        roomCategoryId: testCategoryId,
        roomNo: `G102-${Date.now().toString().slice(-3)}`,
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    })
    vacantRoomId = r2.id

    // Room 3: Under maintenance
    const r3 = await prisma.room.create({
      data: {
        propertyId: testPropertyId,
        buildingId: testBuildingId,
        floorId: testFloorId,
        roomCategoryId: testCategoryId,
        roomNo: `G103-${Date.now().toString().slice(-3)}`,
        capacity: 2,
        status: RoomStatus.MAINTENANCE,
      },
    })
    maintenanceRoomId = r3.id

    // 3. Customer & Booking
    const customer = await prisma.customer.create({
      data: {
        firstName: "Rohan",
        lastName: "Verma",
        phone: "+91-9123456780",
        email: `rohan.${Date.now()}@byteinn.test`,
      },
    })
    testCustomerId = customer.id

    await ReservationService.createReservation(
      {
        customerId: testCustomerId,
        allocations: [
          {
            roomId: bookedRoomId,
            arrivalDate: "2026-12-02",
            departureDate: "2026-12-05", // Dec 2, 3, 4 booked; Dec 5 departs
          },
        ],
        autoCreateInvoice: false,
      },
      testStaffUserId
    )
  })

  after(async () => {
    await prisma.reservationRoom.deleteMany({
      where: { roomId: { in: [bookedRoomId, vacantRoomId, maintenanceRoomId] } },
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

  it("should generate a 7-day date-by-room tape chart with 3 physical rooms", async () => {
    const grid = await ReportsService.getAvailabilityGrid(startIso, endIso, testPropertyId)
    assert.ok(grid)
    assert.equal(grid.totalRooms, 3)
    assert.equal(grid.dates.length, 7)
    assert.equal(grid.dates[0], "2026-12-01")
    assert.equal(grid.dates[6], "2026-12-07")
  })

  it("should correctly identify booked slots vs vacant slots across stay dates", async () => {
    const grid = await ReportsService.getAvailabilityGrid(startIso, endIso, testPropertyId)
    const room1Grid = grid.rooms.find((r) => r.roomId === bookedRoomId)
    assert.ok(room1Grid)

    // Dec 1: Free (before arrival)
    const slotDec1 = room1Grid.slots.find((s) => s.date === "2026-12-01")
    assert.ok(slotDec1)
    assert.equal(slotDec1.isAvailable, true)
    assert.equal(slotDec1.isOccupied, false)

    // Dec 2: Booked (arrival date)
    const slotDec2 = room1Grid.slots.find((s) => s.date === "2026-12-02")
    assert.ok(slotDec2)
    assert.equal(slotDec2.isAvailable, false)
    assert.equal(slotDec2.isOccupied, true)
    assert.equal(slotDec2.guestName, "Rohan Verma")
    assert.equal(slotDec2.isArrivalDay, true)

    // Dec 4: Booked
    const slotDec4 = room1Grid.slots.find((s) => s.date === "2026-12-04")
    assert.ok(slotDec4)
    assert.equal(slotDec4.isAvailable, false)
    assert.equal(slotDec4.isOccupied, true)

    // Dec 5: Departure day (half-open interval, free for incoming guest at night)
    const slotDec5 = room1Grid.slots.find((s) => s.date === "2026-12-05")
    assert.ok(slotDec5)
    assert.equal(slotDec5.isAvailable, true)
    assert.equal(slotDec5.isOccupied, false)
  })

  it("should correctly identify rooms under maintenance", async () => {
    const grid = await ReportsService.getAvailabilityGrid(startIso, endIso, testPropertyId)
    const room3Grid = grid.rooms.find((r) => r.roomId === maintenanceRoomId)
    assert.ok(room3Grid)

    const slotDec1 = room3Grid.slots.find((s) => s.date === "2026-12-01")
    assert.ok(slotDec1)
    assert.equal(slotDec1.isMaintenance, true)
    assert.equal(slotDec1.isAvailable, false)
    assert.equal(slotDec1.isOccupied, false)
  })

  it("should paginate rooms and return pagination metadata", async () => {
    const page1 = await ReportsService.getAvailabilityGrid(
      startIso,
      endIso,
      testPropertyId,
      undefined,
      { categoryId: "all", page: 1, limit: 2 }
    )
    assert.equal(page1.rooms.length, 2)
    assert.equal(page1.pagination?.total, 3)
    assert.equal(page1.pagination?.totalPages, 2)
    assert.equal(page1.pagination?.page, 1)

    const page2 = await ReportsService.getAvailabilityGrid(
      startIso,
      endIso,
      testPropertyId,
      undefined,
      { categoryId: "all", page: 2, limit: 2 }
    )
    assert.equal(page2.rooms.length, 1)
    assert.equal(page2.pagination?.page, 2)
  })

  it("should filter rooms by search query q", async () => {
    const searchGrid = await ReportsService.getAvailabilityGrid(
      startIso,
      endIso,
      testPropertyId,
      undefined,
      { categoryId: "all", q: "G101" }
    )
    assert.equal(searchGrid.rooms.length, 1)
    assert.equal(searchGrid.rooms[0]?.roomId, bookedRoomId)
  })

  it("should reject date ranges exceeding 31 days", async () => {
    await assert.rejects(
      async () => {
        await ReportsService.getAvailabilityGrid("2026-01-01", "2026-02-15", testPropertyId)
      },
      {
        name: "BadRequestError",
        message: "Availability grid range cannot exceed 31 days",
      }
    )
  })
})
