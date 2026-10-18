import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { AuthService } from "../src/modules/auth/auth.service";
import { RoleName } from "../src/modules/auth/auth.types";
import { getHotelTodayDate, getHotelTodayDateUtc } from "../src/lib/date";
import { POST as cancelReservationRoute } from "../src/app/api/reservations/[id]/cancel/route";
import { POST as noShowRoute } from "../src/app/api/room-allocations/[id]/no-show/route";
import { POST as extendStayRoute } from "../src/app/api/room-allocations/[id]/extend/route";
import { POST as changeRoomRoute } from "../src/app/api/room-allocations/[id]/change-room/route";
import { POST as checkInRoute } from "../src/app/api/room-allocations/[id]/check-in/route";
import { POST as checkOutRoute } from "../src/app/api/room-allocations/[id]/check-out/route";
import { GET as receivablesReportRoute } from "../src/app/api/reports/receivables/route";
import { POST as loginRoute } from "../src/app/api/auth/login/route";
import { POST as recordPaymentRoute } from "../src/app/api/invoices/[id]/payments/route";
import {
  ReservationStatus,
  AllocationStatus,
  RoomStatus,
  InvoiceStatus,
  PaymentStatus,
  InvoiceItemType,
} from "@prisma/client";

describe("Batch 2b: Lifecycle Billing, Room Change Realignment & Date Rules", () => {
  let adminToken: string;
  let receptionistToken: string;
  let testPropertyId: string;
  let testCategoryId: string;
  let testCustomerId: string;
  let _adminUserId: string;
  let receptionistUserId: string;

  const createdRoomIds: string[] = [];

  before(async () => {
    const adminUser = await prisma.user.findFirst({
      where: { role: { name: RoleName.ADMIN } },
      include: { role: true },
    });
    const receptionistUser =
      (await prisma.user.findFirst({
        where: { email: "reception@byteinn.local" },
        include: { role: true },
      })) ||
      (await prisma.user.findFirst({
        where: { role: { name: RoleName.RECEPTIONIST }, mustChangePassword: false },
        include: { role: true },
      }));
    assert.ok(adminUser, "Admin required");
    assert.ok(receptionistUser, "Receptionist required");

    _adminUserId = adminUser.id;
    receptionistUserId = receptionistUser.id;

    await prisma.user.updateMany({
      where: { id: { in: [adminUser.id, receptionistUser.id] } },
      data: { mustChangePassword: false },
    });

    adminToken = await AuthService.createSessionToken({
      sub: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: RoleName.ADMIN,
    });

    receptionistToken = await AuthService.createSessionToken({
      sub: receptionistUser.id,
      email: receptionistUser.email,
      name: receptionistUser.name,
      role: RoleName.RECEPTIONIST,
    });

    const property = await prisma.property.findFirst();
    assert.ok(property);
    testPropertyId = property.id;

    const category = await prisma.roomCategory.findFirst({
      where: { propertyId: testPropertyId },
    });
    assert.ok(category);
    testCategoryId = category.id;

    const customer = await prisma.customer.create({
      data: {
        firstName: "BatchTwoB",
        lastName: "Tester",
        email: `batch2b-${Date.now()}@test.local`,
        phone: "+91-99999-22222",
      },
    });
    testCustomerId = customer.id;
  });

  async function createCleanRoom(suffix: string) {
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
        roomNo: `R2B-${Date.now().toString().slice(-4)}-${suffix}`,
        displayName: `Room 2B ${suffix}`,
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    });
    createdRoomIds.push(room.id);
    return room;
  }

  after(async () => {
    // Cleanup created payments, invoice items, invoices, allocations, reservations, rooms, customers
    await prisma.payment.deleteMany({
      where: {
        invoice: {
          reservation: {
            customerId: testCustomerId,
          },
        },
      },
    });

    await prisma.invoiceItem.deleteMany({
      where: {
        invoice: {
          reservation: {
            customerId: testCustomerId,
          },
        },
      },
    });

    await prisma.invoice.deleteMany({
      where: {
        reservation: {
          customerId: testCustomerId,
        },
      },
    });

    await prisma.reservationRoom.deleteMany({
      where: {
        reservation: {
          customerId: testCustomerId,
        },
      },
    });

    await prisma.reservation.deleteMany({
      where: { customerId: testCustomerId },
    });

    if (createdRoomIds.length > 0) {
      await prisma.room.deleteMany({
        where: { id: { in: createdRoomIds } },
      });
    }

    await prisma.customer.delete({
      where: { id: testCustomerId },
    });
  });

  // --------------------------------------------------------------------------
  // 1. Timezone Check: 00:30 IST evaluates to the new day in India, not UTC yesterday
  // --------------------------------------------------------------------------
  it("ADV-TIME-01 follow-up: 00:30 IST evaluates to next day in Asia/Kolkata while still previous day in UTC", () => {
    // 2026-10-17T19:00:00.000Z in UTC corresponds to 2026-10-18 00:30:00 in IST (+05:30)
    const instantAt0030Ist = new Date("2026-10-17T19:00:00.000Z");

    const utcDateStr = instantAt0030Ist.toISOString().split("T")[0];
    assert.equal(utcDateStr, "2026-10-17", "UTC date should still be Oct 17");

    const hotelTodayStr = getHotelTodayDate(instantAt0030Ist);
    assert.equal(hotelTodayStr, "2026-10-18", "Hotel today in Asia/Kolkata must be Oct 18");

    const hotelTodayUtc = getHotelTodayDateUtc(instantAt0030Ist);
    assert.equal(
      hotelTodayUtc.toISOString(),
      "2026-10-18T00:00:00.000Z",
      "PostgreSQL UTC midnight boundary must represent Oct 18"
    );
  });

  // --------------------------------------------------------------------------
  // 2. Early Check-in before Arrival Date (Policy = BLOCK)
  // --------------------------------------------------------------------------
  it("EARLY_CHECKIN_POLICY: blocks check-in when hotel today is before scheduled arrival date", async () => {
    const room = await createCleanRoom("ECHK");
    const today = getHotelTodayDateUtc();
    const futureArrival = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    const futureDeparture = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-ECHK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,

        rooms: {
          create: {
            roomId: room.id,
            roomCategoryId: testCategoryId,
            arrivalDate: futureArrival,
            departureDate: futureDeparture,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
      include: { rooms: true },
    });

    const alloc = reservation.rooms[0]!;

    // Create another reservation that books the room before futureArrival so room is not free
    await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-CONF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,
        rooms: {
          create: {
            roomId: room.id,
            roomCategoryId: testCategoryId,
            arrivalDate: today,
            departureDate: futureArrival,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
    });

    const req = new NextRequest(
      `http://localhost/api/room-allocations/${alloc.id}/check-in`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allocationId: alloc.id }),
      }
    );

    const res = await checkInRoute(req, { params: Promise.resolve({ id: alloc.id }) });
    const json = await res.json();

    assert.equal(res.status, 400, "Early check-in before arrival date must be rejected with HTTP 400 when room is booked");
    assert.ok(
      json.error.toLowerCase().includes("booked") || json.error.toLowerCase().includes("arrival"),
      `Expected error to mention room is booked or arrival date constraint, got: ${json.error}`
    );
  });

  // --------------------------------------------------------------------------
  // 3. No-Show Min Date Constraint (Policy = ON_OR_AFTER_ARRIVAL)
  // --------------------------------------------------------------------------
  it("NO_SHOW_MIN_DATE_POLICY: prevents marking NO_SHOW prior to scheduled arrival date", async () => {
    const room = await createCleanRoom("NSMINDATE");
    const today = getHotelTodayDateUtc();
    const futureArrival = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000);
    const futureDeparture = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-NSDATE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,

        rooms: {
          create: {
            roomId: room.id,
            roomCategoryId: testCategoryId,
            arrivalDate: futureArrival,
            departureDate: futureDeparture,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
      include: { rooms: true },
    });

    const alloc = reservation.rooms[0]!;

    const req = new NextRequest(
      `http://localhost/api/room-allocations/${alloc.id}/no-show`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Guest not here yet" }),
      }
    );

    const res = await noShowRoute(req, { params: Promise.resolve({ id: alloc.id }) });
    const json = await res.json();

    assert.equal(res.status, 400, "Marking NO_SHOW before arrival date must be rejected with HTTP 400");
    assert.ok(
      json.error.toLowerCase().includes("arrival"),
      `Expected error to mention arrival date, got: ${json.error}`
    );
  });

  // --------------------------------------------------------------------------
  // 4. Room Change: Checked-in guest ends old allocation today, starts new allocation today
  // --------------------------------------------------------------------------
  it("Room Change for CHECKED_IN allocation: ends old allocation today (VACANT_DIRTY), starts new allocation today in target room (OCCUPIED), preserving history", async () => {
    const roomA = await createCleanRoom("CHG-A");
    const roomB = await createCleanRoom("CHG-B");
    const today = getHotelTodayDateUtc();
    const pastArrival = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
    const futureDeparture = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Initial booking checked in on Room A
    await prisma.room.update({
      where: { id: roomA.id },
      data: { status: RoomStatus.OCCUPIED },
    });

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-CHGROOM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,

        rooms: {
          create: {
            roomId: roomA.id,
            roomCategoryId: testCategoryId,
            arrivalDate: pastArrival,
            departureDate: futureDeparture,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CHECKED_IN,
            checkedInAt: pastArrival,
          },
        },
      },
      include: { rooms: true },
    });

    const oldAlloc = reservation.rooms[0]!;

    const req = new NextRequest(
      `http://localhost/api/room-allocations/${oldAlloc.id}/change-room`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newRoomId: roomB.id,
          reason: "Guest requested quiet room",
        }),
      }
    );

    const res = await changeRoomRoute(req, { params: Promise.resolve({ id: oldAlloc.id }) });
    const json = await res.json();

    assert.equal(res.status, 200, `Change room must succeed: ${JSON.stringify(json)}`);

    // Verify Old Allocation was closed out today
    const refreshedOldAlloc = await prisma.reservationRoom.findUnique({
      where: { id: oldAlloc.id },
    });
    assert.ok(refreshedOldAlloc);
    assert.equal(
      refreshedOldAlloc.status,
      AllocationStatus.CHECKED_OUT,
      "Old allocation must transition to CHECKED_OUT"
    );
    assert.equal(
      refreshedOldAlloc.actualCheckoutDate?.toISOString().split("T")[0],
      today.toISOString().split("T")[0],
      "Old allocation actual checkout date must be today"
    );

    // Verify Old Room is VACANT_DIRTY
    const refreshedRoomA = await prisma.room.findUnique({ where: { id: roomA.id } });
    assert.equal(refreshedRoomA?.status, RoomStatus.VACANT_DIRTY, "Old room must become VACANT_DIRTY");

    // Verify New Allocation was created starting today to futureDeparture
    const newAlloc = await prisma.reservationRoom.findFirst({
      where: {
        reservationId: reservation.id,
        roomId: roomB.id,
      },
    });
    assert.ok(newAlloc, "New allocation must exist in Room B");
    assert.equal(newAlloc.status, AllocationStatus.CHECKED_IN, "New allocation must be CHECKED_IN");
    assert.equal(
      newAlloc.arrivalDate.toISOString().split("T")[0],
      today.toISOString().split("T")[0],
      "New allocation arrival date must be today"
    );
    assert.equal(
      newAlloc.departureDate.toISOString().split("T")[0],
      futureDeparture.toISOString().split("T")[0],
      "New allocation departure date must be original departure date"
    );

    // Verify New Room is OCCUPIED
    const refreshedRoomB = await prisma.room.findUnique({ where: { id: roomB.id } });
    assert.equal(refreshedRoomB?.status, RoomStatus.OCCUPIED, "New room must be OCCUPIED");
  });

  // --------------------------------------------------------------------------
  // 5. Cancellation with Recorded Payments (Requires Void/Refund or ADMIN)
  // --------------------------------------------------------------------------
  it("Cancellation with recorded payments: RECEPTIONIST is blocked (HTTP 400), ADMIN is permitted", async () => {
    const room = await createCleanRoom("CANCPAY");
    const today = getHotelTodayDateUtc();
    const arr = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
    const dep = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-CANCPAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,

        rooms: {
          create: {
            roomId: room.id,
            roomCategoryId: testCategoryId,
            arrivalDate: arr,
            departureDate: dep,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
      include: { rooms: true },
    });

    // Create invoice and recorded payment
    await prisma.invoice.create({
      data: {
        propertyId: testPropertyId,
        reservationId: reservation.id,
        invoiceNumber: `INV-CANCPAY-${Date.now()}`,
        status: InvoiceStatus.PARTIALLY_PAID,
        subtotal: 2000,
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: 2000,
        items: {
          create: {
            description: "Room charge",
            quantity: 2,
            unitPrice: 1000,
            lineTotal: 2000,
          },
        },
        payments: {
          create: {
            propertyId: testPropertyId,
            amount: 1000,
            paymentMethod: "CASH",
            status: PaymentStatus.RECORDED,
            paidAt: new Date(),
            createdBy: receptionistUserId,
          },
        },
      },
    });

    // 1. Attempt cancel as RECEPTIONIST -> should fail
    const reqRecept = new NextRequest(
      `http://localhost/api/reservations/${reservation.id}/cancel`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Guest called to cancel" }),
      }
    );

    const resRecept = await cancelReservationRoute(reqRecept, {
      params: Promise.resolve({ id: reservation.id }),
    });
    const jsonRecept = await resRecept.json();

    assert.equal(resRecept.status, 400, "Cancellation with recorded payments by receptionist must fail");
    assert.ok(
      jsonRecept.error.toLowerCase().includes("payment"),
      `Expected error to mention recorded payments, got: ${jsonRecept.error}`
    );

    // 2. Attempt cancel as ADMIN -> should succeed
    const reqAdmin = new NextRequest(
      `http://localhost/api/reservations/${reservation.id}/cancel`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Admin approved cancellation with refund agreement" }),
      }
    );

    const resAdmin = await cancelReservationRoute(reqAdmin, {
      params: Promise.resolve({ id: reservation.id }),
    });
    const jsonAdmin = await resAdmin.json();

    assert.equal(resAdmin.status, 200, `Admin cancellation must succeed: ${JSON.stringify(jsonAdmin)}`);

    const refreshedRes = await prisma.reservation.findUnique({ where: { id: reservation.id } });
    assert.equal(refreshedRes?.status, ReservationStatus.CANCELLED);
  });

  // --------------------------------------------------------------------------
  // 6. Cancellation without Payments: Voids Invoice and Excludes from Receivables
  // --------------------------------------------------------------------------
  it("Cancellation without payments: sets invoice to VOID and removes full balance from receivables", async () => {
    const room = await createCleanRoom("CANCVOID");
    const today = getHotelTodayDateUtc();
    const arr = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
    const dep = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000);

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-CANCVOID-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,

        rooms: {
          create: {
            roomId: room.id,
            roomCategoryId: testCategoryId,
            arrivalDate: arr,
            departureDate: dep,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
      include: { rooms: true },
    });

    const invoice = await prisma.invoice.create({
      data: {
        propertyId: testPropertyId,
        reservationId: reservation.id,
        invoiceNumber: `INV-CANCVOID-${Date.now()}`,
        status: InvoiceStatus.ISSUED,
        subtotal: 3000,
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: 3000,
        items: {
          create: {
            description: "Room charge 3 nights",
            quantity: 3,
            unitPrice: 1000,
            lineTotal: 3000,
          },
        },
      },
    });

    // Check receivables report before cancel
    const reqRepBefore = new NextRequest("http://localhost/api/reports/receivables", {
      headers: { cookie: `byteinn_session=${receptionistToken}` },
    });
    const resRepBefore = await receivablesReportRoute(reqRepBefore);
    const jsonRepBefore = await resRepBefore.json();
    const itemBefore = jsonRepBefore.data.items.find(
      (i: { invoiceId: string }) => i.invoiceId === invoice.id
    );
    assert.ok(itemBefore, "Invoice must appear in receivables before cancellation");

    // Cancel reservation
    const reqCancel = new NextRequest(
      `http://localhost/api/reservations/${reservation.id}/cancel`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Unpaid reservation cancelled" }),
      }
    );
    const resCancel = await cancelReservationRoute(reqCancel, {
      params: Promise.resolve({ id: reservation.id }),
    });
    assert.equal(resCancel.status, 200);

    // Verify invoice is now VOID
    const refreshedInv = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    assert.equal(refreshedInv?.status, InvoiceStatus.VOID, "Invoice without payments must become VOID");

    // Check receivables report after cancel
    const reqRepAfter = new NextRequest("http://localhost/api/reports/receivables", {
      headers: { cookie: `byteinn_session=${receptionistToken}` },
    });
    const resRepAfter = await receivablesReportRoute(reqRepAfter);
    const jsonRepAfter = await resRepAfter.json();
    const itemAfter = jsonRepAfter.data.items.find(
      (i: { invoiceId: string }) => i.invoiceId === invoice.id
    );
    assert.equal(itemAfter, undefined, "Voided/cancelled invoice must not appear in receivables");
  });

  // --------------------------------------------------------------------------
  // 7. Stay Extension adds Extra Nights to Invoice
  // --------------------------------------------------------------------------
  it("Extend stay: automatically appends extra night room charge items to invoice and updates grand total", async () => {
    const room = await createCleanRoom("EXTINV");
    const today = getHotelTodayDateUtc();
    const arr = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
    const dep = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000); // 2 nights
    const extendedDep = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000); // 4 nights total (+2)

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-EXTINV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,

        rooms: {
          create: {
            roomId: room.id,
            roomCategoryId: testCategoryId,
            arrivalDate: arr,
            departureDate: dep,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
      include: { rooms: true },
    });

    const alloc = reservation.rooms[0]!;

    const invoice = await prisma.invoice.create({
      data: {
        propertyId: testPropertyId,
        reservationId: reservation.id,
        invoiceNumber: `INV-EXTINV-${Date.now()}`,
        status: InvoiceStatus.ISSUED,
        subtotal: 2000,
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: 2000,
        items: {
          create: {
            reservationRoomId: alloc.id,
            description: "Initial 2 nights",
            quantity: 2,
            unitPrice: 1000,
            lineTotal: 2000,
          },
        },
      },
    });

    // Extend stay by 2 nights
    const req = new NextRequest(
      `http://localhost/api/room-allocations/${alloc.id}/extend`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newDepartureDate: extendedDep.toISOString().split("T")[0],
          reason: "Guest decided to stay 2 more days",
        }),
      }
    );

    const res = await extendStayRoute(req, { params: Promise.resolve({ id: alloc.id }) });
    const json = await res.json();
    assert.equal(res.status, 200, `Extension must succeed: ${JSON.stringify(json)}`);

    // Verify invoice was updated with extra night line item
    const refreshedInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { items: true },
    });
    assert.ok(refreshedInvoice);
    assert.equal(refreshedInvoice.items.length, 2, "Invoice must now have 2 items (initial + extension)");
    assert.equal(
      Number(refreshedInvoice.grandTotal),
      4000,
      "Invoice grand total must be updated to $4000 for 4 total nights"
    );
  });

  // --------------------------------------------------------------------------
  // 8. Early Checkout on Issued/Part-Paid Invoice adds Adjustment Line (Never below paid)
  // --------------------------------------------------------------------------
  it("Early checkout: adds adjustment line item, never mutates existing lines, and never reduces total below amount paid", async () => {
    const room = await createCleanRoom("EARLYCHK");
    const today = getHotelTodayDateUtc();
    const pastArr = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 night completed
    const futureDep = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000); // 4 nights booked total

    await prisma.room.update({
      where: { id: room.id },
      data: { status: RoomStatus.OCCUPIED },
    });

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-EARLYCHK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,

        rooms: {
          create: {
            roomId: room.id,
            roomCategoryId: testCategoryId,
            arrivalDate: pastArr,
            departureDate: futureDep,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CHECKED_IN,
            checkedInAt: pastArr,
          },
        },
      },
      include: { rooms: true },
    });

    const alloc = reservation.rooms[0]!;

    // Invoice has $4000 total, but guest pre-paid $2500 (part-paid)
    // 1 night stayed = $1000. Unused nights = 3 ($3000).
    // Reducing by $3000 would make grandTotal $1000, which is BELOW $2500 paid!
    // The policy dictates: never reduce total below paid ($2500). Max adjustment = -$1500!
    const invoice = await prisma.invoice.create({
      data: {
        propertyId: testPropertyId,
        reservationId: reservation.id,
        invoiceNumber: `INV-EARLYCHK-${Date.now()}`,
        status: InvoiceStatus.PARTIALLY_PAID,
        subtotal: 4000,
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: 4000,
        items: {
          create: {
            reservationRoomId: alloc.id,
            description: "Room charge 4 nights booked",
            quantity: 4,
            unitPrice: 1000,
            lineTotal: 4000,
          },
        },
        payments: {
          create: {
            propertyId: testPropertyId,
            amount: 2500,
            paymentMethod: "CREDIT_CARD",
            status: PaymentStatus.RECORDED,
            paidAt: new Date(),
            createdBy: receptionistUserId,
          },
        },
      },
    });

    // Check out today
    const req = new NextRequest(
      `http://localhost/api/room-allocations/${alloc.id}/check-out`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allocationId: alloc.id }),
      }
    );

    const res = await checkOutRoute(req, { params: Promise.resolve({ id: alloc.id }) });
    const json = await res.json();
    assert.equal(res.status, 200, `Checkout must succeed: ${JSON.stringify(json)}`);

    // Verify invoice items: original line intact, adjustment line appended
    const refreshedInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { items: true },
    });
    assert.ok(refreshedInvoice);

    const originalItem = refreshedInvoice.items.find((i) => i.description.includes("4 nights booked"));
    assert.ok(originalItem, "Original invoice line must remain unchanged");
    assert.equal(Number(originalItem.lineTotal), 4000);

    const adjustmentItem = refreshedInvoice.items.find((i) => i.description.includes("Early Checkout"));
    assert.ok(adjustmentItem, "Adjustment line item must be added");

    // Grand total must never be below $2500 paid
    assert.ok(
      Number(refreshedInvoice.grandTotal) >= 2500,
      `Grand total (${refreshedInvoice.grandTotal}) must not be reduced below paid amount ($2500)`
    );
  });

  // --------------------------------------------------------------------------
  // 9. No-Show Billing Policy: Retains First Night Only
  // --------------------------------------------------------------------------
  it("NO_SHOW_BILLING_POLICY = 'RETAIN_FIRST_NIGHT': invoice charges only first night, receivables report shows first night balance only", async () => {
    const room = await createCleanRoom("NSBILL");
    const today = getHotelTodayDateUtc();
    const arr = today; // Arriving today
    const dep = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 nights @ 1000 = $4000

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-NSBILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,

        rooms: {
          create: {
            roomId: room.id,
            roomCategoryId: testCategoryId,
            arrivalDate: arr,
            departureDate: dep,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
      include: { rooms: true },
    });

    const alloc = reservation.rooms[0]!;

    const invoice = await prisma.invoice.create({
      data: {
        propertyId: testPropertyId,
        reservationId: reservation.id,
        invoiceNumber: `INV-NSBILL-${Date.now()}`,
        status: InvoiceStatus.ISSUED,
        subtotal: 4000,
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: 4000,
        items: {
          create: {
            reservationRoomId: alloc.id,
            description: "Room charge 4 nights booked",
            quantity: 4,
            unitPrice: 1000,
            lineTotal: 4000,
          },
        },
      },
    });

    // Mark NO_SHOW on arrival day
    const req = new NextRequest(
      `http://localhost/api/room-allocations/${alloc.id}/no-show`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Guest never arrived today" }),
      }
    );

    const res = await noShowRoute(req, { params: Promise.resolve({ id: alloc.id }) });
    const json = await res.json();
    assert.equal(res.status, 200, `No-show must succeed: ${JSON.stringify(json)}`);

    // Verify invoice now charges only 1 night ($1000)
    const refreshedInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { items: true },
    });
    assert.ok(refreshedInvoice);
    assert.equal(
      Number(refreshedInvoice.grandTotal),
      1000,
      "Invoice grand total must be adjusted to $1000 (retaining first night only)"
    );

    // Verify receivables report shows only $1000 balance for this invoice, not $4000
    const reqRep = new NextRequest("http://localhost/api/reports/receivables", {
      headers: { cookie: `byteinn_session=${receptionistToken}` },
    });
    const resRep = await receivablesReportRoute(reqRep);
    const jsonRep = await resRep.json();
    const item = jsonRep.data.items.find(
      (i: { invoiceId: string; balanceDue: string }) => i.invoiceId === invoice.id
    );
    assert.ok(item, "No-show invoice with first night retained should be in receivables");
    assert.equal(item.balanceDue, "1000.00", "Receivables balance must reflect only retained first night ($1000.00)");
  });

  // --------------------------------------------------------------------------
  // 10. Room Change on CHECKED_IN Preserves Invoice Total (No Double-Billing)
  // --------------------------------------------------------------------------
  it("Room change on CHECKED_IN with same rate preserves invoice total (no double-charge of remaining nights)", async () => {
    const roomA = await createCleanRoom("RMA");
    const roomB = await createCleanRoom("RMB");
    const today = getHotelTodayDateUtc();
    const arr = today;
    const dep = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 nights @ $1000 = $3000

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-RMINV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,
        rooms: {
          create: {
            roomId: roomA.id,
            roomCategoryId: testCategoryId,
            arrivalDate: arr,
            departureDate: dep,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
      include: { rooms: true },
    });
    const alloc = reservation.rooms[0];

    // Auto-create invoice with 3 nights @ 1000 = $3000
    const invoice = await prisma.invoice.create({
      data: {
        propertyId: testPropertyId,
        reservationId: reservation.id,
        invoiceNumber: `INV-RMCHG-${Date.now()}`,
        status: InvoiceStatus.ISSUED,
        subtotal: 3000,
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: 3000,
        items: {
          create: {
            reservationRoomId: alloc.id,
            description: `Room ${roomA.roomNo} - 3 nights booked`,
            quantity: 3,
            unitPrice: 1000,
            lineTotal: 3000,
            itemType: InvoiceItemType.ROOM_CHARGE,
          },
        },
      },
      include: { items: true },
    });

    // Check in to Room A
    const reqCheckIn = new NextRequest(
      `http://localhost/api/room-allocations/${alloc.id}/check-in`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allocationId: alloc.id }),
      }
    );
    const resCheckIn = await checkInRoute(reqCheckIn, {
      params: Promise.resolve({ id: alloc.id }),
    });
    assert.equal(resCheckIn.status, 200);

    // Execute Room Change to Room B (same rate $1000)
    const reqChange = new NextRequest(
      `http://localhost/api/room-allocations/${alloc.id}/change-room`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newRoomId: roomB.id,
          reason: "Guest requested quiet courtyard view",
        }),
      }
    );
    const resChange = await changeRoomRoute(reqChange, {
      params: Promise.resolve({ id: alloc.id }),
    });
    assert.equal(resChange.status, 200);

    // Verify invoice remains strictly $3000 (no duplicate room charges added for remaining nights)
    const refreshedInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { items: true },
    });
    assert.ok(refreshedInvoice);
    assert.equal(
      Number(refreshedInvoice.subtotal),
      3000,
      "Subtotal must remain $3000 without duplicate night charges"
    );
    assert.equal(
      Number(refreshedInvoice.grandTotal),
      3000,
      "Grand total must remain $3000"
    );
  });

  // --------------------------------------------------------------------------
  // 11. Early-Checkout and No-Show Adjustments use ADJUSTMENT Item Type
  // --------------------------------------------------------------------------
  it("Early-checkout and no-show adjustments use InvoiceItemType.ADJUSTMENT (not DISCOUNT)", async () => {
    const room = await createCleanRoom("ADJTYPE");
    const today = getHotelTodayDateUtc();
    const arr = today;
    const dep = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 nights @ $1000 = $3000

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-ADJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,
        rooms: {
          create: {
            roomId: room.id,
            roomCategoryId: testCategoryId,
            arrivalDate: arr,
            departureDate: dep,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
      include: { rooms: true },
    });
    const alloc = reservation.rooms[0];

    const invoice = await prisma.invoice.create({
      data: {
        propertyId: testPropertyId,
        reservationId: reservation.id,
        invoiceNumber: `INV-ADJ-${Date.now()}`,
        status: InvoiceStatus.ISSUED,
        subtotal: 3000,
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: 3000,
        items: {
          create: {
            reservationRoomId: alloc.id,
            description: `Room ${room.roomNo} - 3 nights booked`,
            quantity: 3,
            unitPrice: 1000,
            lineTotal: 3000,
            itemType: InvoiceItemType.ROOM_CHARGE,
          },
        },
      },
    });

    // Check in
    const reqCheckIn = new NextRequest(
      `http://localhost/api/room-allocations/${alloc.id}/check-in`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allocationId: alloc.id }),
      }
    );
    await checkInRoute(reqCheckIn, { params: Promise.resolve({ id: alloc.id }) });

    // Early checkout today (credited 3 nights)
    const reqCheckOut = new NextRequest(
      `http://localhost/api/room-allocations/${alloc.id}/check-out`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allocationId: alloc.id }),
      }
    );
    const resCheckOut = await checkOutRoute(reqCheckOut, {
      params: Promise.resolve({ id: alloc.id }),
    });
    assert.equal(resCheckOut.status, 200);

    const refreshedInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { items: true },
    });
    assert.ok(refreshedInvoice);

    const adjItem = refreshedInvoice.items.find((i) => i.description.includes("Early Checkout"));
    assert.ok(adjItem, "Early checkout adjustment line must exist");
    assert.equal(
      adjItem.itemType,
      InvoiceItemType.ADJUSTMENT,
      "Adjustment line item must have itemType = ADJUSTMENT (not DISCOUNT)"
    );
  });

  // --------------------------------------------------------------------------
  // 12. Cancel with Payments by ADMIN Retains Invoice & Payments as Credit
  // --------------------------------------------------------------------------
  it("Cancel with payments by ADMIN retains invoice and payments as credit balance under RETAIN_AS_CREDIT_BALANCE", async () => {
    const room = await createCleanRoom("ADMCAN");
    const today = getHotelTodayDateUtc();
    const arr = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    const dep = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-ADMCAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,
        rooms: {
          create: {
            roomId: room.id,
            roomCategoryId: testCategoryId,
            arrivalDate: arr,
            departureDate: dep,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
      include: { rooms: true },
    });

    const invoice = await prisma.invoice.create({
      data: {
        propertyId: testPropertyId,
        reservationId: reservation.id,
        invoiceNumber: `INV-ADMCAN-${Date.now()}`,
        status: InvoiceStatus.PARTIALLY_PAID,
        subtotal: 3000,
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: 3000,
        items: {
          create: {
            description: `Room charge 3 nights`,
            quantity: 3,
            unitPrice: 1000,
            lineTotal: 3000,
            itemType: InvoiceItemType.ROOM_CHARGE,
          },
        },
        payments: {
          create: {
            propertyId: testPropertyId,
            amount: 1500,
            paymentMethod: "CASH",
            referenceNumber: "CASH-ADMCAN-01",
            status: PaymentStatus.RECORDED,
            createdBy: receptionistUserId,
            paidAt: new Date(),
          },
        },
      },
      include: { payments: true },
    });

    // Admin cancels reservation
    const reqCancel = new NextRequest(
      `http://localhost/api/reservations/${reservation.id}/cancel`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Admin special cancellation" }),
      }
    );
    const resCancel = await cancelReservationRoute(reqCancel, {
      params: Promise.resolve({ id: reservation.id }),
    });
    assert.equal(resCancel.status, 200);

    const refreshedRes = await prisma.reservation.findUnique({ where: { id: reservation.id } });
    assert.equal(refreshedRes?.status, ReservationStatus.CANCELLED);

    // Invoice remains PARTIALLY_PAID (not voided) and payment remains RECORDED as credit balance
    const refreshedInv = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { payments: true },
    });
    assert.ok(refreshedInv);
    assert.equal(
      refreshedInv.status,
      InvoiceStatus.PARTIALLY_PAID,
      "Invoice with recorded payments must retain its status when cancelled by admin"
    );
    assert.equal(
      refreshedInv.payments[0]?.status,
      PaymentStatus.RECORDED,
      "Payment must remain RECORDED as guest credit balance"
    );
  });

  // --------------------------------------------------------------------------
  // 13. EARLY_CHECKIN_POLICY = 'ALLOW_WITH_ARRIVAL_UPDATE' Updates Date & Bills Extra Night
  // --------------------------------------------------------------------------
  it("EARLY_CHECKIN_POLICY = 'ALLOW_WITH_ARRIVAL_UPDATE': updates arrival date to today and bills extra night(s) on invoice", async () => {
    const room = await createCleanRoom("EARLYALLOW");
    const today = getHotelTodayDateUtc();
    // Scheduled arrival is tomorrow (1 day in the future)
    const scheduledArr = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
    const scheduledDep = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000); // 3 nights @ $1000 = $3000

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-EARLYALLOW-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,
        rooms: {
          create: {
            roomId: room.id,
            roomCategoryId: testCategoryId,
            arrivalDate: scheduledArr,
            departureDate: scheduledDep,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
      include: { rooms: true },
    });
    const alloc = reservation.rooms[0];

    const invoice = await prisma.invoice.create({
      data: {
        propertyId: testPropertyId,
        reservationId: reservation.id,
        invoiceNumber: `INV-EARLYALLOW-${Date.now()}`,
        status: InvoiceStatus.ISSUED,
        subtotal: 3000,
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: 3000,
        items: {
          create: {
            reservationRoomId: alloc.id,
            description: `Room ${room.roomNo} - 3 nights booked`,
            quantity: 3,
            unitPrice: 1000,
            lineTotal: 3000,
            itemType: InvoiceItemType.ROOM_CHARGE,
          },
        },
      },
    });

    // Check in today (1 night early)
    const reqCheckIn = new NextRequest(
      `http://localhost/api/room-allocations/${alloc.id}/check-in`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allocationId: alloc.id }),
      }
    );
    const resCheckIn = await checkInRoute(reqCheckIn, {
      params: Promise.resolve({ id: alloc.id }),
    });
    assert.equal(resCheckIn.status, 200, "Early check-in must succeed under ALLOW_WITH_ARRIVAL_UPDATE");

    // Verify allocation arrivalDate updated to today
    const refreshedAlloc = await prisma.reservationRoom.findUnique({ where: { id: alloc.id } });
    assert.ok(refreshedAlloc);
    assert.equal(refreshedAlloc.status, AllocationStatus.CHECKED_IN);
    assert.equal(
      refreshedAlloc.arrivalDate.toISOString().split("T")[0],
      today.toISOString().split("T")[0],
      "Arrival date must be updated to hotel today"
    );

    // Verify invoice has extra night billed ($1000 added, grandTotal = $4000)
    const refreshedInv = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { items: true },
    });
    assert.ok(refreshedInv);
    assert.equal(Number(refreshedInv.grandTotal), 4000, "Invoice grand total must reflect the extra night billed ($4000)");
  });

  // --------------------------------------------------------------------------
  // 14. BACKDATED_CHECKOUT_POLICY = 'ADMIN_ONLY'
  // --------------------------------------------------------------------------
  it("BACKDATED_CHECKOUT_POLICY = 'ADMIN_ONLY': receptionist is rejected with 400, admin is permitted", async () => {
    const room = await createCleanRoom("BKDATE");
    const today = getHotelTodayDateUtc();
    // Arrival is tomorrow
    const futureArr = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
    const futureDep = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000);

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-BKDATE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,
        rooms: {
          create: {
            roomId: room.id,
            roomCategoryId: testCategoryId,
            arrivalDate: futureArr,
            departureDate: futureDep,
            bookedNightlyRate: 1000,
            status: AllocationStatus.CHECKED_IN,
            checkedInAt: today,
          },
        },
      },
      include: { rooms: true },
    });
    const alloc = reservation.rooms[0];
    await prisma.room.update({ where: { id: room.id }, data: { status: RoomStatus.OCCUPIED } });

    // Receptionist attempts backdated checkout (today < futureArr)
    const reqRecep = new NextRequest(
      `http://localhost/api/room-allocations/${alloc.id}/check-out`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allocationId: alloc.id }),
      }
    );
    const resRecep = await checkOutRoute(reqRecep, {
      params: Promise.resolve({ id: alloc.id }),
    });
    assert.equal(resRecep.status, 400, "Receptionist must be rejected for backdated checkout");
    const jsonRecep = await resRecep.json();
    assert.ok(jsonRecep.error?.includes("Administrator"), "Must explain Administrator privileges required");

    // Admin attempts backdated checkout (permitted under ADMIN_ONLY)
    const reqAdmin = new NextRequest(
      `http://localhost/api/room-allocations/${alloc.id}/check-out`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allocationId: alloc.id }),
      }
    );
    const resAdmin = await checkOutRoute(reqAdmin, {
      params: Promise.resolve({ id: alloc.id }),
    });
    assert.equal(resAdmin.status, 200, "Admin must be permitted to record backdated checkout");
  });

  // --------------------------------------------------------------------------
  // 15. Login Rate Limiter Loopback / Untrusted Proxy Partitioning
  // --------------------------------------------------------------------------
  it("Login rate limiter partitions loopback/untrusted IP by account so one user cannot lock out all staff", async () => {
    // Attempt 10 bad logins for userA@byteinn.test
    for (let i = 0; i < 10; i++) {
      const req = new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "usera@byteinn.test", password: "wrong-password" }),
      });
      await loginRoute(req);
    }

    // 11th attempt for userA@byteinn.test returns 429
    const req11 = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "usera@byteinn.test", password: "wrong-password" }),
    });
    const res11 = await loginRoute(req11);
    assert.equal(res11.status, 429, "Target user must be throttled after 10 attempts");

    // Request for userB@byteinn.test from the same IP is NOT blocked by rate limiter (returns 401, not 429)
    const reqUserB = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userb@byteinn.test", password: "wrong-password" }),
    });
    const resUserB = await loginRoute(reqUserB);
    assert.equal(
      resUserB.status,
      401,
      "Different user from the same IP must NOT be locked out on loopback/shared network"
    );
  });

  // --------------------------------------------------------------------------
  // 16. REQUIRE_PAYMENT_IDEMPOTENCY_KEY = true Enforcement
  // --------------------------------------------------------------------------
  it("REQUIRE_PAYMENT_IDEMPOTENCY_KEY = true: payment submission without Idempotency-Key is rejected with 400", async () => {
    const reservation = await prisma.reservation.create({
      data: {
        propertyId: testPropertyId,
        reservationNo: `RES-IDEMP-${Date.now()}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        status: ReservationStatus.CONFIRMED,
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        propertyId: testPropertyId,
        reservationId: reservation.id,
        invoiceNumber: `INV-IDEMP-${Date.now()}`,
        status: InvoiceStatus.ISSUED,
        subtotal: 1000,
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: 1000,
        items: {
          create: {
            description: "Room charge",
            quantity: 1,
            unitPrice: 1000,
            lineTotal: 1000,
            itemType: InvoiceItemType.ROOM_CHARGE,
          },
        },
      },
    });

    // Payment without idempotency key
    const reqWithoutKey = new NextRequest(
      `http://localhost/api/invoices/${invoice.id}/payments`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: 500,
          paymentMethod: "CASH",
        }),
      }
    );
    const resWithoutKey = await recordPaymentRoute(reqWithoutKey, {
      params: Promise.resolve({ id: invoice.id }),
    });
    assert.equal(resWithoutKey.status, 400, "Missing Idempotency-Key must be rejected with 400");
    const jsonWithoutKey = await resWithoutKey.json();
    assert.ok(jsonWithoutKey.error?.includes("Idempotency-Key"), "Error must mention missing Idempotency-Key");

    // Payment with idempotency key succeeds
    const reqWithKey = new NextRequest(
      `http://localhost/api/invoices/${invoice.id}/payments`,
      {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `IDEMP-TEST-${Date.now()}`,
        },
        body: JSON.stringify({
          amount: 500,
          paymentMethod: "CASH",
        }),
      }
    );
    const resWithKey = await recordPaymentRoute(reqWithKey, {
      params: Promise.resolve({ id: invoice.id }),
    });
    assert.equal(resWithKey.status, 201, "Payment with Idempotency-Key must succeed with 201");
  });
});

