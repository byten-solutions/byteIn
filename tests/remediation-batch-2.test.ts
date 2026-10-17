import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { AuthService } from "../src/modules/auth/auth.service";
import { RoleName } from "../src/modules/auth/auth.types";
import { POST as cancelReservationRoute } from "../src/app/api/reservations/[id]/cancel/route";
import { POST as cancelAllocationRoute } from "../src/app/api/room-allocations/[id]/cancel/route";
import { POST as noShowRoute } from "../src/app/api/room-allocations/[id]/no-show/route";
import { POST as extendStayRoute } from "../src/app/api/room-allocations/[id]/extend/route";
import { POST as changeRoomRoute } from "../src/app/api/room-allocations/[id]/change-room/route";
import { POST as checkOutRoute } from "../src/app/api/room-allocations/[id]/check-out/route";
import { ReservationStatus, AllocationStatus, RoomStatus } from "@prisma/client";

describe("Batch 2 Remediations: Reservation Lifecycle & Allocation State Engine", () => {
  let receptionistToken: string;
  let testPropertyId: string;
  let testCategoryId: string;
  let testCustomerId: string;
  let receptionistUserId: string;

  const createdRoomIds: string[] = [];

  before(async () => {
    // 1. Locate receptionist user
    const receptionistUser = await prisma.user.findFirst({
      where: { role: { name: RoleName.RECEPTIONIST } },
      include: { role: true },
    });
    assert.ok(receptionistUser, "Receptionist user required for test");
    receptionistUserId = receptionistUser.id;

    receptionistToken = await AuthService.createSessionToken({
      sub: receptionistUser.id,
      email: receptionistUser.email,
      name: receptionistUser.name,
      role: RoleName.RECEPTIONIST,
    });

    // 2. Setup property and room category
    const property = await prisma.property.findFirst();
    assert.ok(property, "Property required for test");
    testPropertyId = property.id;

    const category = await prisma.roomCategory.findFirst({
      where: { propertyId: testPropertyId },
    });
    assert.ok(category, "RoomCategory required for test");
    testCategoryId = category.id;

    // 3. Setup isolated test customer
    const customer = await prisma.customer.create({
      data: {
        firstName: "BatchTwo",
        lastName: "Lifecycle",
        email: `batch2-${Date.now()}@lifecycle.test`,
        phone: "+91-99999-00002",
      },
    });
    testCustomerId = customer.id;
  });

  async function createTestRoom(customRoomNo?: string) {
    const existing = await prisma.room.findFirst({
      where: { propertyId: testPropertyId, roomCategoryId: testCategoryId },
    });
    assert.ok(existing);
    const room = await prisma.room.create({
      data: {
        propertyId: testPropertyId,
        buildingId: existing.buildingId,
        floorId: existing.floorId,
        roomCategoryId: testCategoryId,
        roomNo: customRoomNo || `B2-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`,
        displayName: "Batch 2 Test Room",
        capacity: existing.capacity || 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    });
    createdRoomIds.push(room.id);
    return room;
  }

  after(async () => {
    // Clean up all reservations and rooms created by this suite
    if (testCustomerId) {
      await prisma.reservationRoom.deleteMany({
        where: { reservation: { customerId: testCustomerId } },
      });
      await prisma.reservation.deleteMany({
        where: { customerId: testCustomerId },
      });
      await prisma.customer.deleteMany({
        where: { id: testCustomerId },
      });
    }

    if (createdRoomIds.length > 0) {
      await prisma.room.deleteMany({
        where: { id: { in: createdRoomIds } },
      });
    }
  });

  // =========================================================================
  // 1. Cancel Entire Reservation
  // =========================================================================
  describe("1. Cancel Reservation", () => {
    it("should cancel a confirmed reservation and all associated allocations via HTTP route handler", async () => {
      const roomA = await createTestRoom();
      const roomB = await createTestRoom();

      const reservation = await prisma.reservation.create({
        data: {
          reservationNo: `RES-CANCEL-${Date.now()}`,
          customerId: testCustomerId,
          status: ReservationStatus.CONFIRMED,
          createdBy: receptionistUserId,
          rooms: {
            create: [
              {
                roomId: roomA.id,
                roomCategoryId: testCategoryId,
                arrivalDate: new Date("2026-11-10T00:00:00.000Z"),
                departureDate: new Date("2026-11-13T00:00:00.000Z"),
                bookedNightlyRate: 1500,
                status: AllocationStatus.CONFIRMED,
              },
              {
                roomId: roomB.id,
                roomCategoryId: testCategoryId,
                arrivalDate: new Date("2026-11-10T00:00:00.000Z"),
                departureDate: new Date("2026-11-13T00:00:00.000Z"),
                bookedNightlyRate: 1500,
                status: AllocationStatus.CONFIRMED,
              },
            ],
          },
        },
        include: { rooms: true },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/reservations/${reservation.id}/cancel`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `byteinn_session=${receptionistToken}`,
          },
          body: JSON.stringify({ reason: "Guest requested cancellation" }),
        }
      );

      const res = await cancelReservationRoute(req, {
        params: Promise.resolve({ id: reservation.id }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.status, ReservationStatus.CANCELLED);

      // Verify DB state
      const updatedRes = await prisma.reservation.findUnique({
        where: { id: reservation.id },
        include: { rooms: true },
      });
      assert.ok(updatedRes);
      assert.equal(updatedRes.status, ReservationStatus.CANCELLED);
      assert.ok(updatedRes.rooms.every((r) => r.status === AllocationStatus.CANCELLED));
    });
  });

  // =========================================================================
  // 2. Cancel Single Allocation & Automatic Parent Reservation Status
  // =========================================================================
  describe("2. Cancel Allocation & Reservation Invariant", () => {
    it("should keep reservation CONFIRMED when only 1 of 2 allocations is cancelled, then transition to CANCELLED when all are cancelled", async () => {
      const roomA = await createTestRoom();
      const roomB = await createTestRoom();

      const reservation = await prisma.reservation.create({
        data: {
          reservationNo: `RES-MULTI-${Date.now()}`,
          customerId: testCustomerId,
          status: ReservationStatus.CONFIRMED,
          createdBy: receptionistUserId,
          rooms: {
            create: [
              {
                roomId: roomA.id,
                roomCategoryId: testCategoryId,
                arrivalDate: new Date("2026-11-15T00:00:00.000Z"),
                departureDate: new Date("2026-11-18T00:00:00.000Z"),
                bookedNightlyRate: 1500,
                status: AllocationStatus.CONFIRMED,
              },
              {
                roomId: roomB.id,
                roomCategoryId: testCategoryId,
                arrivalDate: new Date("2026-11-15T00:00:00.000Z"),
                departureDate: new Date("2026-11-18T00:00:00.000Z"),
                bookedNightlyRate: 1500,
                status: AllocationStatus.CONFIRMED,
              },
            ],
          },
        },
        include: { rooms: true },
      });

      const allocA = reservation.rooms[0];
      const allocB = reservation.rooms[1];

      // 1. Cancel Allocation A
      const reqA = new NextRequest(
        `http://localhost:3000/api/room-allocations/${allocA.id}/cancel`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `byteinn_session=${receptionistToken}`,
          },
          body: JSON.stringify({ reason: "One room cancelled by guest" }),
        }
      );

      const resA = await cancelAllocationRoute(reqA, {
        params: Promise.resolve({ id: allocA.id }),
      });

      assert.equal(resA.status, 200);

      // Verify Reservation remains CONFIRMED because Allocation B is still active
      const resAfterA = await prisma.reservation.findUnique({
        where: { id: reservation.id },
      });
      assert.ok(resAfterA);
      assert.equal(resAfterA.status, ReservationStatus.CONFIRMED);

      // 2. Cancel Allocation B
      const reqB = new NextRequest(
        `http://localhost:3000/api/room-allocations/${allocB.id}/cancel`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `byteinn_session=${receptionistToken}`,
          },
          body: JSON.stringify({ reason: "Second room cancelled by guest" }),
        }
      );

      const resB = await cancelAllocationRoute(reqB, {
        params: Promise.resolve({ id: allocB.id }),
      });

      assert.equal(resB.status, 200);

      // Verify Reservation automatically transitions to CANCELLED because all allocations are cancelled
      const resAfterB = await prisma.reservation.findUnique({
        where: { id: reservation.id },
      });
      assert.ok(resAfterB);
      assert.equal(
        resAfterB.status,
        ReservationStatus.CANCELLED,
        "Reservation must automatically transition to CANCELLED when all allocations are cancelled"
      );
    });
  });

  // =========================================================================
  // 3. NO_SHOW Status that Releases the Room
  // =========================================================================
  describe("3. NO_SHOW Status & Exclusion Constraint Room Release", () => {
    it("should mark allocation as NO_SHOW and immediately release the physical room for a new booking", async () => {
      const room = await createTestRoom();
      const stayArrival = new Date("2026-11-20T00:00:00.000Z");
      const stayDeparture = new Date("2026-11-23T00:00:00.000Z");

      const reservation = await prisma.reservation.create({
        data: {
          reservationNo: `RES-NOSHOW-${Date.now()}`,
          customerId: testCustomerId,
          status: ReservationStatus.CONFIRMED,
          createdBy: receptionistUserId,
          rooms: {
            create: [
              {
                roomId: room.id,
                roomCategoryId: testCategoryId,
                arrivalDate: stayArrival,
                departureDate: stayDeparture,
                bookedNightlyRate: 1500,
                status: AllocationStatus.CONFIRMED,
              },
            ],
          },
        },
        include: { rooms: true },
      });

      const alloc = reservation.rooms[0];

      // Mark as NO_SHOW via HTTP endpoint
      const req = new NextRequest(
        `http://localhost:3000/api/room-allocations/${alloc.id}/no-show`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `byteinn_session=${receptionistToken}`,
          },
          body: JSON.stringify({ notes: "Guest did not arrive by midnight" }),
        }
      );

      const res = await noShowRoute(req, {
        params: Promise.resolve({ id: alloc.id }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.status, AllocationStatus.NO_SHOW);

      // Verify parent reservation transitioned to CANCELLED since sole allocation is NO_SHOW
      const updatedRes = await prisma.reservation.findUnique({
        where: { id: reservation.id },
      });
      assert.ok(updatedRes);
      assert.equal(updatedRes.status, ReservationStatus.CANCELLED);

      // CRITICAL INVARIANT: The room must now be immediately re-bookable for the exact same dates
      // without violating the PostgreSQL exclusion constraint (no_overlapping_active_allocations)
      const newReservation = await prisma.reservation.create({
        data: {
          reservationNo: `RES-REBOOK-${Date.now()}`,
          customerId: testCustomerId,
          status: ReservationStatus.CONFIRMED,
          createdBy: receptionistUserId,
          rooms: {
            create: [
              {
                roomId: room.id,
                roomCategoryId: testCategoryId,
                arrivalDate: stayArrival,
                departureDate: stayDeparture,
                bookedNightlyRate: 1500,
                status: AllocationStatus.CONFIRMED,
              },
            ],
          },
        },
      });

      assert.ok(newReservation.id, "Room must be successfully re-booked after NO_SHOW");
    });
  });

  // =========================================================================
  // 4. Extend Stay & Concurrency Overlap Protection
  // =========================================================================
  describe("4. Extend Stay", () => {
    it("should extend stay when physical room is available, and reject when another booking overlaps", async () => {
      const room = await createTestRoom();

      // Allocation 1: Nov 01 to Nov 04
      const res1 = await prisma.reservation.create({
        data: {
          reservationNo: `RES-EXTEND-${Date.now()}`,
          customerId: testCustomerId,
          status: ReservationStatus.CONFIRMED,
          createdBy: receptionistUserId,
          rooms: {
            create: [
              {
                roomId: room.id,
                roomCategoryId: testCategoryId,
                arrivalDate: new Date("2026-11-01T00:00:00.000Z"),
                departureDate: new Date("2026-11-04T00:00:00.000Z"),
                bookedNightlyRate: 1500,
                status: AllocationStatus.CHECKED_IN,
              },
            ],
          },
        },
        include: { rooms: true },
      });
      const alloc1 = res1.rooms[0];

      // Future booking: Nov 06 to Nov 08
      await prisma.reservation.create({
        data: {
          reservationNo: `RES-COLLISION-${Date.now()}`,
          customerId: testCustomerId,
          status: ReservationStatus.CONFIRMED,
          createdBy: receptionistUserId,
          rooms: {
            create: [
              {
                roomId: room.id,
                roomCategoryId: testCategoryId,
                arrivalDate: new Date("2026-11-06T00:00:00.000Z"),
                departureDate: new Date("2026-11-08T00:00:00.000Z"),
                bookedNightlyRate: 1500,
                status: AllocationStatus.CONFIRMED,
              },
            ],
          },
        },
      });

      // 1. Extend alloc1 to Nov 05 (Available)
      const reqValid = new NextRequest(
        `http://localhost:3000/api/room-allocations/${alloc1.id}/extend`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `byteinn_session=${receptionistToken}`,
          },
          body: JSON.stringify({ newDepartureDate: "2026-11-05" }),
        }
      );

      const resValid = await extendStayRoute(reqValid, {
        params: Promise.resolve({ id: alloc1.id }),
      });
      assert.equal(resValid.status, 200);

      const updatedAlloc = await prisma.reservationRoom.findUnique({
        where: { id: alloc1.id },
      });
      assert.ok(updatedAlloc);
      assert.equal(
        updatedAlloc.departureDate.toISOString().split("T")[0],
        "2026-11-05"
      );

      // 2. Extend alloc1 to Nov 07 (Collides with Nov 06 booking -> must fail with 409 Conflict)
      const reqConflict = new NextRequest(
        `http://localhost:3000/api/room-allocations/${alloc1.id}/extend`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `byteinn_session=${receptionistToken}`,
          },
          body: JSON.stringify({ newDepartureDate: "2026-11-07" }),
        }
      );

      const resConflict = await extendStayRoute(reqConflict, {
        params: Promise.resolve({ id: alloc1.id }),
      });
      assert.equal(resConflict.status, 409, "Must return 409 Conflict when extension overlaps");
    });
  });

  // =========================================================================
  // 5. Change Room
  // =========================================================================
  describe("5. Change Room", () => {
    it("should move checked-in allocation to a clean available room, marking old room VACANT_DIRTY and new room OCCUPIED", async () => {
      const roomOld = await createTestRoom();
      const roomNew = await createTestRoom();

      // Set roomOld to OCCUPIED
      await prisma.room.update({
        where: { id: roomOld.id },
        data: { status: RoomStatus.OCCUPIED },
      });

      const reservation = await prisma.reservation.create({
        data: {
          reservationNo: `RES-CHANGE-${Date.now()}`,
          customerId: testCustomerId,
          status: ReservationStatus.CONFIRMED,
          createdBy: receptionistUserId,
          rooms: {
            create: [
              {
                roomId: roomOld.id,
                roomCategoryId: testCategoryId,
                arrivalDate: new Date("2026-11-10T00:00:00.000Z"),
                departureDate: new Date("2026-11-14T00:00:00.000Z"),
                bookedNightlyRate: 1500,
                status: AllocationStatus.CHECKED_IN,
              },
            ],
          },
        },
        include: { rooms: true },
      });
      const alloc = reservation.rooms[0];

      const req = new NextRequest(
        `http://localhost:3000/api/room-allocations/${alloc.id}/change-room`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `byteinn_session=${receptionistToken}`,
          },
          body: JSON.stringify({
            newRoomId: roomNew.id,
            reason: "AC leaking in original room",
          }),
        }
      );

      const res = await changeRoomRoute(req, {
        params: Promise.resolve({ id: alloc.id }),
      });

      assert.equal(res.status, 200);

      // Verify allocation moved to roomNew
      const updatedAlloc = await prisma.reservationRoom.findUnique({
        where: { id: alloc.id },
      });
      assert.ok(updatedAlloc);
      assert.equal(updatedAlloc.roomId, roomNew.id);

      // Verify physical room states: old room VACANT_DIRTY, new room OCCUPIED
      const updatedOldRoom = await prisma.room.findUnique({ where: { id: roomOld.id } });
      const updatedNewRoom = await prisma.room.findUnique({ where: { id: roomNew.id } });

      assert.equal(updatedOldRoom?.status, RoomStatus.VACANT_DIRTY);
      assert.equal(updatedNewRoom?.status, RoomStatus.OCCUPIED);
    });
  });

  // =========================================================================
  // 6. Early Checkout & Effective End Date
  // =========================================================================
  describe("6. Early Checkout & Effective Checkout Date", () => {
    it("should preserve booked departure date, set actualCheckoutDate, transition room to VACANT_DIRTY", async () => {
      const room = await createTestRoom();
      const bookedDeparture = new Date("2026-11-25T00:00:00.000Z");

      const reservation = await prisma.reservation.create({
        data: {
          reservationNo: `RES-EARLY-${Date.now()}`,
          customerId: testCustomerId,
          status: ReservationStatus.CONFIRMED,
          createdBy: receptionistUserId,
          rooms: {
            create: [
              {
                roomId: room.id,
                roomCategoryId: testCategoryId,
                arrivalDate: new Date("2026-11-20T00:00:00.000Z"),
                departureDate: bookedDeparture,
                bookedNightlyRate: 1500,
                status: AllocationStatus.CHECKED_IN,
              },
            ],
          },
        },
        include: { rooms: true },
      });
      const alloc = reservation.rooms[0];

      await prisma.room.update({
        where: { id: room.id },
        data: { status: RoomStatus.OCCUPIED },
      });

      // Checkout early
      const req = new NextRequest(
        `http://localhost:3000/api/room-allocations/${alloc.id}/check-out`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `byteinn_session=${receptionistToken}`,
          },
          body: JSON.stringify({ notes: "Guest departing 2 days early" }),
        }
      );

      const res = await checkOutRoute(req, {
        params: Promise.resolve({ id: alloc.id }),
      });

      assert.equal(res.status, 200);

      // Verify DB state: booked departureDate preserved, actualCheckoutDate populated
      const updatedAlloc = await prisma.reservationRoom.findUnique({
        where: { id: alloc.id },
      });
      assert.ok(updatedAlloc);
      assert.equal(updatedAlloc.status, AllocationStatus.CHECKED_OUT);
      assert.equal(
        updatedAlloc.departureDate.toISOString(),
        bookedDeparture.toISOString(),
        "Booked departureDate must be preserved"
      );
      assert.ok(
        updatedAlloc.actualCheckoutDate,
        "actualCheckoutDate must be populated on checkout"
      );
      assert.ok(
        updatedAlloc.checkedOutAt,
        "checkedOutAt timestamp must be populated"
      );

      // Room must transition to VACANT_DIRTY
      const finalRoom = await prisma.room.findUnique({ where: { id: room.id } });
      assert.equal(finalRoom?.status, RoomStatus.VACANT_DIRTY);
    });
  });
});
