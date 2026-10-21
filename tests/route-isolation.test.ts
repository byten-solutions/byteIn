import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { RoleName, RoomStatus, ReservationStatus, InvoiceStatus, PaymentStatus } from "@prisma/client";
import { AuthService } from "../src/modules/auth/auth.service";

// Handlers
import * as ReservationsRoute from "../src/app/api/reservations/route";
import * as ReservationDetailRoute from "../src/app/api/reservations/[id]/route";
import * as ReservationCancelRoute from "../src/app/api/reservations/[id]/cancel/route";
import * as InvoicesRoute from "../src/app/api/invoices/route";
import * as InvoiceDetailRoute from "../src/app/api/invoices/[id]/route";
import * as InvoicePaymentsRoute from "../src/app/api/invoices/[id]/payments/route";
import * as RoomsRoute from "../src/app/api/rooms/route";
import * as RoomDetailRoute from "../src/app/api/rooms/[id]/route";
import * as RoomStatusRoute from "../src/app/api/rooms/[id]/status/route";
import * as RoomAllocCheckInRoute from "../src/app/api/room-allocations/[id]/check-in/route";
import * as RoomAllocCheckOutRoute from "../src/app/api/room-allocations/[id]/check-out/route";
import * as RoomAllocCancelRoute from "../src/app/api/room-allocations/[id]/cancel/route";
import * as RoomAllocExtendRoute from "../src/app/api/room-allocations/[id]/extend/route";
import * as RoomAllocNoShowRoute from "../src/app/api/room-allocations/[id]/no-show/route";
import * as CheckInOutDailyRoute from "../src/app/api/check-in-out/daily/route";
import * as CustomersRoute from "../src/app/api/customers/route";
import * as CustomerDetailRoute from "../src/app/api/customers/[id]/route";
import * as DailyOpsCountsRoute from "../src/app/api/reports/daily-operations/counts/route";
import * as DailyOpsListRoute from "../src/app/api/reports/daily-operations/list/route";

