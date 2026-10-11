import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Prisma, RoomStatus, RoleName, AllocationStatus, ReservationStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  ReservationService,
  ReservationConflictError,
} from "../src/modules/reservations/reservation.service";
import { CustomerService } from "../src/modules/customers/customer.service";
import { enforceRole, AuthError } from "../src/lib/auth-guard";
import type { SessionPayload } from "../src/modules/auth/auth.types";

describe("Phase 4: Reservations & Availability Tests", () => {
  let testPropertyId: string;
  let testBuildingId: string;
  let testFloorId: string;
  let testCategoryId: string;
  let room101Id: string;
  let room102Id: string;
  let room103MaintenanceId: string;
  let room104ConcurrencyId: string;
  let testCustomerId: string;
  let testStaffUserId: string;

  const receptionistSession: SessionPayload = {
    sub: "receptionist-id-1",
    email: "receptionist@byteinn.local",
    name: "Receptionist Alice",
    role: RoleName.RECEPTIONIST,
  };

  const adminSession: SessionPayload = {
    sub: "admin-id-1",
    email: "admin@byteinn.local",
    name: "Admin Bob",
    role: RoleName.ADMIN,
  };

  before(async () => {
    // 1. Setup Test User for createdBy foreign key
    const role = await prisma.role.findUnique({ where: { name: RoleName.RECEPTIONIST } });
    const user = await prisma.user.create({
      data: {
        name: "Test Staff User",
        email: `staff-${Date.now()}@byteinn.test`,
        passwordHash: "dummy-hash",
        roleId: role!.id,
      },
    });
    testStaffUserId = user.id;

    // 2. Setup Property, Building, Floor
    const property = await prisma.property.create({
      data: {
        name: "Reservations Test Lodge",
        city: "Testville",
        status: "ACTIVE",
      },
    });
    testPropertyId = property.id;

    const building = await prisma.building.create({
      data: {
        propertyId: property.id,
        name: "West Wing",
      },
    });
    testBuildingId = building.id;

    const floor = await prisma.floor.create({
      data: {
        buildingId: building.id,
        floorNo: 1,
        name: "Floor 1",
      },
    });
    testFloorId = floor.id;

    // 3. Setup Room Category (Base Price $100.00)
    const category = await prisma.roomCategory.create({
      data: {
        propertyId: property.id,
        name: "Deluxe Suite",
        description: "Deluxe room with balcony",
        basePrice: new Prisma.Decimal("100.00"),
        maxOccupancy: 2,
      },
    });
    testCategoryId = category.id;

    // 4. Setup Physical Rooms
    // Room 101: standard base price
    const r101 = await prisma.room.create({
      data: {
        propertyId: property.id,
        buildingId: building.id,
        floorId: floor.id,
        roomCategoryId: category.id,
        roomNo: "101",
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    });
    room101Id = r101.id;

    // Room 102: price override ($125.00)
    const r102 = await prisma.room.create({
      data: {
        propertyId: property.id,
        buildingId: building.id,
        floorId: floor.id,
        roomCategoryId: category.id,
        roomNo: "102",
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
        priceOverride: new Prisma.Decimal("125.00"),
      },
    });
    room102Id = r102.id;

    // Room 103: MAINTENANCE operational status
    const r103 = await prisma.room.create({
      data: {
        propertyId: property.id,
        buildingId: building.id,
        floorId: floor.id,
        roomCategoryId: category.id,
        roomNo: "103",
        capacity: 2,
        status: RoomStatus.MAINTENANCE,
      },
    });
    room103MaintenanceId = r103.id;

    // Room 104: clean room for concurrency test
    const r104 = await prisma.room.create({
      data: {
        propertyId: property.id,
        buildingId: building.id,
        floorId: floor.id,
        roomCategoryId: category.id,
        roomNo: "104",
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    });
    room104ConcurrencyId = r104.id;

    // 5. Setup Customer
    const customer = await CustomerService.createCustomer({
      firstName: "Jane",
      lastName: "Smith",
      phone: "+1-555-0199",
      email: "jane.smith@res.test",
      nationality: "Canadian",
      idProofType: "Passport",
      idProofNumber: "C12345678",
    });
    testCustomerId = customer.id;
  });

  after(async () => {
    // Cleanup created records in reverse order
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { userId: testStaffUserId },
          { entityType: "Reservation" },
        ],
      },
    });

    await prisma.reservationRoom.deleteMany({
      where: {
        OR: [
          { roomId: { in: [room101Id, room102Id, room103MaintenanceId, room104ConcurrencyId] } },
          { reservation: { customerId: testCustomerId } },
          { reservation: { customer: { email: { contains: "res.test" } } } },
        ],
      },
    });

    await prisma.reservation.deleteMany({
      where: {
        OR: [
          { createdBy: testStaffUserId },
          { customerId: testCustomerId },
          { customer: { email: { contains: "res.test" } } },
        ],
      },
    });

    await prisma.customer.deleteMany({
      where: {
        OR: [
          { id: testCustomerId },
          { email: { contains: "res.test" } },
        ],
      },
    });

    await prisma.room.deleteMany({
      where: { propertyId: testPropertyId },
    });

    await prisma.roomCategory.deleteMany({
      where: { id: testCategoryId },
    });

    await prisma.floor.deleteMany({
      where: { id: testFloorId },
    });

    await prisma.building.deleteMany({
      where: { id: testBuildingId },
    });

    await prisma.property.deleteMany({
      where: { id: testPropertyId },
    });

    await prisma.user.deleteMany({
      where: { id: testStaffUserId },
    });
  });

  describe("1. Availability Checking & Half-Open Interval Business Rules", () => {
    it("should include clean rooms and exclude maintenance rooms initially", async () => {
      const available = await ReservationService.checkAvailability({
        arrivalDate: "2026-11-10",
        departureDate: "2026-11-15",
        propertyId: testPropertyId,
      });

      const roomNos = available.map((r) => r.roomNo);
      assert.ok(roomNos.includes("101"));
      assert.ok(roomNos.includes("102"));
      assert.ok(roomNos.includes("104"));
      // Room 103 is under MAINTENANCE and must never be available
      assert.ok(!roomNos.includes("103"), "Room 103 (Maintenance) should be excluded");
    });

    it("should exclude room when overlapping booking exists [arrival, departure)", async () => {
      // Create existing booking on Room 101 for Nov 10 to Nov 15
      await ReservationService.createReservation(
        {
          customerId: testCustomerId,
          allocations: [
            {
              roomId: room101Id,
              arrivalDate: "2026-11-10",
              departureDate: "2026-11-15",
            },
          ],
        },
        testStaffUserId
      );

      // 1. Exact overlap (Nov 10 - Nov 15)
      const exact = await ReservationService.checkAvailability({
        arrivalDate: "2026-11-10",
        departureDate: "2026-11-15",
        propertyId: testPropertyId,
      });
      assert.ok(!exact.some((r) => r.roomNo === "101"), "Exact overlap should exclude Room 101");

      // 2. Overlap earlier (Nov 8 - Nov 12) -> existingArrival(10) < requestedDeparture(12) && existingDeparture(15) > requestedArrival(8)
      const overlapEarly = await ReservationService.checkAvailability({
        arrivalDate: "2026-11-08",
        departureDate: "2026-11-12",
        propertyId: testPropertyId,
      });
      assert.ok(!overlapEarly.some((r) => r.roomNo === "101"), "Early overlap should exclude Room 101");

      // 3. Overlap later (Nov 13 - Nov 18) -> existingArrival(10) < requestedDeparture(18) && existingDeparture(15) > requestedArrival(13)
      const overlapLate = await ReservationService.checkAvailability({
        arrivalDate: "2026-11-13",
        departureDate: "2026-11-18",
        propertyId: testPropertyId,
      });
      assert.ok(!overlapLate.some((r) => r.roomNo === "101"), "Late overlap should exclude Room 101");

      // 4. Enclosed stay (Nov 11 - Nov 14)
      const enclosed = await ReservationService.checkAvailability({
        arrivalDate: "2026-11-11",
        departureDate: "2026-11-14",
        propertyId: testPropertyId,
      });
      assert.ok(!enclosed.some((r) => r.roomNo === "101"), "Enclosed stay should exclude Room 101");
    });

    it("should permit same-day departure and arrival (half-open boundary [arrival, departure))", async () => {
      // Existing booking on Room 101 is Nov 10 to Nov 15:

      // Case A: Next guest arrives Nov 15 (same day previous guest departs at checkout)
      // requested: [Nov 15, Nov 20)
      // existingArrival(10) < requestedDeparture(20) [TRUE] BUT existingDeparture(15) > requestedArrival(15) [FALSE]
      const nextStay = await ReservationService.checkAvailability({
        arrivalDate: "2026-11-15",
        departureDate: "2026-11-20",
        propertyId: testPropertyId,
      });
      assert.ok(
        nextStay.some((r) => r.roomNo === "101"),
        "Same-day arrival after departure should be permitted"
      );

      // Case B: Previous guest departs Nov 10 (same day existing guest arrives at check-in)
      // requested: [Nov 05, Nov 10)
      // existingArrival(10) < requestedDeparture(10) [FALSE]
      const priorStay = await ReservationService.checkAvailability({
        arrivalDate: "2026-11-05",
        departureDate: "2026-11-10",
        propertyId: testPropertyId,
      });
      assert.ok(
        priorStay.some((r) => r.roomNo === "101"),
        "Same-day departure before arrival should be permitted"
      );
    });

    it("should reject departureDate <= arrivalDate in availability check", async () => {
      await assert.rejects(
        async () => {
          await ReservationService.checkAvailability({
            arrivalDate: "2026-11-15",
            departureDate: "2026-11-15", // zero-length
          });
        },
        /Departure date must be after arrival date/
      );

      await assert.rejects(
        async () => {
          await ReservationService.checkAvailability({
            arrivalDate: "2026-11-18",
            departureDate: "2026-11-12", // negative length
          });
        },
        /Departure date must be after arrival date/
      );
    });
  });

  describe("2. Reservation Creation & Rate Snapshots", () => {
    it("should snapshot effective rate from room category when no override is set", async () => {
      const res = await ReservationService.createReservation(
        {
          customerId: testCustomerId,
          allocations: [
            {
              roomId: room101Id,
              arrivalDate: "2026-11-15",
              departureDate: "2026-11-18",
            },
          ],
        },
        testStaffUserId
      );

      assert.equal(res.rooms.length, 1);
      assert.equal(res.rooms[0].roomId, room101Id);
      // Room 101 category base price is 100.00
      assert.equal(res.rooms[0].bookedNightlyRate.toFixed(2), "100.00");
      assert.equal(res.status, ReservationStatus.CONFIRMED);
      assert.ok(res.reservationNo.startsWith("RES-"));
    });

    it("should snapshot priceOverride when configured on the physical room", async () => {
      const res = await ReservationService.createReservation(
        {
          customerId: testCustomerId,
          allocations: [
            {
              roomId: room102Id,
              arrivalDate: "2026-11-15",
              departureDate: "2026-11-18",
            },
          ],
        },
        testStaffUserId
      );

      assert.equal(res.rooms.length, 1);
      assert.equal(res.rooms[0].roomId, room102Id);
      // Room 102 has priceOverride 125.00
      assert.equal(res.rooms[0].bookedNightlyRate.toFixed(2), "125.00");
    });

    it("should snapshot custom bookedNightlyRate when provided explicitly in input", async () => {
      const res = await ReservationService.createReservation(
        {
          customerId: testCustomerId,
          allocations: [
            {
              roomId: room101Id,
              arrivalDate: "2026-11-20",
              departureDate: "2026-11-22",
              bookedNightlyRate: "89.50",
            },
          ],
        },
        testStaffUserId
      );

      assert.equal(res.rooms[0].bookedNightlyRate.toFixed(2), "89.50");
    });

    it("should support reservations containing multiple room allocations with independent stay dates", async () => {
      const res = await ReservationService.createReservation(
        {
          customerId: testCustomerId,
          specialRequests: "Adjacent rooms requested",
          allocations: [
            {
              roomId: room101Id,
              arrivalDate: "2026-12-01",
              departureDate: "2026-12-05", // 4 nights
              adults: 2,
              children: 1,
            },
            {
              roomId: room102Id,
              arrivalDate: "2026-12-03",
              departureDate: "2026-12-07", // 4 nights, different dates
              adults: 1,
              children: 0,
            },
          ],
        },
        testStaffUserId
      );

      assert.equal(res.rooms.length, 2);
      assert.equal(res.specialRequests, "Adjacent rooms requested");

      const alloc1 = res.rooms.find((r) => r.roomId === room101Id)!;
      const alloc2 = res.rooms.find((r) => r.roomId === room102Id)!;

      assert.equal(alloc1.arrivalDate.toISOString().split("T")[0], "2026-12-01");
      assert.equal(alloc1.departureDate.toISOString().split("T")[0], "2026-12-05");
      assert.equal(alloc1.adults, 2);
      assert.equal(alloc1.children, 1);

      assert.equal(alloc2.arrivalDate.toISOString().split("T")[0], "2026-12-03");
      assert.equal(alloc2.departureDate.toISOString().split("T")[0], "2026-12-07");
      assert.equal(alloc2.adults, 1);
      assert.equal(alloc2.children, 0);
    });

    it("should create new customer on-the-fly when newCustomer is supplied", async () => {
      const res = await ReservationService.createReservation(
        {
          newCustomer: {
            firstName: "Robert",
            lastName: "Paulson",
            email: "robert.p@res.test",
            phone: "+1-555-4321",
          },
          allocations: [
            {
              roomId: room101Id,
              arrivalDate: "2026-12-10",
              departureDate: "2026-12-12",
            },
          ],
        },
        testStaffUserId
      );

      assert.ok(res.customer);
      assert.equal(res.customer.firstName, "Robert");
      assert.equal(res.customer.lastName, "Paulson");
      assert.equal(res.customer.email, "robert.p@res.test");
    });
  });

  describe("3. Data Integrity & Validation", () => {
    it("should reject booking on a room under MAINTENANCE", async () => {
      await assert.rejects(
        async () => {
          await ReservationService.createReservation(
            {
              customerId: testCustomerId,
              allocations: [
                {
                  roomId: room103MaintenanceId,
                  arrivalDate: "2026-11-25",
                  departureDate: "2026-11-27",
                },
              ],
            },
            testStaffUserId
          );
        },
        /Room 103 is currently under MAINTENANCE and cannot be booked/
      );
    });

    it("should reject departureDate <= arrivalDate", async () => {
      await assert.rejects(
        async () => {
          await ReservationService.createReservation(
            {
              customerId: testCustomerId,
              allocations: [
                {
                  roomId: room101Id,
                  arrivalDate: "2026-12-20",
                  departureDate: "2026-12-20",
                },
              ],
            },
            testStaffUserId
          );
        },
        /Departure date must be after arrival date/
      );
    });

    it("should reject double-allocating same room on overlapping dates in one request", async () => {
      await assert.rejects(
        async () => {
          await ReservationService.createReservation(
            {
              customerId: testCustomerId,
              allocations: [
                {
                  roomId: room101Id,
                  arrivalDate: "2026-12-20",
                  departureDate: "2026-12-25",
                },
                {
                  roomId: room101Id,
                  arrivalDate: "2026-12-22",
                  departureDate: "2026-12-27",
                },
              ],
            },
            testStaffUserId
          );
        },
        /cannot be allocated multiple times for overlapping dates/
      );
    });

    it("should reject booking without customerId or newCustomer", async () => {
      await assert.rejects(
        async () => {
          await ReservationService.createReservation(
            {
              allocations: [
                {
                  roomId: room101Id,
                  arrivalDate: "2026-12-20",
                  departureDate: "2026-12-22",
                },
              ],
            },
            testStaffUserId
          );
        },
        /Either an existing customerId or newCustomer details must be provided/
      );
    });
  });

  describe("4. Concurrency & Race-Condition Prevention (PostgreSQL Integration)", () => {
    it("should prevent concurrent double-booking of the same physical room on overlapping dates", async () => {
      // Room 104 is completely free.
      // Two receptionists attempt to book Room 104 for overlapping dates concurrently at the exact same instant!
      const bookingAttempt1 = ReservationService.createReservation(
        {
          customerId: testCustomerId,
          specialRequests: "Concurrent Request Alpha",
          allocations: [
            {
              roomId: room104ConcurrencyId,
              arrivalDate: "2026-11-10",
              departureDate: "2026-11-15",
            },
          ],
        },
        testStaffUserId
      );

      const bookingAttempt2 = ReservationService.createReservation(
        {
          customerId: testCustomerId,
          specialRequests: "Concurrent Request Beta",
          allocations: [
            {
              roomId: room104ConcurrencyId,
              arrivalDate: "2026-11-12",
              departureDate: "2026-11-17",
            },
          ],
        },
        testStaffUserId
      );

      const results = await Promise.allSettled([bookingAttempt1, bookingAttempt2]);

      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      // Exactly ONE must succeed and exactly ONE must fail with conflict!
      assert.equal(succeeded.length, 1, "Exactly one concurrent booking must succeed");
      assert.equal(failed.length, 1, "Exactly one concurrent booking must fail with conflict");

      const rejectionReason = (failed[0] as PromiseRejectedResult).reason;
      assert.ok(
        rejectionReason instanceof ReservationConflictError ||
          rejectionReason?.message?.includes("already booked") ||
          rejectionReason?.message?.includes("concurrent"),
        `Expected conflict error but got: ${rejectionReason}`
      );

      // Verify database state: exactly ONE allocation exists for Room 104
      const allocations = await prisma.reservationRoom.findMany({
        where: {
          roomId: room104ConcurrencyId,
          status: AllocationStatus.CONFIRMED,
        },
      });

      assert.equal(allocations.length, 1, "Database must contain only the winning allocation");
    });

    it("should atomically roll back entire multi-room reservation if any room fails conflict check", async () => {
      // Room 104 is already booked Nov 10 - Nov 15.
      // An attempt to book Room 102 (free) AND Room 104 (conflicting) in one reservation must roll back completely!
      const initialResCount = await prisma.reservation.count({
        where: { createdBy: testStaffUserId },
      });
      const initialResRoomCount = await prisma.reservationRoom.count({
        where: { reservation: { createdBy: testStaffUserId } },
      });

      await assert.rejects(
        async () => {
          await ReservationService.createReservation(
            {
              customerId: testCustomerId,
              allocations: [
                {
                  roomId: room102Id, // free Nov 20-25
                  arrivalDate: "2026-11-20",
                  departureDate: "2026-11-25",
                },
                {
                  roomId: room104ConcurrencyId, // CONFLICT with Nov 10-15
                  arrivalDate: "2026-11-11",
                  departureDate: "2026-11-14",
                },
              ],
            },
            testStaffUserId
          );
        },
        (err: unknown) =>
          err instanceof ReservationConflictError ||
          (err instanceof Error && err.message.includes("already booked"))
      );

      // Verify zero orphaned records: reservation count and allocation count remain unchanged!
      const afterResCount = await prisma.reservation.count({
        where: { createdBy: testStaffUserId },
      });
      const afterResRoomCount = await prisma.reservationRoom.count({
        where: { reservation: { createdBy: testStaffUserId } },
      });

      assert.equal(afterResCount, initialResCount, "Zero orphaned reservations after rollback");
      assert.equal(afterResRoomCount, initialResRoomCount, "Zero orphaned room allocations after rollback");

      // Verify Room 102 was NOT allocated
      const room102Alloc = await prisma.reservationRoom.findFirst({
        where: {
          roomId: room102Id,
          arrivalDate: new Date("2026-11-20T00:00:00.000Z"),
        },
      });
      assert.equal(room102Alloc, null, "Room 102 allocation must be rolled back");
    });
  });

  describe("5. Role Authorization & Access Control", () => {
    it("should allow RECEPTIONIST to access reservations", () => {
      const permitted = enforceRole(receptionistSession, [
        RoleName.ADMIN,
        RoleName.RECEPTIONIST,
      ]);
      assert.equal(permitted.role, RoleName.RECEPTIONIST);
    });

    it("should allow ADMIN to access reservations", () => {
      const permitted = enforceRole(adminSession, [
        RoleName.ADMIN,
        RoleName.RECEPTIONIST,
      ]);
      assert.equal(permitted.role, RoleName.ADMIN);
    });

    it("should reject unauthenticated request", () => {
      assert.throws(
        () => enforceRole(null),
        (err: unknown) => err instanceof AuthError && err.statusCode === 401
      );
    });
  });

  describe("6. Audit Logging Verification", () => {
    it("should record AuditLog entry on reservation creation", async () => {
      const log = await prisma.auditLog.findFirst({
        where: {
          action: "RESERVATION_CREATED",
          userId: testStaffUserId,
        },
        orderBy: { createdAt: "desc" },
      });

      assert.ok(log, "Audit log record must exist");
      assert.equal(log.entityType, "Reservation");
      assert.equal(log.action, "RESERVATION_CREATED");
      assert.equal(log.userId, testStaffUserId);
    });
  });

  describe("7. Customer Management Workflows", () => {
    it("should search customers by name, email, or phone", async () => {
      const resultName = await CustomerService.getCustomers({ search: "Jane" });
      assert.ok(resultName.customers.some((c) => c.firstName === "Jane"));

      const resultPhone = await CustomerService.getCustomers({ search: "0199" });
      assert.ok(resultPhone.customers.some((c) => c.phone?.includes("0199")));

      const resultEmail = await CustomerService.getCustomers({ search: "jane.smith" });
      assert.ok(resultEmail.customers.some((c) => c.email?.includes("jane.smith")));
    });

    it("should retrieve customer details with recent reservation history", async () => {
      const customer = await CustomerService.getCustomerById(testCustomerId);
      assert.equal(customer.id, testCustomerId);
      assert.ok(Array.isArray(customer.reservations));
      assert.ok(customer.reservations.length > 0);
    });

    it("should update customer contact and ID proof details", async () => {
      const updated = await CustomerService.updateCustomer(testCustomerId, {
        phone: "+1-555-9999",
        remarks: "VIP guest returning",
      });
      assert.equal(updated.phone, "+1-555-9999");
      assert.equal(updated.remarks, "VIP guest returning");
    });
  });

  describe("8. Reservation Listing & Details Queries", () => {
    it("should list reservations with pagination and search filter", async () => {
      const list = await ReservationService.getReservations({
        search: "Jane",
        page: 1,
        limit: 10,
      });

      assert.ok(list.reservations.length > 0);
      assert.ok(list.pagination.total > 0);
      assert.ok(list.reservations[0].customer.firstName.includes("Jane"));
      assert.ok(list.reservations[0].rooms.length > 0);
    });

    it("should fetch single reservation by ID with full allocations", async () => {
      const list = await ReservationService.getReservations({ limit: 1 });
      const targetId = list.reservations[0].id;

      const detail = await ReservationService.getReservationById(targetId);
      assert.equal(detail.id, targetId);
      assert.ok(detail.customer);
      assert.ok(detail.creator);
      assert.ok(detail.rooms.length > 0);
      assert.ok(detail.rooms[0].room.roomNo);
      assert.ok(detail.rooms[0].roomCategory.name);
    });
  });
});
