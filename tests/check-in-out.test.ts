import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  Prisma,
  RoomStatus,
  RoleName,
  AllocationStatus,
  ReservationStatus,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { CheckInOutService } from "../src/modules/check-in-out/check-in-out.service";
import { CustomerService } from "../src/modules/customers/customer.service";
import { ReservationService } from "../src/modules/reservations/reservation.service";
import { enforceRole, AuthError } from "../src/lib/auth-guard";
import type { SessionPayload } from "../src/modules/auth/auth.types";
import { getHotelTodayDate } from "../src/lib/date";

describe("Phase 5: Guest Operations, Check-In & Check-Out Tests", () => {
  let testStaffUserId: string;
  let testPropertyId: string;
  let testBuildingId: string;
  let testFloorId: string;
  let testCategoryId: string;
  let room201CleanId: string;
  let room202DirtyId: string;
  let room203MaintId: string;
  let room204CleanId: string;
  let testCustomerId: string;

  const todayStr = getHotelTodayDate();
  const futureDate = new Date(Date.now() + 86400000 * 3);
  const futureStr = futureDate.toISOString().slice(0, 10);

  const receptionistSession: SessionPayload = {
    sub: "receptionist-id-1",
    email: "receptionist@byteinn.local",
    name: "Receptionist Bob",
    role: RoleName.RECEPTIONIST,
  };

  const adminSession: SessionPayload = {
    sub: "admin-id-1",
    email: "admin@byteinn.local",
    name: "Admin Alice",
    role: RoleName.ADMIN,
  };

  before(async () => {
    // 1. Staff User
    const role = await prisma.role.findUnique({
      where: { name: RoleName.RECEPTIONIST },
    });
    const user = await prisma.user.create({
      data: {
        name: "CheckInOut Test Staff",
        email: `staff-checkin-${Date.now()}@byteinn.test`,
        passwordHash: "dummy-hash",
        roleId: role!.id,
      },
    });
    testStaffUserId = user.id;

    // 2. Property, Building, Floor
    const property = await prisma.property.create({
      data: {
        name: "Guest Operations Resort",
        city: "Testville",
        status: "ACTIVE",
      },
    });
    testPropertyId = property.id;

    const building = await prisma.building.create({
      data: {
        propertyId: property.id,
        name: "North Wing",
      },
    });
    testBuildingId = building.id;

    const floor = await prisma.floor.create({
      data: {
        buildingId: building.id,
        floorNo: 2,
        name: "Floor 2",
      },
    });
    testFloorId = floor.id;

    // 3. Category
    const category = await prisma.roomCategory.create({
      data: {
        propertyId: property.id,
        name: "Executive Suite",
        basePrice: new Prisma.Decimal("150.00"),
        maxOccupancy: 2,
      },
    });
    testCategoryId = category.id;

    // 4. Physical Rooms
    // Room 201: VACANT_CLEAN
    const r201 = await prisma.room.create({
      data: {
        propertyId: property.id,
        buildingId: building.id,
        floorId: floor.id,
        roomCategoryId: category.id,
        roomNo: "201",
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    });
    room201CleanId = r201.id;

    // Room 202: VACANT_DIRTY
    const r202 = await prisma.room.create({
      data: {
        propertyId: property.id,
        buildingId: building.id,
        floorId: floor.id,
        roomCategoryId: category.id,
        roomNo: "202",
        capacity: 2,
        status: RoomStatus.VACANT_DIRTY,
      },
    });
    room202DirtyId = r202.id;

    // Room 203: MAINTENANCE
    const r203 = await prisma.room.create({
      data: {
        propertyId: property.id,
        buildingId: building.id,
        floorId: floor.id,
        roomCategoryId: category.id,
        roomNo: "203",
        capacity: 2,
        status: RoomStatus.MAINTENANCE,
      },
    });
    room203MaintId = r203.id;

    // Room 204: VACANT_CLEAN (for multi-room stay)
    const r204 = await prisma.room.create({
      data: {
        propertyId: property.id,
        buildingId: building.id,
        floorId: floor.id,
        roomCategoryId: category.id,
        roomNo: "204",
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    });
    room204CleanId = r204.id;

    // 5. Customer
    const customer = await CustomerService.createCustomer({
      firstName: "David",
      lastName: "Miller",
      phone: "+1-555-7788",
      email: "david.miller@checkin.test",
      nationality: "Canadian",
      idProofType: "Passport",
      idProofNumber: "P98765432",
    });
    testCustomerId = customer.id;
  });

  after(async () => {
    // Cleanup records in reverse order
    await prisma.auditLog.deleteMany({
      where: {
        userId: testStaffUserId,
      },
    });

    await prisma.reservationRoom.deleteMany({
      where: {
        roomId: {
          in: [room201CleanId, room202DirtyId, room203MaintId, room204CleanId],
        },
      },
    });

    await prisma.reservation.deleteMany({
      where: { createdBy: testStaffUserId },
    });

    await prisma.customer.deleteMany({
      where: { email: { contains: "checkin.test" } },
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

  describe("1. Guest Registration and Management", () => {
    it("should create and retrieve guest with valid information", async () => {
      const guest = await CustomerService.createCustomer({
        firstName: "Sarah",
        lastName: "Connor",
        phone: "+1-555-1234",
        email: "sarah.connor@checkin.test",
        nationality: "American",
        idProofType: "Driving License",
        idProofNumber: "DL123456",
        address: "Los Angeles, CA",
        remarks: "Late arrival expected",
      });

      assert.ok(guest.id);
      assert.equal(guest.firstName, "Sarah");
      assert.equal(guest.lastName, "Connor");
      assert.equal(guest.idProofNumber, "DL123456");

      const fetched = await CustomerService.getCustomerById(guest.id);
      assert.equal(fetched.id, guest.id);
      assert.equal(fetched.email, "sarah.connor@checkin.test");
    });

    it("should update guest contact and identification details", async () => {
      const updated = await CustomerService.updateCustomer(testCustomerId, {
        phone: "+1-555-9988",
        idProofType: "National ID",
        idProofNumber: "NID-112233",
        remarks: "Frequent flyer member",
      });

      assert.equal(updated.phone, "+1-555-9988");
      assert.equal(updated.idProofType, "National ID");
      assert.equal(updated.idProofNumber, "NID-112233");
      assert.equal(updated.remarks, "Frequent flyer member");
    });

    it("should search guests by name, phone, email, or idProofNumber", async () => {
      const byName = await CustomerService.getCustomers({ search: "Miller" });
      assert.ok(byName.customers.some((c) => c.lastName === "Miller"));

      const byPhone = await CustomerService.getCustomers({ search: "9988" });
      assert.ok(byPhone.customers.some((c) => c.phone === "+1-555-9988"));

      const byEmail = await CustomerService.getCustomers({ search: "david.miller" });
      assert.ok(byEmail.customers.some((c) => c.email === "david.miller@checkin.test"));
    });

    it("should throw error for non-existent guest ID", async () => {
      await assert.rejects(
        async () => {
          await CustomerService.getCustomerById("non-existent-guest-id");
        },
        /Customer not found/
      );
    });
  });

  describe("2. Check-In Workflow", () => {
    let singleReservationAllocationId: string;

    before(async () => {
      const res = await ReservationService.createReservation(
        {
          customerId: testCustomerId,
          allocations: [
            {
              roomId: room201CleanId,
              arrivalDate: todayStr,
              departureDate: futureStr,
            },
          ],
        },
        testStaffUserId
      );
      singleReservationAllocationId = res.rooms[0].id;
    });

    it("should successfully check in CONFIRMED allocation when physical room is VACANT_CLEAN", async () => {
      const result = await CheckInOutService.checkIn(
        {
          allocationId: singleReservationAllocationId,
          verifiedIdType: "Passport",
          verifiedIdNumber: "VERIFIED-9999",
          notes: "Key card #201 issued",
        },
        testStaffUserId
      );

      assert.equal(result.allocationId, singleReservationAllocationId);
      assert.equal(result.allocationStatus, AllocationStatus.CHECKED_IN);
      assert.equal(result.roomStatus, RoomStatus.OCCUPIED);
      assert.ok(result.checkedInAt instanceof Date);

      // Verify physical room in database transitioned to OCCUPIED
      const room = await prisma.room.findUnique({ where: { id: room201CleanId } });
      assert.equal(room?.status, RoomStatus.OCCUPIED);

      // Verify allocation in database is CHECKED_IN
      const alloc = await prisma.reservationRoom.findUnique({
        where: { id: singleReservationAllocationId },
      });
      assert.equal(alloc?.status, AllocationStatus.CHECKED_IN);
      assert.ok(alloc?.checkedInAt);

      // Verify customer verified ID was updated
      const customer = await prisma.customer.findUnique({ where: { id: testCustomerId } });
      assert.equal(customer?.idProofNumber, "VERIFIED-9999");

      // Verify Audit Log
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityId: singleReservationAllocationId,
          action: "ROOM_CHECKED_IN",
        },
      });
      assert.ok(audit, "Audit log must be created for ROOM_CHECKED_IN");
      assert.equal(audit?.userId, testStaffUserId);
    });

    it("should reject duplicate check-in on an already CHECKED_IN allocation", async () => {
      await assert.rejects(
        async () => {
          await CheckInOutService.checkIn(
            {
              allocationId: singleReservationAllocationId,
            },
            testStaffUserId
          );
        },
        /Room allocation is already checked in/
      );
    });

    it("should reject check-in when physical room is VACANT_DIRTY", async () => {
      // Create reservation for Room 202 (which is VACANT_DIRTY)
      const resDirty = await ReservationService.createReservation(
        {
          customerId: testCustomerId,
          allocations: [
            {
              roomId: room202DirtyId,
              arrivalDate: todayStr,
              departureDate: futureStr,
            },
          ],
        },
        testStaffUserId
      );

      const allocDirtyId = resDirty.rooms[0].id;

      await assert.rejects(
        async () => {
          await CheckInOutService.checkIn(
            { allocationId: allocDirtyId },
            testStaffUserId
          );
        },
        /Room 202 is currently VACANT_DIRTY. It must be cleaned and inspected first/
      );

      // State consistency: Room 202 remains VACANT_DIRTY and allocation remains CONFIRMED
      const room = await prisma.room.findUnique({ where: { id: room202DirtyId } });
      assert.equal(room?.status, RoomStatus.VACANT_DIRTY);
      const alloc = await prisma.reservationRoom.findUnique({ where: { id: allocDirtyId } });
      assert.equal(alloc?.status, AllocationStatus.CONFIRMED);
    });

    it("should reject check-in when physical room is under MAINTENANCE", async () => {
      // Force room status to MAINTENANCE and attempt check-in on a mock allocation
      const mockAlloc = await prisma.reservationRoom.create({
        data: {
          reservationId: (
            await prisma.reservation.findFirst({
              where: { customerId: testCustomerId },
            })
          )!.id,
          roomId: room203MaintId,
          roomCategoryId: testCategoryId,
          arrivalDate: new Date(`${todayStr}T00:00:00.000Z`),
          departureDate: new Date(`${futureStr}T00:00:00.000Z`),
          bookedNightlyRate: new Prisma.Decimal("150.00"),
          status: AllocationStatus.CONFIRMED,
        },
      });

      await assert.rejects(
        async () => {
          await CheckInOutService.checkIn(
            { allocationId: mockAlloc.id },
            testStaffUserId
          );
        },
        /Room 203 is currently under MAINTENANCE/
      );
    });

    it("should reject check-in on non-existent allocation", async () => {
      await assert.rejects(
        async () => {
          await CheckInOutService.checkIn(
            { allocationId: "invalid-alloc-id" },
            testStaffUserId
          );
        },
        /Room allocation not found/
      );
    });

    after(async () => {
      await prisma.reservationRoom.updateMany({
        where: { roomId: room201CleanId },
        data: { status: AllocationStatus.CHECKED_OUT },
      });
      await prisma.room.update({
        where: { id: room201CleanId },
        data: { status: RoomStatus.VACANT_CLEAN },
      });
    });
  });

  describe("3. Check-Out Workflow", () => {
    let checkedInAllocationId: string;

    before(async () => {
      // Reset Room 201 to VACANT_CLEAN for fresh stay
      await prisma.room.update({
        where: { id: room201CleanId },
        data: { status: RoomStatus.VACANT_CLEAN },
      });

      const res = await ReservationService.createReservation(
        {
          customerId: testCustomerId,
          allocations: [
            {
              roomId: room201CleanId,
              arrivalDate: todayStr,
              departureDate: futureStr,
            },
          ],
        },
        testStaffUserId
      );

      checkedInAllocationId = res.rooms[0].id;

      // Check-in first
      await CheckInOutService.checkIn(
        { allocationId: checkedInAllocationId },
        testStaffUserId
      );
    });

    it("should successfully check out and strictly transition physical room to VACANT_DIRTY", async () => {
      const result = await CheckInOutService.checkOut(
        {
          allocationId: checkedInAllocationId,
          notes: "Key returned, minibar empty",
        },
        testStaffUserId
      );

      assert.equal(result.allocationId, checkedInAllocationId);
      assert.equal(result.allocationStatus, AllocationStatus.CHECKED_OUT);
      assert.equal(result.roomStatus, RoomStatus.VACANT_DIRTY);
      assert.ok(result.checkedOutAt instanceof Date);

      // Verify physical room in database transitioned to VACANT_DIRTY
      const room = await prisma.room.findUnique({ where: { id: room201CleanId } });
      assert.equal(
        room?.status,
        RoomStatus.VACANT_DIRTY,
        "Checkout strictly transitions the room to VACANT_DIRTY"
      );

      // Verify allocation in database is CHECKED_OUT
      const alloc = await prisma.reservationRoom.findUnique({
        where: { id: checkedInAllocationId },
      });
      assert.equal(alloc?.status, AllocationStatus.CHECKED_OUT);
      assert.ok(alloc?.checkedOutAt);

      // Verify Audit Log
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityId: checkedInAllocationId,
          action: "ROOM_CHECKED_OUT",
        },
      });
      assert.ok(audit, "Audit log must be created for ROOM_CHECKED_OUT");
      assert.equal(audit?.userId, testStaffUserId);
    });

    it("should reject duplicate check-out on an already CHECKED_OUT allocation", async () => {
      await assert.rejects(
        async () => {
          await CheckInOutService.checkOut(
            { allocationId: checkedInAllocationId },
            testStaffUserId
          );
        },
        /Room allocation has already been checked out/
      );
    });

    it("should reject check-out of an allocation that was never checked in (CONFIRMED)", async () => {
      // Create new CONFIRMED reservation
      const res = await ReservationService.createReservation(
        {
          customerId: testCustomerId,
          allocations: [
            {
              roomId: room204CleanId,
              arrivalDate: "2026-11-05",
              departureDate: "2026-11-08",
            },
          ],
        },
        testStaffUserId
      );

      const confirmedAllocId = res.rooms[0].id;

      await assert.rejects(
        async () => {
          await CheckInOutService.checkOut(
            { allocationId: confirmedAllocId },
            testStaffUserId
          );
        },
        /Cannot check out allocation that has not been checked in/
      );
    });

    it("should reject check-out on non-existent allocation", async () => {
      await assert.rejects(
        async () => {
          await CheckInOutService.checkOut(
            { allocationId: "invalid-alloc-id" },
            testStaffUserId
          );
        },
        /Room allocation not found/
      );
    });

    after(async () => {
      await prisma.reservationRoom.updateMany({
        where: { roomId: room201CleanId },
        data: { status: AllocationStatus.CHECKED_OUT },
      });
      await prisma.room.update({
        where: { id: room201CleanId },
        data: { status: RoomStatus.VACANT_CLEAN },
      });
    });
  });

  describe("4. Multi-Room Independent Lifecycles & Reservation Progression", () => {
    let multiResId: string;
    let allocAId: string;
    let allocBId: string;

    before(async () => {
      // Ensure both rooms are clean
      await prisma.room.update({
        where: { id: room201CleanId },
        data: { status: RoomStatus.VACANT_CLEAN },
      });
      await prisma.room.update({
        where: { id: room204CleanId },
        data: { status: RoomStatus.VACANT_CLEAN },
      });

      // Create reservation with 2 rooms
      const multiRes = await ReservationService.createReservation(
        {
          customerId: testCustomerId,
          allocations: [
            {
              roomId: room201CleanId,
              arrivalDate: todayStr,
              departureDate: futureStr,
            },
            {
              roomId: room204CleanId,
              arrivalDate: todayStr,
              departureDate: futureStr,
            },
          ],
        },
        testStaffUserId
      );

      multiResId = multiRes.id;
      allocAId = multiRes.rooms.find((r) => r.roomId === room201CleanId)!.id;
      allocBId = multiRes.rooms.find((r) => r.roomId === room204CleanId)!.id;
    });

    it("should check in Room A while Room B remains CONFIRMED; reservation remains CONFIRMED", async () => {
      await CheckInOutService.checkIn({ allocationId: allocAId }, testStaffUserId);

      const allocA = await prisma.reservationRoom.findUnique({ where: { id: allocAId } });
      const allocB = await prisma.reservationRoom.findUnique({ where: { id: allocBId } });
      const res = await prisma.reservation.findUnique({ where: { id: multiResId } });

      assert.equal(allocA?.status, AllocationStatus.CHECKED_IN);
      assert.equal(allocB?.status, AllocationStatus.CONFIRMED);
      assert.equal(res?.status, ReservationStatus.CONFIRMED);
    });

    it("should check out Room A while Room B remains CONFIRMED; Room A becomes VACANT_DIRTY and reservation remains CONFIRMED", async () => {
      const checkoutResult = await CheckInOutService.checkOut(
        { allocationId: allocAId },
        testStaffUserId
      );

      assert.equal(checkoutResult.allocationStatus, AllocationStatus.CHECKED_OUT);
      assert.equal(checkoutResult.roomStatus, RoomStatus.VACANT_DIRTY);
      // Reservation is NOT completed because Room B has not completed its stay
      assert.equal(checkoutResult.reservationStatus, ReservationStatus.CONFIRMED);

      const res = await prisma.reservation.findUnique({ where: { id: multiResId } });
      assert.equal(res?.status, ReservationStatus.CONFIRMED);
    });

    it("should check in Room B and check out Room B; reservation automatically transitions to COMPLETED when all rooms finish", async () => {
      // Check in Room B
      await CheckInOutService.checkIn({ allocationId: allocBId }, testStaffUserId);
      const roomBAfterCheckIn = await prisma.room.findUnique({ where: { id: room204CleanId } });
      assert.equal(roomBAfterCheckIn?.status, RoomStatus.OCCUPIED);

      // Check out Room B (last active room in the reservation)
      const checkoutResultB = await CheckInOutService.checkOut(
        { allocationId: allocBId },
        testStaffUserId
      );

      assert.equal(checkoutResultB.allocationStatus, AllocationStatus.CHECKED_OUT);
      assert.equal(checkoutResultB.roomStatus, RoomStatus.VACANT_DIRTY);
      // All rooms completed -> Reservation transitions to COMPLETED
      assert.equal(
        checkoutResultB.reservationStatus,
        ReservationStatus.COMPLETED,
        "Reservation must transition to COMPLETED when all rooms are checked out"
      );

      const res = await prisma.reservation.findUnique({ where: { id: multiResId } });
      assert.equal(res?.status, ReservationStatus.COMPLETED);
    });
  });

  describe("5. Concurrency & Race-Condition Safety", () => {
    let raceAllocId: string;

    before(async () => {
      await prisma.room.update({
        where: { id: room201CleanId },
        data: { status: RoomStatus.VACANT_CLEAN },
      });

      const res = await ReservationService.createReservation(
        {
          customerId: testCustomerId,
          allocations: [
            {
              roomId: room201CleanId,
              arrivalDate: todayStr,
              departureDate: futureStr,
            },
          ],
        },
        testStaffUserId
      );
      raceAllocId = res.rooms[0].id;
    });

    it("should handle concurrent check-in requests on the same allocation safely (exactly one succeeds)", async () => {
      const attempt1 = CheckInOutService.checkIn(
        { allocationId: raceAllocId },
        testStaffUserId
      );
      const attempt2 = CheckInOutService.checkIn(
        { allocationId: raceAllocId },
        testStaffUserId
      );

      const results = await Promise.allSettled([attempt1, attempt2]);
      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      assert.equal(succeeded.length, 1, "Exactly one concurrent check-in must succeed");
      assert.equal(failed.length, 1, "Exactly one concurrent check-in must fail");

      const failReason = (failed[0] as PromiseRejectedResult).reason;
      assert.ok(
        failReason?.message?.includes("already checked in") ||
          failReason?.message?.includes("OCCUPIED"),
        `Expected already checked in or OCCUPIED error but got: ${failReason}`
      );
    });

    it("should handle concurrent check-out requests on the same allocation safely (exactly one succeeds)", async () => {
      const attempt1 = CheckInOutService.checkOut(
        { allocationId: raceAllocId },
        testStaffUserId
      );
      const attempt2 = CheckInOutService.checkOut(
        { allocationId: raceAllocId },
        testStaffUserId
      );

      const results = await Promise.allSettled([attempt1, attempt2]);
      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      assert.equal(succeeded.length, 1, "Exactly one concurrent check-out must succeed");
      assert.equal(failed.length, 1, "Exactly one concurrent check-out must fail");

      const failReason = (failed[0] as PromiseRejectedResult).reason;
      assert.ok(
        failReason?.message?.includes("already been checked out") ||
          failReason?.message?.includes("CHECKED_OUT"),
        `Expected already checked out error but got: ${failReason}`
      );
    });
  });

  describe("6. Role Authorization & Access Control", () => {
    it("should permit RECEPTIONIST role for check-in and check-out operations", () => {
      const permitted = enforceRole(receptionistSession, [
        RoleName.ADMIN,
        RoleName.RECEPTIONIST,
      ]);
      assert.equal(permitted.role, RoleName.RECEPTIONIST);
    });

    it("should permit ADMIN role for check-in and check-out operations", () => {
      const permitted = enforceRole(adminSession, [
        RoleName.ADMIN,
        RoleName.RECEPTIONIST,
      ]);
      assert.equal(permitted.role, RoleName.ADMIN);
    });

    it("should throw AuthError(401) for unauthenticated requests", () => {
      assert.throws(
        () => enforceRole(null, [RoleName.ADMIN, RoleName.RECEPTIONIST]),
        (err: unknown) => err instanceof AuthError && err.statusCode === 401
      );
    });
  });
});
