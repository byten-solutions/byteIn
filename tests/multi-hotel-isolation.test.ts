import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { RoleName, RoomStatus } from "@prisma/client";
import { UserService } from "../src/modules/users/user.service";
import { AuthService } from "../src/modules/auth/auth.service";
import { ReservationService } from "../src/modules/reservations/reservation.service";
import { CheckInOutService } from "../src/modules/check-in-out/check-in-out.service";
import { ReportsService } from "../src/modules/reports/reports.service";
import { BillingService } from "../src/modules/billing/billing.service";
import { CustomerService } from "../src/modules/customers/customer.service";
import { RoomService } from "../src/modules/rooms/room.service";
import { ForbiddenError, NotFoundError } from "../src/lib/errors";
import { getHotelTodayDateUtc } from "../src/lib/date";
import type { SessionPayload } from "../src/modules/auth/auth.types";
import { resolveScope, AuthError } from "../src/lib/auth-guard";

describe("Multi-Hotel Isolation & Access Control Tests", () => {
  // Test entities
  let propertyA: { id: string; name: string };
  let propertyB: { id: string; name: string };

  let superAdminUser: { id: string; email: string };
  let hotelAAdminUser: { id: string; email: string };
  let hotelARecepUser: { id: string; email: string };
  let hotelBAdminUser: { id: string; email: string };

  let superAdminSession: SessionPayload;
  let hotelAAdminSession: SessionPayload;
  let hotelARecepSession: SessionPayload;
  let hotelBAdminSession: SessionPayload;

  let roomA: { id: string; roomNo: string };
  let roomB: { id: string; roomNo: string };

  let categoryA: { id: string };
  let categoryB: { id: string };

  let reservationAId: string;
  let reservationBId: string;

  let superAdminRoleId: string;
  let recepRoleId: string;

  before(async () => {
    // 1. Roles
    const [superAdminRole, adminRole, recepRole] = await Promise.all([
      prisma.role.findFirstOrThrow({ where: { name: RoleName.SUPER_ADMIN } }),
      prisma.role.findFirstOrThrow({ where: { name: RoleName.ADMIN } }),
      prisma.role.findFirstOrThrow({ where: { name: RoleName.RECEPTIONIST } }),
    ]);

    superAdminRoleId = superAdminRole.id;
    recepRoleId = recepRole.id;

    // 2. Properties
    propertyA = await prisma.property.create({
      data: {
        name: "Test Hotel Alpha",
        city: "Metropolis",
        status: "ACTIVE",
      },
    });

    propertyB = await prisma.property.create({
      data: {
        name: "Test Hotel Beta",
        city: "Gotham",
        status: "ACTIVE",
      },
    });

    // 3. Buildings & Floors
    const [buildingA, buildingB] = await Promise.all([
      prisma.building.create({
        data: { propertyId: propertyA.id, name: "Alpha Main Wing" },
      }),
      prisma.building.create({
        data: { propertyId: propertyB.id, name: "Beta Tower" },
      }),
    ]);

    const [floorA, floorB] = await Promise.all([
      prisma.floor.create({
        data: { buildingId: buildingA.id, floorNo: 1, name: "Alpha Floor 1" },
      }),
      prisma.floor.create({
        data: { buildingId: buildingB.id, floorNo: 1, name: "Beta Floor 1" },
      }),
    ]);

    // 4. Categories & Rooms
    categoryA = await prisma.roomCategory.create({
      data: {
        propertyId: propertyA.id,
        name: "Alpha Deluxe",
        basePrice: 150.0,
        maxOccupancy: 2,
      },
    });

    categoryB = await prisma.roomCategory.create({
      data: {
        propertyId: propertyB.id,
        name: "Beta Suite",
        basePrice: 250.0,
        maxOccupancy: 3,
      },
    });

    roomA = await prisma.room.create({
      data: {
        propertyId: propertyA.id,
        buildingId: buildingA.id,
        floorId: floorA.id,
        roomCategoryId: categoryA.id,
        roomNo: "A-101",
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    });

    roomB = await prisma.room.create({
      data: {
        propertyId: propertyB.id,
        buildingId: buildingB.id,
        floorId: floorB.id,
        roomCategoryId: categoryB.id,
        roomNo: "B-201",
        capacity: 3,
        status: RoomStatus.VACANT_CLEAN,
      },
    });

    // 5. Users
    const dummyPasswordHash = await AuthService.hashPassword("TestPass@123456");

    superAdminUser = await prisma.user.create({
      data: {
        name: "Global Super Admin",
        email: `super_${Date.now()}@byteinn.test`,
        passwordHash: dummyPasswordHash,
        roleId: superAdminRole.id,
        propertyId: null,
        status: "ACTIVE",
      },
    });

    hotelAAdminUser = await prisma.user.create({
      data: {
        name: "Hotel A Manager",
        email: `admin_a_${Date.now()}@byteinn.test`,
        passwordHash: dummyPasswordHash,
        roleId: adminRole.id,
        propertyId: propertyA.id,
        status: "ACTIVE",
      },
    });

    hotelARecepUser = await prisma.user.create({
      data: {
        name: "Hotel A Receptionist",
        email: `recep_a_${Date.now()}@byteinn.test`,
        passwordHash: dummyPasswordHash,
        roleId: recepRole.id,
        propertyId: propertyA.id,
        status: "ACTIVE",
      },
    });

    hotelBAdminUser = await prisma.user.create({
      data: {
        name: "Hotel B Manager",
        email: `admin_b_${Date.now()}@byteinn.test`,
        passwordHash: dummyPasswordHash,
        roleId: adminRole.id,
        propertyId: propertyB.id,
        status: "ACTIVE",
      },
    });

    // 6. Session Payloads
    superAdminSession = {
      sub: superAdminUser.id,
      email: superAdminUser.email,
      name: "Global Super Admin",
      role: RoleName.SUPER_ADMIN,
      propertyId: null,
      property: null,
    };

    hotelAAdminSession = {
      sub: hotelAAdminUser.id,
      email: hotelAAdminUser.email,
      name: "Hotel A Manager",
      role: RoleName.ADMIN,
      propertyId: propertyA.id,
      property: { id: propertyA.id, name: propertyA.name, status: "ACTIVE" },
    };

    hotelARecepSession = {
      sub: hotelARecepUser.id,
      email: hotelARecepUser.email,
      name: "Hotel A Receptionist",
      role: RoleName.RECEPTIONIST,
      propertyId: propertyA.id,
      property: { id: propertyA.id, name: propertyA.name, status: "ACTIVE" },
    };

    hotelBAdminSession = {
      sub: hotelBAdminUser.id,
      email: hotelBAdminUser.email,
      name: "Hotel B Manager",
      role: RoleName.ADMIN,
      propertyId: propertyB.id,
      property: { id: propertyB.id, name: propertyB.name, status: "ACTIVE" },
    };

    // 7. Seed reservations for today
    const today = getHotelTodayDateUtc();
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const customerA = await prisma.customer.create({
      data: { firstName: "Guest", lastName: "Alpha", phone: "+1111111111" },
    });
    const customerB = await prisma.customer.create({
      data: { firstName: "Guest", lastName: "Beta", phone: "+2222222222" },
    });

    const resA = await ReservationService.createReservation(
      {
        customerId: customerA.id,
        allocations: [
          {
            roomId: roomA.id,
            roomCategoryId: categoryA.id,
            arrivalDate: today,
            departureDate: tomorrow,
            bookedNightlyRate: 150.0,
          },
        ],
      },
      hotelAAdminUser.id
    );
    reservationAId = resA.id;

    const resB = await ReservationService.createReservation(
      {
        customerId: customerB.id,
        allocations: [
          {
            roomId: roomB.id,
            roomCategoryId: categoryB.id,
            arrivalDate: today,
            departureDate: tomorrow,
            bookedNightlyRate: 250.0,
          },
        ],
      },
      hotelBAdminUser.id
    );
    reservationBId = resB.id;
  });

  after(async () => {
    // Clean up created entities safely
    if (reservationAId) {
      await prisma.payment.deleteMany({ where: { invoice: { reservationId: reservationAId } } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { reservationId: reservationAId } } });
      await prisma.invoice.deleteMany({ where: { reservationId: reservationAId } });
      await prisma.reservationRoom.deleteMany({ where: { reservationId: reservationAId } });
      await prisma.reservation.deleteMany({ where: { id: reservationAId } });
    }
    if (reservationBId) {
      await prisma.payment.deleteMany({ where: { invoice: { reservationId: reservationBId } } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { reservationId: reservationBId } } });
      await prisma.invoice.deleteMany({ where: { reservationId: reservationBId } });
      await prisma.reservationRoom.deleteMany({ where: { reservationId: reservationBId } });
      await prisma.reservation.deleteMany({ where: { id: reservationBId } });
    }

    await prisma.auditLog.deleteMany({
      where: {
        userId: { in: [superAdminUser.id, hotelAAdminUser.id, hotelARecepUser.id, hotelBAdminUser.id] },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [superAdminUser.id, hotelAAdminUser.id, hotelARecepUser.id, hotelBAdminUser.id] },
      },
    });

    await prisma.room.deleteMany({ where: { id: { in: [roomA.id, roomB.id] } } });
    await prisma.roomCategory.deleteMany({ where: { id: { in: [categoryA.id, categoryB.id] } } });
    await prisma.floor.deleteMany({ where: { building: { propertyId: { in: [propertyA.id, propertyB.id] } } } });
    await prisma.building.deleteMany({ where: { propertyId: { in: [propertyA.id, propertyB.id] } } });
    await prisma.property.deleteMany({ where: { id: { in: [propertyA.id, propertyB.id] } } });
  });

  describe("1. User Management Isolation & Hierarchy", () => {
    it("Super Admin can list users across all hotels and see Super Admins", async () => {
      const users = await UserService.listUsers(superAdminSession);
      assert.ok(users.length >= 4);

      const hasHotelA = users.some((u) => u.id === hotelAAdminUser.id);
      const hasHotelB = users.some((u) => u.id === hotelBAdminUser.id);
      const hasSuper = users.some((u) => u.id === superAdminUser.id);

      assert.equal(hasHotelA, true, "Super Admin must see Hotel A staff");
      assert.equal(hasHotelB, true, "Super Admin must see Hotel B staff");
      assert.equal(hasSuper, true, "Super Admin must see Super Admin accounts");
    });

    it("Hotel A Admin can only see Hotel A staff and cannot see Super Admins or Hotel B staff", async () => {
      const users = await UserService.listUsers(hotelAAdminSession);

      const hasHotelAAdmin = users.some((u) => u.id === hotelAAdminUser.id);
      const hasHotelARecep = users.some((u) => u.id === hotelARecepUser.id);
      const hasHotelBAdmin = users.some((u) => u.id === hotelBAdminUser.id);
      const hasSuper = users.some((u) => u.role === RoleName.SUPER_ADMIN);

      assert.equal(hasHotelAAdmin, true, "Hotel A Admin must see Hotel A admin");
      assert.equal(hasHotelARecep, true, "Hotel A Admin must see Hotel A receptionist");
      assert.equal(hasHotelBAdmin, false, "Hotel A Admin must NOT see Hotel B admin");
      assert.equal(hasSuper, false, "Hotel A Admin must NOT see Super Admin accounts");
    });

    it("Hotel B Admin can only see Hotel B staff and cannot see Hotel A staff", async () => {
      const users = await UserService.listUsers(hotelBAdminSession);

      const hasHotelBAdmin = users.some((u) => u.id === hotelBAdminUser.id);
      const hasHotelAAdmin = users.some((u) => u.id === hotelAAdminUser.id);

      assert.equal(hasHotelBAdmin, true, "Hotel B Admin must see Hotel B admin");
      assert.equal(hasHotelAAdmin, false, "Hotel B Admin must NOT see Hotel A admin");
    });

    it("Hotel A Admin cannot create a user for Hotel B", async () => {
      await assert.rejects(
        async () => {
          await UserService.createUser(
            {
              name: "Intruder User",
              email: `intruder_${Date.now()}@byteinn.test`,
              password: "ValidPass@123456",
              roleId: recepRoleId,
              propertyId: propertyB.id, // Explicitly targeting Hotel B!
            },
            hotelAAdminSession
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.match((err as Error).message, /Cannot create staff for another property/i);
          return true;
        }
      );
    });

    it("Hotel A Admin cannot create a SUPER_ADMIN account", async () => {
      await assert.rejects(
        async () => {
          await UserService.createUser(
            {
              name: "Privilege Escalation",
              email: `escalate_${Date.now()}@byteinn.test`,
              password: "ValidPass@123456",
              roleId: superAdminRoleId,
              propertyId: propertyA.id,
            },
            hotelAAdminSession
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.match((err as Error).message, /Hotel Administrators cannot create Super Admins/i);
          return true;
        }
      );
    });

    it("Hotel A Admin can create a RECEPTIONIST for their hotel", async () => {
      const email = `new_recep_${Date.now()}@byteinn.test`;
      const created = await UserService.createUser(
        {
          name: "Legit Receptionist",
          email,
          password: "ValidPass@123456",
          roleId: recepRoleId,
        },
        hotelAAdminSession
      );

      assert.equal(created.email, email);
      assert.equal(created.propertyId, propertyA.id);
      assert.equal(created.role, RoleName.RECEPTIONIST);

      // Clean up newly created user
      await prisma.auditLog.deleteMany({ where: { userId: created.id } });
      await prisma.user.delete({ where: { id: created.id } });
    });

    it("Hotel A Admin cannot update or delete Hotel B staff", async () => {
      await assert.rejects(
        async () => {
          await UserService.updateUser(
            hotelBAdminUser.id,
            { name: "Hacked Name" },
            hotelAAdminSession
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError || err instanceof NotFoundError);
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await UserService.deleteUser(hotelBAdminUser.id, hotelAAdminSession);
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError || err instanceof NotFoundError);
          return true;
        }
      );
    });

    it("Receptionist cannot perform user management actions", async () => {
      await assert.rejects(
        async () => {
          await UserService.createUser(
            {
              name: "Receptionist Created",
              email: `rec_test_${Date.now()}@byteinn.test`,
              password: "ValidPass@123456",
              roleId: recepRoleId,
            },
            hotelARecepSession
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          return true;
        }
      );
    });
  });

  describe("2. Reservation & Operational Isolation", () => {
    it("Hotel A Admin/Receptionist only receives Hotel A reservations when scoped", async () => {
      const resultA = await ReservationService.getReservations({
        propertyId: propertyA.id,
      });

      const hasResA = resultA.reservations.some((r) => r.id === reservationAId);
      const hasResB = resultA.reservations.some((r) => r.id === reservationBId);

      assert.equal(hasResA, true, "Hotel A query must include Hotel A reservation");
      assert.equal(hasResB, false, "Hotel A query must NOT include Hotel B reservation");
    });

    it("Hotel B Admin/Receptionist only receives Hotel B reservations when scoped", async () => {
      const resultB = await ReservationService.getReservations({
        propertyId: propertyB.id,
      });

      const hasResA = resultB.reservations.some((r) => r.id === reservationAId);
      const hasResB = resultB.reservations.some((r) => r.id === reservationBId);

      assert.equal(hasResA, false, "Hotel B query must NOT include Hotel A reservation");
      assert.equal(hasResB, true, "Hotel B query must include Hotel B reservation");
    });

    it("Super Admin query without propertyId returns reservations across both hotels", async () => {
      const resultAll = await ReservationService.getReservations({});

      const hasResA = resultAll.reservations.some((r) => r.id === reservationAId);
      const hasResB = resultAll.reservations.some((r) => r.id === reservationBId);

      assert.equal(hasResA, true, "Global query must include Hotel A reservation");
      assert.equal(hasResB, true, "Global query must include Hotel B reservation");
    });
  });

  describe("3. Daily Operations & Reports Hotel Scoping", () => {
    it("Daily arrivals for Hotel A only includes Hotel A rooms", async () => {
      const today = getHotelTodayDateUtc();
      const arrivalsA = await CheckInOutService.getDailyArrivals(today, propertyA.id);

      const hasRoomA = arrivalsA.some((a) => a.roomId === roomA.id);
      const hasRoomB = arrivalsA.some((a) => a.roomId === roomB.id);

      assert.equal(hasRoomA, true, "Hotel A arrivals must include Room A");
      assert.equal(hasRoomB, false, "Hotel A arrivals must NOT include Room B");
    });

    it("Daily departures for Hotel B does not leak Hotel A data", async () => {
      const today = getHotelTodayDateUtc();
      const departuresB = await CheckInOutService.getDailyDepartures(today, propertyB.id);

      const hasRoomA = departuresB.some((a) => a.roomId === roomA.id);
      assert.equal(hasRoomA, false, "Hotel B departures must NOT include Room A");
    });

    it("Occupancy report for Hotel A calculates exclusively Hotel A room inventory", async () => {
      const today = getHotelTodayDateUtc();
      const nextWeek = new Date(today);
      nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

      const reportA = await ReportsService.getOccupancyReport({
        startDate: today.toISOString().split("T")[0],
        endDate: nextWeek.toISOString().split("T")[0],
        propertyId: propertyA.id,
      });

      // Hotel A has 1 room (roomA)
      assert.equal(reportA.totalRooms, 1, "Hotel A occupancy report must count exactly 1 room");
    });

    it("Revenue report for Hotel B calculates exclusively Hotel B revenues", async () => {
      const today = getHotelTodayDateUtc();
      const nextWeek = new Date(today);
      nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

      const reportB = await ReportsService.getRevenueReport({
        startDate: today.toISOString().split("T")[0],
        endDate: nextWeek.toISOString().split("T")[0],
        propertyId: propertyB.id,
      });

      assert.ok(reportB !== null);
      assert.ok(typeof reportB.totalInvoiced === "string");
      assert.ok(typeof reportB.totalCollected === "string");
    });

    describe("resolveScope fail-closed access control", () => {
      it("hotel ADMIN without propertyId throws AuthError 403", () => {
        const unassignedAdminSession: SessionPayload = {
          ...hotelAAdminSession,
          propertyId: null,
          property: null,
        };
        assert.throws(
          () => resolveScope(unassignedAdminSession),
          (err: unknown) => err instanceof AuthError && err.statusCode === 403
        );
      });

      it("hotel RECEPTIONIST without propertyId throws AuthError 403", () => {
        const unassignedRecepSession: SessionPayload = {
          ...hotelARecepSession,
          propertyId: null,
          property: null,
        };
        assert.throws(
          () => resolveScope(unassignedRecepSession),
          (err: unknown) => err instanceof AuthError && err.statusCode === 403
        );
      });

      it("hotel ADMIN requesting a different hotel throws AuthError 403", () => {
        assert.throws(
          () => resolveScope(hotelAAdminSession, propertyB.id),
          (err: unknown) => err instanceof AuthError && err.statusCode === 403
        );
      });

      it("hotel ADMIN requesting their assigned hotel returns their hotel id", () => {
        const scope = resolveScope(hotelAAdminSession, propertyA.id);
        assert.equal(scope, propertyA.id);
      });

      it("hotel ADMIN without requesting a property returns their assigned hotel id", () => {
        const scope = resolveScope(hotelAAdminSession);
        assert.equal(scope, propertyA.id);
      });

      it("SUPER_ADMIN requesting specific hotel returns that hotel id", () => {
        const scope = resolveScope(superAdminSession, propertyB.id);
        assert.equal(scope, propertyB.id);
      });

      it("SUPER_ADMIN without property returns null when allowSuperAdminGlobal is true", () => {
        const scope = resolveScope(superAdminSession, null, { allowSuperAdminGlobal: true });
        assert.equal(scope, null);
      });

      it("SUPER_ADMIN without property throws AuthError 400 when allowSuperAdminGlobal is false", () => {
        assert.throws(
          () => resolveScope(superAdminSession, null, { allowSuperAdminGlobal: false }),
          (err: unknown) => err instanceof AuthError && err.statusCode === 400
        );
      });
    });
  });

  describe("4. Adversarial Isolation & Invariant Checks", () => {
    it("cross-hotel reservation mutations are strictly rejected", async () => {
      // Receptionist at Hotel A tries to cancel Hotel B reservation
      await assert.rejects(
        async () => {
          await ReservationService.cancelReservation(
            reservationBId,
            hotelARecepUser.id,
            "Attacking hotel B reservation",
            RoleName.RECEPTIONIST,
            propertyA.id
          );
        },
        NotFoundError
      );

      // Receptionist at Hotel A tries to check in Hotel B allocation
      const allocB = await prisma.reservationRoom.findFirstOrThrow({
        where: { reservationId: reservationBId },
      });
      await assert.rejects(
        async () => {
          await CheckInOutService.checkIn(
            { allocationId: allocB.id },
            hotelARecepUser.id,
            propertyA.id
          );
        },
        NotFoundError
      );
    });

    it("cross-hotel invoice mutations are strictly rejected", async () => {
      let invoiceB = await prisma.invoice.findFirst({
        where: { reservationId: reservationBId },
      });
      if (!invoiceB) {
        const created = await BillingService.createInvoiceForReservation(
          { reservationId: reservationBId },
          hotelBAdminUser.id,
          propertyB.id
        );
        invoiceB = await prisma.invoice.findUniqueOrThrow({
          where: { id: created.id },
        });
      }

      // Hotel A tries to record payment on Hotel B invoice
      await assert.rejects(
        async () => {
          await BillingService.recordPayment(
            invoiceB.id,
            { amount: 50, paymentMethod: "CASH" },
            hotelARecepUser.id,
            propertyA.id
          );
        },
        NotFoundError
      );

      // Hotel A tries to create invoice for Hotel B reservation
      await assert.rejects(
        async () => {
          await BillingService.createInvoiceForReservation(
            { reservationId: reservationBId },
            hotelARecepUser.id,
            propertyA.id
          );
        },
        ForbiddenError
      );
    });

    it("cross-hotel room allocation rejected by DB trigger enforce_reservation_room_property()", async () => {
      const today = getHotelTodayDateUtc();
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      await assert.rejects(
        async () => {
          await prisma.$executeRaw`
            INSERT INTO reservation_rooms (
              id, reservation_id, room_id, room_category_id, arrival_date, departure_date, booked_nightly_rate, status, updated_at
            ) VALUES (
              'adversarial-alloc-trigger', ${reservationAId}, ${roomB.id}, ${categoryB.id}, ${today}, ${tomorrow}, 100, 'CONFIRMED', NOW()
            )
          `;
        },
        (err: Error) => {
          return err.message.includes("belongs to a different property than reservation");
        }
      );
    });

    it("cross-hotel customer isolation and cross-hotel reservation visibility", async () => {
      const today = getHotelTodayDateUtc();
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      // 1. Customer C registered at Hotel B
      const customerC = await CustomerService.createCustomer(
        { firstName: "Isolated", lastName: "Guest", phone: "+3333333333" },
        propertyB.id
      );

      // 2. Hotel A receptionist cannot see Customer C
      const listA1 = await CustomerService.getCustomers({ propertyId: propertyA.id });
      assert.equal(
        listA1.customers.some((c) => c.id === customerC.id),
        false,
        "Customer C must not appear in Hotel A customer list"
      );

      await assert.rejects(
        async () => CustomerService.getCustomerById(customerC.id, propertyA.id),
        NotFoundError
      );

      // 3. Customer C books at Hotel A
      const roomAData = await prisma.room.findUniqueOrThrow({ where: { id: roomA.id } });
      const roomA2 = await prisma.room.create({
        data: {
          propertyId: propertyA.id,
          buildingId: roomAData.buildingId,
          floorId: roomAData.floorId,
          roomCategoryId: categoryA.id,
          roomNo: "A-102",
          capacity: 2,
          status: RoomStatus.VACANT_CLEAN,
        },
      });

      const resCA = await ReservationService.createReservation(
        {
          customerId: customerC.id,
          allocations: [
            {
              roomId: roomA2.id,
              roomCategoryId: categoryA.id,
              arrivalDate: today,
              departureDate: tomorrow,
              bookedNightlyRate: 150.0,
            },
          ],
        },
        hotelAAdminUser.id
      );

      // 4. Hotel A receptionist now CAN see Customer C because they have a reservation at Hotel A
      const listA2 = await CustomerService.getCustomers({ propertyId: propertyA.id });
      assert.equal(
        listA2.customers.some((c) => c.id === customerC.id),
        true,
        "Customer C must now appear in Hotel A customer list"
      );

      const custDetails = await CustomerService.getCustomerById(customerC.id, propertyA.id);
      assert.equal(custDetails.id, customerC.id);

      // Clean up Customer C booking and room
      await prisma.payment.deleteMany({ where: { invoice: { reservationId: resCA.id } } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { reservationId: resCA.id } } });
      await prisma.invoice.deleteMany({ where: { reservationId: resCA.id } });
      await prisma.reservationRoom.deleteMany({ where: { reservationId: resCA.id } });
      await prisma.reservation.deleteMany({ where: { id: resCA.id } });
      await prisma.room.delete({ where: { id: roomA2.id } });
      await prisma.customer.delete({ where: { id: customerC.id } });
    });

    it("invariant drift check: all reservations have property_id matching all their rooms", async () => {
      const resDrift = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint as count FROM (
          SELECT r.id FROM reservations r
          JOIN reservation_rooms rr ON rr.reservation_id = r.id
          JOIN rooms rm ON rm.id = rr.room_id
          WHERE rm.property_id != r.property_id
        ) m;
      `;
      assert.equal(Number(resDrift[0]?.count ?? 0), 0, "No reservation room property drift permitted");
    });

    it("invariant drift check: all invoices have property_id matching reservation.property_id", async () => {
      const invDrift = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint as count FROM invoices i
        JOIN reservations r ON i.reservation_id = r.id
        WHERE i.property_id != r.property_id;
      `;
      assert.equal(Number(invDrift[0]?.count ?? 0), 0, "No invoice property drift permitted");
    });

    it("invariant drift check: all payments have property_id matching invoice.property_id", async () => {
      const payDrift = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint as count FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE p.property_id != i.property_id;
      `;
      assert.equal(Number(payDrift[0]?.count ?? 0), 0, "No payment property drift permitted");
    });

    it("cache isolation: write in hotel A does not invalidate or corrupt hotel B cached summaries", async () => {
      const summaryBBefore = await BillingService.getBillingSummary(propertyB.id);
      const roomsBBefore = await RoomService.getRoomsSummary(propertyB.id);

      // Perform mutation and scoped invalidation in Hotel A
      BillingService.invalidateBillingCache(propertyA.id);
      RoomService.invalidateRoomsCache(propertyA.id);

      const summaryBAfter = await BillingService.getBillingSummary(propertyB.id);
      const roomsBAfter = await RoomService.getRoomsSummary(propertyB.id);

      assert.deepEqual(summaryBBefore, summaryBAfter, "Hotel B billing summary must remain unaffected by Hotel A invalidation");
      assert.deepEqual(roomsBBefore, roomsBAfter, "Hotel B room summary must remain unaffected by Hotel A invalidation");
    });
  });
});