describe("Permanent Route Isolation Sweep Test", () => {
  let propA: { id: string };
  let propB: { id: string };

  let tokenAdminA: string;
  let tokenRecepA: string;

  let hotelB: {
    buildingId: string;
    floorId: string;
    categoryId: string;
    roomId: string;
    room2Id: string;
    customerId: string;
    reservationId: string;
    zeroReservationId: string;
    allocationId: string;
    invoiceId: string;
    zeroInvoiceId: string;
    itemId: string;
    paymentId: string;
  };

  function getAllRouteFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        getAllRouteFiles(filePath, fileList);
      } else if (file === "route.ts") {
        fileList.push(filePath);
      }
    }
    return fileList;
  }

  before(async () => {
    // 1. Create Property A & B
    const time = Date.now();
    propA = await prisma.property.create({
      data: { name: `Isolation Hotel A ${time}`, city: "Alpha City", status: "ACTIVE" },
    });
    propB = await prisma.property.create({
      data: { name: `Isolation Hotel B ${time}`, city: "Beta City", status: "ACTIVE" },
    });

    // 2. Roles
    const [adminRole, recepRole] = await Promise.all([
      prisma.role.findFirstOrThrow({ where: { name: RoleName.ADMIN } }),
      prisma.role.findFirstOrThrow({ where: { name: RoleName.RECEPTIONIST } }),
    ]);

    // 3. Users in Property A
    const userAdminA = await prisma.user.create({
      data: {
        name: "Hotel A Admin",
        email: `admin-a-${time}@byteinn.test`,
        passwordHash: await AuthService.hashPassword("TestPass@123"),
        roleId: adminRole.id,
        propertyId: propA.id,
        status: "ACTIVE",
        tokenVersion: 1,
      },
    });

    const userRecepA = await prisma.user.create({
      data: {
        name: "Hotel A Recep",
        email: `recep-a-${time}@byteinn.test`,
        passwordHash: await AuthService.hashPassword("TestPass@123"),
        roleId: recepRole.id,
        propertyId: propA.id,
        status: "ACTIVE",
        tokenVersion: 1,
      },
    });

    tokenAdminA = await AuthService.createSessionToken({
      sub: userAdminA.id,
      email: userAdminA.email,
      name: userAdminA.name,
      role: RoleName.ADMIN,
      propertyId: propA.id,
      tokenVersion: 1,
    });

    tokenRecepA = await AuthService.createSessionToken({
      sub: userRecepA.id,
      email: userRecepA.email,
      name: userRecepA.name,
      role: RoleName.RECEPTIONIST,
      propertyId: propA.id,
      tokenVersion: 1,
    });

    // 4. Hotel B Hierarchy & Records
    const userAdminB = await prisma.user.create({
      data: {
        name: "Hotel B Admin",
        email: `admin-b-${time}@byteinn.test`,
        passwordHash: await AuthService.hashPassword("TestPass@123"),
        roleId: adminRole.id,
        propertyId: propB.id,
        status: "ACTIVE",
        tokenVersion: 1,
      },
    });

    const buildingB = await prisma.building.create({
      data: { name: "Tower B", propertyId: propB.id },
    });
    const floorB = await prisma.floor.create({
      data: { name: "Floor 1", floorNo: 1, buildingId: buildingB.id },
    });
    const categoryB = await prisma.roomCategory.create({
      data: { name: `Suite B ${time}`, basePrice: 2000, maxOccupancy: 2, propertyId: propB.id },
    });
    const roomB1 = await prisma.room.create({
      data: {
        roomNo: `B-101-${time}`,
        propertyId: propB.id,
        buildingId: buildingB.id,
        floorId: floorB.id,
        roomCategoryId: categoryB.id,
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    });
    const roomB2 = await prisma.room.create({
      data: {
        roomNo: `B-102-${time}`,
        propertyId: propB.id,
        buildingId: buildingB.id,
        floorId: floorB.id,
        roomCategoryId: categoryB.id,
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    });
    const customerB = await prisma.customer.create({
      data: {
        firstName: "Beta",
        lastName: "Guest",
        phone: `987654${Math.floor(1000 + Math.random() * 9000)}`,
        registeredPropertyId: propB.id,
      },
    });

    // Hotel B Standard Reservation with 1 room allocation
    const resB = await prisma.reservation.create({
      data: {
        propertyId: propB.id,
        reservationNo: `RES-B-${time}`,
        customerId: customerB.id,
        createdBy: userAdminB.id,
        status: ReservationStatus.CONFIRMED,
      },
    });
    const allocB = await prisma.reservationRoom.create({
      data: {
        reservationId: resB.id,
        roomId: roomB1.id,
        roomCategoryId: categoryB.id,
        arrivalDate: new Date("2026-10-20T00:00:00Z"),
        departureDate: new Date("2026-10-22T00:00:00Z"),
        bookedNightlyRate: 2000,
        status: ReservationStatus.CONFIRMED,
      },
    });
    const invB = await prisma.invoice.create({
      data: {
        propertyId: propB.id,
        reservationId: resB.id,
        invoiceNumber: `INV-B-${time}`,
        subtotal: 4000,
        grandTotal: 4000,
        status: InvoiceStatus.ISSUED,
      },
    });
    const itemB = await prisma.invoiceItem.create({
      data: {
        invoiceId: invB.id,
        reservationRoomId: allocB.id,
        description: "Room charge",
        quantity: 2,
        unitPrice: 2000,
        lineTotal: 4000,
        itemType: "ROOM_CHARGE",
      },
    });
    const payB = await prisma.payment.create({
      data: {
        propertyId: propB.id,
        invoiceId: invB.id,
        amount: 1000,
        paymentMethod: "CASH",
        status: PaymentStatus.RECORDED,
        paidAt: new Date(),
        createdBy: userAdminB.id,
      },
    });

    // Zero-room reservation in Hotel B
    const zeroResB = await prisma.reservation.create({
      data: {
        propertyId: propB.id,
        reservationNo: `RES-B-ZERO-${time}`,
        customerId: customerB.id,
        createdBy: userAdminB.id,
        status: ReservationStatus.CONFIRMED,
      },
    });
    const zeroInvB = await prisma.invoice.create({
      data: {
        propertyId: propB.id,
        reservationId: zeroResB.id,
        invoiceNumber: `INV-B-ZERO-${time}`,
        subtotal: 0,
        grandTotal: 0,
        status: InvoiceStatus.DRAFT,
      },
    });

    hotelB = {
      buildingId: buildingB.id,
      floorId: floorB.id,
      categoryId: categoryB.id,
      roomId: roomB1.id,
      room2Id: roomB2.id,
      customerId: customerB.id,
      reservationId: resB.id,
      zeroReservationId: zeroResB.id,
      allocationId: allocB.id,
      invoiceId: invB.id,
      zeroInvoiceId: zeroInvB.id,
      itemId: itemB.id,
      paymentId: payB.id,
    };
  });

  after(async () => {
    // Cleanup property records
    await prisma.payment.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { propertyId: { in: [propA.id, propB.id] } } } });
    await prisma.invoice.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.reservationRoom.deleteMany({ where: { room: { propertyId: { in: [propA.id, propB.id] } } } });
    await prisma.reservation.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.room.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.roomCategory.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.floor.deleteMany({ where: { building: { propertyId: { in: [propA.id, propB.id] } } } });
    await prisma.building.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.customer.deleteMany({ where: { registeredPropertyId: { in: [propA.id, propB.id] } } });
    await prisma.user.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.property.deleteMany({ where: { id: { in: [propA.id, propB.id] } } });
  });

  // Helper to assert domain rejection
  async function assertDomainRejection(res: Response, routeName: string) {
    const status = res.status;
    assert.ok(
      status === 403 || status === 404 || status === 400,
      `[${routeName}] Expected 403, 404, or 400, got ${status}`
    );

    const contentType = res.headers.get("content-type") || "";
    assert.ok(
      contentType.includes("application/json"),
      `[${routeName}] Response must be JSON (not a framework HTML 404), got: ${contentType}`
    );

    const body = await res.json();
    assert.ok(
      typeof body.error === "string" || typeof body.message === "string",
      `[${routeName}] Response must contain error description in JSON, got: ${JSON.stringify(body)}`
    );
  }

  function makeReq(url: string, method: string, token: string, body?: object): NextRequest {
    return new NextRequest(url, {
      method,
      headers: {
        cookie: `byteinn_session=${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  it("1. Automatically discovers all routes and enforces complete coverage or visible allowlist", () => {
    const apiRoot = path.resolve(process.cwd(), "src/app/api");
    const allFiles = getAllRouteFiles(apiRoot).map((p) =>
      path.relative(process.cwd(), p).replace(/\\/g, "/")
    );

    const ALLOWLIST: Record<string, string> = {
      "src/app/api/auth/login/route.ts": "Public credential exchange",
      "src/app/api/auth/logout/route.ts": "Public cookie clearance",
      "src/app/api/auth/change-password/route.ts": "User own-password self-service update",
      "src/app/api/auth/me/route.ts": "User own-profile self-inspection",
      "src/app/api/auth/verify-role/route.ts": "Role verification utility",
      "src/app/api/health/route.ts": "Public health probe",
      "src/app/api/amenities/route.ts": "Global platform lookup table",
      "src/app/api/roles/route.ts": "Global platform roles lookup",
      "src/app/api/properties/route.ts": "SuperAdmin property onboarding and listing",
      "src/app/api/properties/[id]/route.ts": "Property metadata management",
      "src/app/api/properties/[id]/buildings/route.ts": "Property buildings management",
      "src/app/api/buildings/[id]/floors/route.ts": "Building floors management",
      "src/app/api/users/route.ts": "Platform user management",
      "src/app/api/users/[id]/route.ts": "User administration",
    };

    const COVERED_ROUTES = new Set<string>([
      "src/app/api/reservations/route.ts",
      "src/app/api/reservations/[id]/route.ts",
      "src/app/api/reservations/[id]/cancel/route.ts",
      "src/app/api/invoices/route.ts",
      "src/app/api/invoices/[id]/route.ts",
      "src/app/api/invoices/[id]/issue/route.ts",
      "src/app/api/invoices/[id]/items/route.ts",
      "src/app/api/invoices/[id]/items/[itemId]/route.ts",
      "src/app/api/invoices/[id]/payments/route.ts",
      "src/app/api/invoices/[id]/payments/[paymentId]/void/route.ts",
      "src/app/api/rooms/route.ts",
      "src/app/api/rooms/[id]/route.ts",
      "src/app/api/rooms/[id]/status/route.ts",
      "src/app/api/room-categories/route.ts",
      "src/app/api/room-categories/[id]/route.ts",
      "src/app/api/room-allocations/[id]/check-in/route.ts",
      "src/app/api/room-allocations/[id]/check-out/route.ts",
      "src/app/api/room-allocations/[id]/extend/route.ts",
      "src/app/api/room-allocations/[id]/cancel/route.ts",
      "src/app/api/room-allocations/[id]/change-room/route.ts",
      "src/app/api/room-allocations/[id]/no-show/route.ts",
      "src/app/api/check-in-out/daily/route.ts",
      "src/app/api/customers/route.ts",
      "src/app/api/customers/[id]/route.ts",
      "src/app/api/availability/route.ts",
      "src/app/api/reports/availability-grid/route.ts",
      "src/app/api/reports/occupancy/route.ts",
      "src/app/api/reports/revenue/route.ts",
      "src/app/api/reports/reservations/route.ts",
      "src/app/api/reports/daily-operations/route.ts",
      "src/app/api/reports/daily-operations/counts/route.ts",
      "src/app/api/reports/daily-operations/list/route.ts",
      "src/app/api/reports/collections/route.ts",
      "src/app/api/reports/receivables/route.ts",
      "src/app/api/reports/discounts/route.ts",
    ]);

    for (const f of allFiles) {
      const isHandled = COVERED_ROUTES.has(f) || ALLOWLIST[f] !== undefined;
      assert.ok(
        isHandled,
        `Uncovered API route found! ${f} must either be covered in isolation tests or listed in ALLOWLIST with an explicit rationale.`
      );
    }
  });

  it("2. Blocks Hotel A Admin and Receptionist from cross-property entity access (Hotel B IDs)", async () => {
    const roles = [
      { name: "ADMIN", token: tokenAdminA },
      { name: "RECEPTIONIST", token: tokenRecepA },
    ];

    for (const role of roles) {
      // 1. Single Reservation by ID
      const resRes = await ReservationDetailRoute.GET(
        makeReq(`http://localhost/api/reservations/${hotelB.reservationId}`, "GET", role.token),
        { params: Promise.resolve({ id: hotelB.reservationId }) }
      );
      await assertDomainRejection(resRes, `${role.name} GET /api/reservations/[id]`);

      // 2. Zero-room Reservation by ID
      const resZeroRes = await ReservationDetailRoute.GET(
        makeReq(`http://localhost/api/reservations/${hotelB.zeroReservationId}`, "GET", role.token),
        { params: Promise.resolve({ id: hotelB.zeroReservationId }) }
      );
      await assertDomainRejection(resZeroRes, `${role.name} GET /api/reservations/[zeroId]`);

      // 3. Cancel Hotel B Reservation
      const resCancel = await ReservationCancelRoute.POST(
        makeReq(`http://localhost/api/reservations/${hotelB.reservationId}/cancel`, "POST", role.token, { reason: "Hack" }),
        { params: Promise.resolve({ id: hotelB.reservationId }) }
      );
      await assertDomainRejection(resCancel, `${role.name} POST /api/reservations/[id]/cancel`);

      // 4. Single Invoice by ID
      const resInv = await InvoiceDetailRoute.GET(
        makeReq(`http://localhost/api/invoices/${hotelB.invoiceId}`, "GET", role.token),
        { params: Promise.resolve({ id: hotelB.invoiceId }) }
      );
      await assertDomainRejection(resInv, `${role.name} GET /api/invoices/[id]`);

      // 5. Zero-room Invoice by ID
      const resZeroInv = await InvoiceDetailRoute.GET(
        makeReq(`http://localhost/api/invoices/${hotelB.zeroInvoiceId}`, "GET", role.token),
        { params: Promise.resolve({ id: hotelB.zeroInvoiceId }) }
      );
      await assertDomainRejection(resZeroInv, `${role.name} GET /api/invoices/[zeroId]`);

      // 6. Record Payment on Hotel B Invoice
      const resPay = await InvoicePaymentsRoute.POST(
        makeReq(`http://localhost/api/invoices/${hotelB.invoiceId}/payments`, "POST", role.token, {
          amount: 50,
          paymentMethod: "CASH",
          idempotencyKey: `iso-pay-${Date.now()}-${Math.random()}`,
        }),
        { params: Promise.resolve({ id: hotelB.invoiceId }) }
      );
      await assertDomainRejection(resPay, `${role.name} POST /api/invoices/[id]/payments`);

      // 7. Single Room by ID
      const resRoom = await RoomDetailRoute.GET(
        makeReq(`http://localhost/api/rooms/${hotelB.roomId}`, "GET", role.token),
        { params: Promise.resolve({ id: hotelB.roomId }) }
      );
      await assertDomainRejection(resRoom, `${role.name} GET /api/rooms/[id]`);

      // 8. Room Status Update on Hotel B Room (Closed Defect 1)
      const resRoomStatus = await RoomStatusRoute.PATCH(
        makeReq(`http://localhost/api/rooms/${hotelB.roomId}/status`, "PATCH", role.token, {
          status: RoomStatus.MAINTENANCE,
          notes: "Attempt cross-hotel status change",
        }),
        { params: Promise.resolve({ id: hotelB.roomId }) }
      );
      await assertDomainRejection(resRoomStatus, `${role.name} PATCH /api/rooms/[id]/status`);

      // 9. Single Customer by ID
      const resCust = await CustomerDetailRoute.GET(
        makeReq(`http://localhost/api/customers/${hotelB.customerId}`, "GET", role.token),
        { params: Promise.resolve({ id: hotelB.customerId }) }
      );
      await assertDomainRejection(resCust, `${role.name} GET /api/customers/[id]`);

      // 10. Room Allocation Check-in
      const resCheckIn = await RoomAllocCheckInRoute.POST(
        makeReq(`http://localhost/api/room-allocations/${hotelB.allocationId}/check-in`, "POST", role.token, {}),
        { params: Promise.resolve({ id: hotelB.allocationId }) }
      );
      await assertDomainRejection(resCheckIn, `${role.name} POST /api/room-allocations/[id]/check-in`);

      // 11. Room Allocation Check-out
      const resCheckOut = await RoomAllocCheckOutRoute.POST(
        makeReq(`http://localhost/api/room-allocations/${hotelB.allocationId}/check-out`, "POST", role.token, {}),
        { params: Promise.resolve({ id: hotelB.allocationId }) }
      );
      await assertDomainRejection(resCheckOut, `${role.name} POST /api/room-allocations/[id]/check-out`);

      // 12. Room Allocation Extend
      const resExtend = await RoomAllocExtendRoute.POST(
        makeReq(`http://localhost/api/room-allocations/${hotelB.allocationId}/extend`, "POST", role.token, {
          newDepartureDate: "2026-10-25",
        }),
        { params: Promise.resolve({ id: hotelB.allocationId }) }
      );
      await assertDomainRejection(resExtend, `${role.name} POST /api/room-allocations/[id]/extend`);

      // 13. Room Allocation Cancel
      const resAllocCancel = await RoomAllocCancelRoute.POST(
        makeReq(`http://localhost/api/room-allocations/${hotelB.allocationId}/cancel`, "POST", role.token, {
          reason: "Cross-property hack",
        }),
        { params: Promise.resolve({ id: hotelB.allocationId }) }
      );
      await assertDomainRejection(resAllocCancel, `${role.name} POST /api/room-allocations/[id]/cancel`);

      // 14. Room Allocation No-Show
      const resNoShow = await RoomAllocNoShowRoute.POST(
        makeReq(`http://localhost/api/room-allocations/${hotelB.allocationId}/no-show`, "POST", role.token, {}),
        { params: Promise.resolve({ id: hotelB.allocationId }) }
      );
      await assertDomainRejection(resNoShow, `${role.name} POST /api/room-allocations/[id]/no-show`);
    }
  });

  it("3. Enforces property isolation across lists and query-param overrides (?propertyId=<B>)", async () => {
    // 1. GET /api/check-in-out/daily with ?propertyId=B (Closed Defect 2)
    // Non-superadmin cannot inspect Hotel B daily operations -> 403 Forbidden
    const reqDaily = makeReq(`http://localhost/api/check-in-out/daily?propertyId=${propB.id}`, "GET", tokenRecepA);
    const resDaily = await CheckInOutDailyRoute.GET(reqDaily);
    assert.equal(resDaily.status, 403, "Query override ?propertyId=B must be rejected with 403");

    // 2. GET /api/reservations?propertyId=B -> 403 Forbidden
    const reqRes = makeReq(`http://localhost/api/reservations?propertyId=${propB.id}`, "GET", tokenAdminA);
    const resRes = await ReservationsRoute.GET(reqRes);
    assert.equal(resRes.status, 403, "Query override ?propertyId=B must be rejected with 403");

    // 3. GET /api/invoices?propertyId=B -> 403 Forbidden
    const reqInv = makeReq(`http://localhost/api/invoices?propertyId=${propB.id}`, "GET", tokenAdminA);
    const resInv = await InvoicesRoute.GET(reqInv);
    assert.equal(resInv.status, 403, "Query override ?propertyId=B must be rejected with 403");

    // 4. GET /api/rooms?propertyId=B -> 403 Forbidden
    const reqRooms = makeReq(`http://localhost/api/rooms?propertyId=${propB.id}`, "GET", tokenAdminA);
    const resRooms = await RoomsRoute.GET(reqRooms);
    assert.equal(resRooms.status, 403, "Query override ?propertyId=B must be rejected with 403");

    // 5. GET /api/customers?propertyId=B -> 403 Forbidden
    const reqCust = makeReq(`http://localhost/api/customers?propertyId=${propB.id}`, "GET", tokenAdminA);
    const resCust = await CustomersRoute.GET(reqCust);
    assert.equal(resCust.status, 403, "Query override ?propertyId=B must be rejected with 403");

    // 5a. GET /api/reports/daily-operations/counts?propertyId=B -> 403 Forbidden
    const reqCounts = makeReq(`http://localhost/api/reports/daily-operations/counts?propertyId=${propB.id}`, "GET", tokenAdminA);
    const resCounts = await DailyOpsCountsRoute.GET(reqCounts);
    assert.equal(resCounts.status, 403, "Query override ?propertyId=B on counts must be rejected with 403");

    // 5b. GET /api/reports/daily-operations/list?propertyId=B -> 403 Forbidden
    const reqList = makeReq(`http://localhost/api/reports/daily-operations/list?type=arrivals&propertyId=${propB.id}`, "GET", tokenAdminA);
    const resList = await DailyOpsListRoute.GET(reqList);
    assert.equal(resList.status, 403, "Query override ?propertyId=B on list must be rejected with 403");

    // 6. Normal scoped requests for Hotel A return 200 and never contain Hotel B data
    const reqResOwn = makeReq(`http://localhost/api/reservations`, "GET", tokenAdminA);
    const resResOwn = await ReservationsRoute.GET(reqResOwn);
    assert.equal(resResOwn.status, 200);
    const bodyResOwn = await resResOwn.json();
    for (const r of bodyResOwn.data?.reservations ?? bodyResOwn.reservations ?? []) {
      assert.notEqual(r.id, hotelB.reservationId, "Must not leak Hotel B reservation");
      assert.notEqual(r.id, hotelB.zeroReservationId, "Must not leak Hotel B zero-room reservation");
    }

    const reqRoomsOwn = makeReq(`http://localhost/api/rooms`, "GET", tokenAdminA);
    const resRoomsOwn = await RoomsRoute.GET(reqRoomsOwn);
    assert.equal(resRoomsOwn.status, 200);
    const bodyRoomsOwn = await resRoomsOwn.json();
    for (const rm of bodyRoomsOwn.rooms ?? []) {
      assert.notEqual(rm.id, hotelB.roomId, "Must not leak Hotel B room");
    }
  });
});
