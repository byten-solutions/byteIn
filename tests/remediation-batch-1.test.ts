import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { AuthService } from "../src/modules/auth/auth.service";
import { RoleName } from "../src/modules/auth/auth.types";
import { getHotelTodayDate, getHotelTodayDateUtc, HOTEL_TIMEZONE } from "../src/lib/date";
import { POST as loginRoute } from "../src/app/api/auth/login/route";
import { POST as voidPaymentRoute } from "../src/app/api/invoices/[id]/payments/[paymentId]/void/route";
import { POST as recordPaymentRoute } from "../src/app/api/invoices/[id]/payments/route";
import { GET as occupancyReportRoute } from "../src/app/api/reports/occupancy/route";
import { GET as receivablesReportRoute } from "../src/app/api/reports/receivables/route";
import { ReservationStatus, AllocationStatus, RoomStatus, PaymentStatus } from "@prisma/client";
import { loginRateLimiter } from "../src/lib/rate-limiter";

describe("Batch 1 Remediations: Adversarial Audit Fixes", () => {
  let adminToken: string;
  let receptionistToken: string;
  let testPropertyId: string;
  let testCategoryId: string;
  let testCustomerId: string;
  let adminUserId: string;
  let receptionistUserId: string;

  before(async () => {
    // 1. Locate seeded users
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

    assert.ok(adminUser, "Admin user required for test");
    assert.ok(receptionistUser, "Receptionist user required for test");

    adminUserId = adminUser.id;
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

    // 2. Locate or create property, room category, room, and customer
    const property = await prisma.property.findFirst();
    assert.ok(property, "Property required for test");
    testPropertyId = property.id;

    const category = await prisma.roomCategory.findFirst({
      where: { propertyId: testPropertyId },
    });
    assert.ok(category, "RoomCategory required for test");
    testCategoryId = category.id;

    const customer = await prisma.customer.create({
      data: {
        firstName: "BatchOne",
        lastName: "Remediation",
        email: `batch1-${Date.now()}@remediation.test`,
        phone: "+91-99999-00001",
      },
    });
    testCustomerId = customer.id;
  });

  const freshRoomIds: string[] = [];

  async function getFreshRoom() {
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
        roomNo: `R-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`,
        displayName: "Batch 1 Temp Room",
        capacity: existing.capacity || 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    });
    freshRoomIds.push(room.id);
    return room;
  }

  after(async () => {
    // Reset login rate limiter keys
    loginRateLimiter.reset("login:ip:127.0.0.1");

    // Clean up created payments, invoice items, invoices, reservation rooms, reservations, rooms, customer
    await prisma.payment.deleteMany({
      where: {
        OR: [
          { referenceNumber: { contains: "IDEMP" } },
          { invoice: { invoiceNumber: { contains: "TEST" } } },
          { invoice: { invoiceNumber: { contains: "INV-" } } },
        ],
      },
    });

    await prisma.invoiceItem.deleteMany({
      where: {
        invoice: {
          OR: [
            { invoiceNumber: { contains: "TEST" } },
            { invoiceNumber: { contains: "INV-" } },
          ],
        },
      },
    });

    await prisma.invoice.deleteMany({
      where: {
        OR: [
          { invoiceNumber: { contains: "TEST" } },
          { invoiceNumber: { contains: "INV-" } },
        ],
      },
    });

    if (testCustomerId) {
      await prisma.reservationRoom.deleteMany({
        where: {
          reservation: {
            customerId: testCustomerId,
          },
        },
      });

      await prisma.reservation.deleteMany({
        where: {
          customerId: testCustomerId,
        },
      });
    }

    if (freshRoomIds.length > 0) {
      await prisma.room.deleteMany({
        where: { id: { in: freshRoomIds } },
      });
    }

    if (testCustomerId) {
      await prisma.customer.deleteMany({
        where: { id: testCustomerId },
      });
    }
  });

  // =========================================================================
  // ADV-TIME-01: Centralized Hotel-Timezone "Today" Helper (Asia/Kolkata)
  // =========================================================================
  describe("ADV-TIME-01: Hotel Timezone Helper & Midnight-5:30 AM Boundary Handling", () => {
    it("should evaluate the hotel's today date as 2026-10-18 when local IST is 02:00 AM on 18 Oct (even though UTC is 17 Oct 20:30)", () => {
      // 2:00 AM IST on October 18, 2026 = 20:30 UTC on October 17, 2026
      const istMorning = new Date("2026-10-18T02:00:00+05:30");

      // Raw naive UTC split would incorrectly give yesterday:
      const naiveUtcDateStr = istMorning.toISOString().split("T")[0];
      assert.equal(naiveUtcDateStr, "2026-10-17", "Naive UTC split shifts backward by one day");

      // The hotel timezone helper must return the correct property-local date
      const hotelToday = getHotelTodayDate(istMorning, HOTEL_TIMEZONE);
      assert.equal(hotelToday, "2026-10-18", "Hotel today helper must evaluate to local property date in Asia/Kolkata");

      const hotelTodayUtc = getHotelTodayDateUtc(istMorning, HOTEL_TIMEZONE);
      assert.equal(hotelTodayUtc.toISOString(), "2026-10-18T00:00:00.000Z");
    });
  });

  // =========================================================================
  // ADV-AUTH-01: Payment Voiding IDOR & Route Parameter Mismatch
  // =========================================================================
  describe("ADV-AUTH-01: IDOR & Route Param Mismatch in Payment Voiding Endpoint", () => {
    it("should reject voiding when payment does not belong to the route parameter invoice ID", async () => {
      // Create test invoice and payment
      const invA = await prisma.invoice.create({
        data: {
          reservationId: (
            await prisma.reservation.create({
              data: {
                reservationNo: `TEST-RES-AUTH-${Date.now()}`,
                customerId: testCustomerId,
                status: ReservationStatus.CONFIRMED,
                createdBy: receptionistUserId,
              },
            })
          ).id,
          invoiceNumber: `INV-AUTH-${Date.now()}`,
          subtotal: 500,
          grandTotal: 500,
          status: "ISSUED",
        },
      });

      const paymentA = await prisma.payment.create({
        data: {
          invoiceId: invA.id,
          amount: 200,
          paymentMethod: "CASH",
          status: PaymentStatus.RECORDED,
          paidAt: new Date(),
          createdBy: receptionistUserId,
        },
      });

      // Attempt to void paymentA using a mismatched/fake invoice ID in the route URL
      const mismatchedInvoiceId = "00000000-0000-0000-0000-000000000000";
      const req = new NextRequest(
        `http://localhost:3000/api/invoices/${mismatchedInvoiceId}/payments/${paymentA.id}/void`,
        {
          method: "POST",
          headers: {
            cookie: `byteinn_session=${receptionistToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "Duplicate payment entry" }),
        }
      );

      const res = await voidPaymentRoute(req, {
        params: Promise.resolve({ id: mismatchedInvoiceId, paymentId: paymentA.id }),
      });

      const body = await res.json();
      assert.notEqual(res.status, 200, "Mismatched invoice ID in void request must not return 200");
      assert.ok(
        res.status === 400 || res.status === 404,
        `Expected HTTP 400 or 404, got ${res.status}`
      );
      assert.match(
        body.error,
        /does not belong to the specified invoice|not found/i,
        "Error message must indicate relationship mismatch"
      );

      // Verify payment was NOT voided in database
      const checkPayment = await prisma.payment.findUnique({
        where: { id: paymentA.id },
      });
      assert.equal(checkPayment?.status, PaymentStatus.RECORDED);
    });
  });

  // =========================================================================
  // ADV-SESS-01: IP Rate-Limiter Bypass via Client-Controlled X-Forwarded-For
  // =========================================================================
  describe("ADV-SESS-01: IP Rate-Limiter Bypass Prevention Under Untrusted Proxies", () => {
    it("should trigger HTTP 429 when rotating X-Forwarded-For headers with TRUST_PROXY_HEADERS=false", async () => {
      loginRateLimiter.reset("login:ip:127.0.0.1");
      loginRateLimiter.reset("login:email:target-user@byteinn.local");
      loginRateLimiter.reset("login:ip-account:127.0.0.1:target-user@byteinn.local");

      let received429 = false;
      // Send failed attempts with rotating client-controlled X-Forwarded-For headers
      for (let i = 1; i <= 11; i++) {
        const req = new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": `192.168.10.${i}`,
          },
          body: JSON.stringify({
            email: "target-user@byteinn.local",
            password: "wrong-password",
          }),
        });

        const res = await loginRoute(req);
        if (res.status === 429) {
          received429 = true;
          const body = await res.json();
          assert.match(body.error, /Too many (login attempts|failed attempts)/i);
          break;
        }
      }

      assert.ok(
        received429,
        "Spoofing X-Forwarded-For must NOT bypass the rate limiter when TRUST_PROXY_HEADERS=false"
      );
    });
  });

  // =========================================================================
  // ADV-BIL-04: Payment Submission Idempotency
  // =========================================================================
  describe("ADV-BIL-04: Payment Submission Idempotency via Idempotency-Key", () => {
    it("should return the existing payment and prevent double-charging when the same Idempotency-Key is reused", async () => {
      // Create test invoice with $400 balance
      const resv = await prisma.reservation.create({
        data: {
          reservationNo: `TEST-RES-IDEMP-${Date.now()}`,
          customerId: testCustomerId,
          status: ReservationStatus.CONFIRMED,
          createdBy: receptionistUserId,
        },
      });

      const inv = await prisma.invoice.create({
        data: {
          reservationId: resv.id,
          invoiceNumber: `INV-IDEMP-${Date.now()}`,
          subtotal: 400,
          grandTotal: 400,
          status: "ISSUED",
        },
      });

      const idempotencyKey = `idemp-key-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // 1. First payment submission ($100)
      const req1 = new NextRequest(`http://localhost:3000/api/invoices/${inv.id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          cookie: `byteinn_session=${receptionistToken}`,
        },
        body: JSON.stringify({
          amount: 100,
          paymentMethod: "CARD",
          referenceNumber: "TXN-001",
        }),
      });

      const res1 = await recordPaymentRoute(req1, {
        params: Promise.resolve({ id: inv.id }),
      });
      assert.equal(res1.status, 201, "First payment must succeed with 201 Created");
      const data1 = await res1.json();
      const firstPaymentId = data1.data.receipt.paymentId;

      // 2. Duplicate payment submission with the same Idempotency-Key ($100)
      const req2 = new NextRequest(`http://localhost:3000/api/invoices/${inv.id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          cookie: `byteinn_session=${receptionistToken}`,
        },
        body: JSON.stringify({
          amount: 100,
          paymentMethod: "CARD",
          referenceNumber: "TXN-001",
        }),
      });

      const res2 = await recordPaymentRoute(req2, {
        params: Promise.resolve({ id: inv.id }),
      });
      assert.ok(
        res2.status === 200 || res2.status === 201,
        "Idempotent retry must succeed without error"
      );
      const data2 = await res2.json();
      assert.equal(
        data2.data.receipt.paymentId,
        firstPaymentId,
        "Must return original payment receipt instead of creating a second charge"
      );

      // Verify database contains only ONE payment record for this idempotency key
      const payments = await prisma.payment.findMany({
        where: { invoiceId: inv.id },
      });
      assert.equal(payments.length, 1, "Only one payment record must exist in database");
      assert.equal(Number(payments[0]?.amount), 100, "Only $100 must be recorded, not $200");
    });
  });

  // =========================================================================
  // ADV-DATA-01: Restrict on Booking and Financial Foreign Keys
  // =========================================================================
  describe("ADV-DATA-01: Enforce Restrict on Booking and Financial Foreign Keys", () => {
    it("should prevent deleting a reservation when room allocations exist (onDelete: Restrict)", async () => {
      const resv = await prisma.reservation.create({
        data: {
          reservationNo: `TEST-RES-RESTRICT-${Date.now()}`,
          customerId: testCustomerId,
          status: ReservationStatus.CONFIRMED,
          createdBy: adminUserId,
        },
      });

      const freshRoom = await getFreshRoom();
      await prisma.reservationRoom.create({
        data: {
          reservationId: resv.id,
          roomId: freshRoom.id,
          roomCategoryId: testCategoryId,
          arrivalDate: new Date("2026-11-01T00:00:00.000Z"),
          departureDate: new Date("2026-11-03T00:00:00.000Z"),
          bookedNightlyRate: 1500,
          status: AllocationStatus.CONFIRMED,
        },
      });

      // Attempting to delete the reservation directly should throw a foreign key restriction error
      await assert.rejects(
        async () => {
          await prisma.reservation.delete({
            where: { id: resv.id },
          });
        },
        (err: Error) => {
          return (
            err.message.includes("Foreign key constraint violated") ||
            err.message.includes("P2003") ||
            err.message.includes("violates foreign key constraint")
          );
        },
        "Deleting reservation with allocations must fail under Restrict foreign key constraint"
      );
    });

    it("should prevent deleting an invoice when invoice items exist (onDelete: Restrict)", async () => {
      const resv = await prisma.reservation.create({
        data: {
          reservationNo: `TEST-RES-INV-${Date.now()}`,
          customerId: testCustomerId,
          status: ReservationStatus.CONFIRMED,
          createdBy: adminUserId,
        },
      });

      const inv = await prisma.invoice.create({
        data: {
          reservationId: resv.id,
          invoiceNumber: `INV-RESTRICT-${Date.now()}`,
          subtotal: 100,
          grandTotal: 100,
          status: "ISSUED",
        },
      });

      await prisma.invoiceItem.create({
        data: {
          invoiceId: inv.id,
          description: "Room charge",
          quantity: 1,
          unitPrice: 100,
          lineTotal: 100,
        },
      });

      // Attempting to delete the invoice directly should throw a foreign key restriction error
      await assert.rejects(
        async () => {
          await prisma.invoice.delete({
            where: { id: inv.id },
          });
        },
        (err: Error) => {
          return (
            err.message.includes("Foreign key constraint violated") ||
            err.message.includes("P2003") ||
            err.message.includes("violates foreign key constraint")
          );
        },
        "Deleting invoice with items must fail under Restrict foreign key constraint"
      );
    });
  });

  // =========================================================================
  // ADV-REP-01: Realized vs On-the-Books (OTB) Occupancy Reporting
  // =========================================================================
  describe("ADV-REP-01: Occupancy Reports Exclude Unarrived CONFIRMED Bookings from Historical Realized Occupancy", () => {
    it("should NOT count unarrived CONFIRMED allocations from past dates toward realized occupied rooms or room revenue", async () => {
      const pastArrival = new Date("2026-09-01T00:00:00.000Z");
      const pastDeparture = new Date("2026-09-03T00:00:00.000Z");

      // Create a past reservation that remained in CONFIRMED (never checked in / no-show)
      const resv = await prisma.reservation.create({
        data: {
          reservationNo: `TEST-RES-PAST-${Date.now()}`,
          customerId: testCustomerId,
          status: ReservationStatus.CONFIRMED,
          createdBy: adminUserId,
        },
      });

      const freshRoom = await getFreshRoom();
      await prisma.reservationRoom.create({
        data: {
          reservationId: resv.id,
          roomId: freshRoom.id,
          roomCategoryId: testCategoryId,
          arrivalDate: pastArrival,
          departureDate: pastDeparture,
          bookedNightlyRate: 9999,
          status: AllocationStatus.CONFIRMED, // Left in CONFIRMED
        },
      });

      // Query occupancy report for that past date range via HTTP route handler
      const req = new NextRequest(
        "http://localhost:3000/api/reports/occupancy?startDate=2026-09-01&endDate=2026-09-02",
        {
          method: "GET",
          headers: {
            cookie: `byteinn_session=${adminToken}`,
          },
        }
      );

      const res = await occupancyReportRoute(req);
      assert.equal(res.status, 200);
      const jsonRes = await res.json();
      const data = jsonRes.data || jsonRes;

      // Realized occupied nights for past unarrived confirmed allocations must be 0
      const day1 = data.dailyBreakdown.find((d: { date: string }) => d.date === "2026-09-01");
      assert.ok(day1, "Day 2026-09-01 must exist in daily breakdown");
      assert.equal(
        day1.occupiedRooms,
        0,
        "Unarrived CONFIRMED booking in the past must NOT count toward realized occupiedRooms"
      );
      assert.equal(
        day1.roomRevenue,
        "0.00",
        "Unarrived CONFIRMED booking in the past must NOT generate realized roomRevenue"
      );
    });
  });

  // =========================================================================
  // ADV-REP-02: Receivables Aging Report Categorization (IN_HOUSE / FUTURE / DEPARTED)
  // =========================================================================
  describe("ADV-REP-02: Receivables Report Labels Future Bookings as FUTURE (Not DEPARTED)", () => {
    it("should categorize future unarrived reservations as FUTURE and exclude them from departed debtors", async () => {
      const futureArrival = new Date("2026-12-24T00:00:00.000Z");
      const futureDeparture = new Date("2026-12-28T00:00:00.000Z");

      // Create future Christmas booking with auto-generated invoice and balance due
      const resv = await prisma.reservation.create({
        data: {
          reservationNo: `TEST-RES-XMAS-${Date.now()}`,
          customerId: testCustomerId,
          status: ReservationStatus.CONFIRMED,
          createdBy: receptionistUserId,
        },
      });

      const freshRoom = await getFreshRoom();
      await prisma.reservationRoom.create({
        data: {
          reservationId: resv.id,
          roomId: freshRoom.id,
          roomCategoryId: testCategoryId,
          arrivalDate: futureArrival,
          departureDate: futureDeparture,
          bookedNightlyRate: 2000,
          status: AllocationStatus.CONFIRMED,
        },
      });

      const inv = await prisma.invoice.create({
        data: {
          reservationId: resv.id,
          invoiceNumber: `INV-XMAS-${Date.now()}`,
          subtotal: 8000,
          grandTotal: 8000,
          status: "ISSUED",
        },
      });

      // Query receivables report via HTTP route handler
      const req = new NextRequest("http://localhost:3000/api/reports/receivables", {
        method: "GET",
        headers: {
          cookie: `byteinn_session=${adminToken}`,
        },
      });

      const res = await receivablesReportRoute(req);
      assert.equal(res.status, 200);
      const jsonRes = await res.json();
      const data = jsonRes.data || jsonRes;

      const item = data.items.find((i: { invoiceId: string }) => i.invoiceId === inv.id);
      assert.ok(item, "Future invoice must appear in receivables list");

      // ADV-REP-02 invariant: future unarrived reservations must NOT be labeled DEPARTED
      assert.equal(
        item.guestStayStatus,
        "FUTURE",
        "Future unarrived reservation must have guestStayStatus: 'FUTURE', not 'DEPARTED'"
      );
    });
  });
});
