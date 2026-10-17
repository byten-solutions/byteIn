import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  RoleName,
  ReservationStatus,
  AllocationStatus,
  RoomStatus,
  InvoiceStatus,
  PaymentStatus,
  InvoiceItemType,
} from "@prisma/client";
import { AuthService } from "@/modules/auth/auth.service";
import { getHotelTodayDateUtc } from "@/lib/date";

// Route handlers
import { POST as voidPaymentRoute } from "@/app/api/invoices/[id]/payments/[paymentId]/void/route";
import { GET as listUsersRoute, POST as createUserRoute } from "@/app/api/users/route";
import {
  PATCH as updateUserRoute,
  DELETE as deleteUserRoute,
} from "@/app/api/users/[id]/route";
import { POST as changePasswordRoute } from "@/app/api/auth/change-password/route";
import { GET as discountsReportRoute } from "@/app/api/reports/discounts/route";
import { GET as listRoomsRoute } from "@/app/api/rooms/route";

describe("Batch 3: User Administration, Void Windows, Password Lifecycle & Concession Reporting", () => {
  let adminUserId: string;
  let adminToken: string;
  let receptionistUserId: string;
  let receptionistToken: string;
  let testCustomerId: string;
  let testPropertyId: string;
  let testCategoryId: string;
  let adminRoleId: string;
  let receptionistRoleId: string;

  before(async () => {
    // 1. Roles
    const adminRole = await prisma.role.findFirst({ where: { name: RoleName.ADMIN } });
    const recepRole = await prisma.role.findFirst({ where: { name: RoleName.RECEPTIONIST } });
    assert.ok(adminRole, "Admin role must exist");
    assert.ok(recepRole, "Receptionist role must exist");
    adminRoleId = adminRole.id;
    receptionistRoleId = recepRole.id;

    // 2. Admin User
    let admin = await prisma.user.findFirst({ where: { email: "admin@byteinn.local" } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          name: "System Admin",
          email: "admin@byteinn.local",
          passwordHash: await AuthService.hashPassword("Admin@123456"),
          roleId: adminRoleId,
          status: "ACTIVE",
          mustChangePassword: false,
          tokenVersion: 1,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: admin.id },
        data: { status: "ACTIVE", tokenVersion: 1, mustChangePassword: false },
      });
    }
    adminUserId = admin.id;
    adminToken = await AuthService.createSessionToken({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: RoleName.ADMIN,
      tokenVersion: 1,
    });

    // 3. Receptionist User
    let recep = await prisma.user.findFirst({ where: { email: "reception@byteinn.local" } });
    if (!recep) {
      recep = await prisma.user.create({
        data: {
          name: "Front Desk Staff",
          email: "reception@byteinn.local",
          passwordHash: await AuthService.hashPassword("Reception@123456"),
          roleId: receptionistRoleId,
          status: "ACTIVE",
          mustChangePassword: false,
          tokenVersion: 1,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: recep.id },
        data: { status: "ACTIVE", tokenVersion: 1, mustChangePassword: false },
      });
    }
    receptionistUserId = recep.id;
    receptionistToken = await AuthService.createSessionToken({
      sub: recep.id,
      email: recep.email,
      name: recep.name,
      role: RoleName.RECEPTIONIST,
      tokenVersion: 1,
    });

    // 4. Test Customer
    let customer = await prisma.customer.findFirst();
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          firstName: "Audit",
          lastName: "Guest",
          phone: "9988776655",
          email: "audit.guest@example.com",
        },
      });
    }
    testCustomerId = customer.id;

    // 5. Test Property & Category & Room
    let property = await prisma.property.findFirst();
    if (!property) {
      property = await prisma.property.create({
        data: {
          name: "Test Hotel",
          status: "ACTIVE",
        },
      });
    }
    testPropertyId = property.id;

    let category = await prisma.roomCategory.findFirst();
    if (!category) {
      category = await prisma.roomCategory.create({
        data: {
          name: "Deluxe Suite",
          basePrice: 3000,
          maxOccupancy: 2,
        },
      });
    }
    testCategoryId = category.id;

    let building = await prisma.building.findFirst();
    if (!building) {
      building = await prisma.building.create({
        data: {
          name: "Main Tower",
          propertyId: testPropertyId,
        },
      });
    }

    let floor = await prisma.floor.findFirst();
    if (!floor) {
      floor = await prisma.floor.create({
        data: {
          floorNo: 1,
          name: "1st Floor",
          buildingId: building.id,
        },
      });
    }

    let room = await prisma.room.findFirst();
    if (!room) {
      room = await prisma.room.create({
        data: {
          roomNo: "B301",
          propertyId: testPropertyId,
          buildingId: building.id,
          floorId: floor.id,
          roomCategoryId: testCategoryId,
          capacity: 2,
          status: RoomStatus.VACANT_CLEAN,
        },
      });
    }
  });

  // =========================================================================
  // SECTION 1: VOID WINDOW AUTHORIZATION (Same-day vs Older)
  // =========================================================================
  describe("1. Void Window Authorization: Receptionist same-business-day vs older payments", () => {
    it("allows receptionist to void a payment recorded on the same business day", async () => {
      const today = getHotelTodayDateUtc();
      const resv = await prisma.reservation.create({
        data: {
          reservationNo: `RES-VOID-SAME-${Date.now()}`,
          customerId: testCustomerId,
          createdBy: receptionistUserId,
          status: ReservationStatus.CONFIRMED,
        },
      });

      const inv = await prisma.invoice.create({
        data: {
          reservationId: resv.id,
          invoiceNumber: `INV-VOID-SAME-${Date.now()}`,
          status: InvoiceStatus.PARTIALLY_PAID,
          subtotal: 2000,
          taxTotal: 0,
          discountTotal: 0,
          grandTotal: 2000,
          items: {
            create: {
              description: "Room charge",
              quantity: 1,
              unitPrice: 2000,
              lineTotal: 2000,
              itemType: InvoiceItemType.ROOM_CHARGE,
            },
          },
          payments: {
            create: {
              amount: 1000,
              paymentMethod: "CASH",
              referenceNumber: "CASH-SAME-01",
              status: PaymentStatus.RECORDED,
              paidAt: today,
              createdBy: receptionistUserId,
            },
          },
        },
        include: { payments: true },
      });

      const payment = inv.payments[0]!;

      // Receptionist voids payment recorded today
      const req = new NextRequest(
        `http://localhost/api/invoices/${inv.id}/payments/${payment.id}/void`,
        {
          method: "POST",
          headers: {
            cookie: `byteinn_session=${receptionistToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const res = await voidPaymentRoute(req, {
        params: Promise.resolve({ id: inv.id, paymentId: payment.id }),
      });

      assert.equal(res.status, 200, "Same-day payment void by receptionist must succeed with HTTP 200");
      const json = await res.json();
      assert.equal(json.success, true);

      const checkPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      assert.equal(checkPayment?.status, PaymentStatus.VOIDED);
    });

    it("rejects receptionist attempting to void a payment recorded on a past business day", async () => {
      const today = getHotelTodayDateUtc();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      const resv = await prisma.reservation.create({
        data: {
          reservationNo: `RES-VOID-OLD-${Date.now()}`,
          customerId: testCustomerId,
          createdBy: receptionistUserId,
          status: ReservationStatus.CONFIRMED,
        },
      });

      const inv = await prisma.invoice.create({
        data: {
          reservationId: resv.id,
          invoiceNumber: `INV-VOID-OLD-${Date.now()}`,
          status: InvoiceStatus.PARTIALLY_PAID,
          subtotal: 2000,
          taxTotal: 0,
          discountTotal: 0,
          grandTotal: 2000,
          items: {
            create: {
              description: "Room charge",
              quantity: 1,
              unitPrice: 2000,
              lineTotal: 2000,
              itemType: InvoiceItemType.ROOM_CHARGE,
            },
          },
          payments: {
            create: {
              amount: 1000,
              paymentMethod: "CASH",
              referenceNumber: "CASH-OLD-01",
              status: PaymentStatus.RECORDED,
              paidAt: yesterday,
              createdBy: receptionistUserId,
            },
          },
        },
        include: { payments: true },
      });

      const payment = inv.payments[0]!;

      // Receptionist tries to void past-day payment
      const req = new NextRequest(
        `http://localhost/api/invoices/${inv.id}/payments/${payment.id}/void`,
        {
          method: "POST",
          headers: {
            cookie: `byteinn_session=${receptionistToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const res = await voidPaymentRoute(req, {
        params: Promise.resolve({ id: inv.id, paymentId: payment.id }),
      });

      assert.equal(res.status, 403, "Past-day payment void by receptionist must be rejected with HTTP 403");
      const json = await res.json();
      assert.ok(
        json.error.toLowerCase().includes("administrator") || json.error.toLowerCase().includes("business day"),
        `Error must mention administrator or business day requirement, got: ${json.error}`
      );

      // Payment must remain RECORDED
      const checkPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      assert.equal(checkPayment?.status, PaymentStatus.RECORDED);
    });

    it("allows administrator to void an older payment recorded on a past business day", async () => {
      const today = getHotelTodayDateUtc();
      const pastDay = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

      const resv = await prisma.reservation.create({
        data: {
          reservationNo: `RES-VOID-ADM-${Date.now()}`,
          customerId: testCustomerId,
          createdBy: receptionistUserId,
          status: ReservationStatus.CONFIRMED,
        },
      });

      const inv = await prisma.invoice.create({
        data: {
          reservationId: resv.id,
          invoiceNumber: `INV-VOID-ADM-${Date.now()}`,
          status: InvoiceStatus.PARTIALLY_PAID,
          subtotal: 2000,
          taxTotal: 0,
          discountTotal: 0,
          grandTotal: 2000,
          items: {
            create: {
              description: "Room charge",
              quantity: 1,
              unitPrice: 2000,
              lineTotal: 2000,
              itemType: InvoiceItemType.ROOM_CHARGE,
            },
          },
          payments: {
            create: {
              amount: 1000,
              paymentMethod: "CASH",
              referenceNumber: "CASH-ADM-01",
              status: PaymentStatus.RECORDED,
              paidAt: pastDay,
              createdBy: receptionistUserId,
            },
          },
        },
        include: { payments: true },
      });

      const payment = inv.payments[0]!;

      // Admin voids past-day payment
      const req = new NextRequest(
        `http://localhost/api/invoices/${inv.id}/payments/${payment.id}/void`,
        {
          method: "POST",
          headers: {
            cookie: `byteinn_session=${adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const res = await voidPaymentRoute(req, {
        params: Promise.resolve({ id: inv.id, paymentId: payment.id }),
      });

      assert.equal(res.status, 200, "Past-day payment void by administrator must succeed with HTTP 200");
      const checkPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      assert.equal(checkPayment?.status, PaymentStatus.VOIDED);
    });
  });

  // =========================================================================
  // SECTION 2: USER ADMINISTRATION & SAFEGUARDS
  // =========================================================================
  describe("2. User Administration APIs & Safeguards (ADV-AUTH-05)", () => {
    it("rejects non-admin staff from accessing user management APIs with HTTP 403", async () => {
      const req = new NextRequest("http://localhost/api/users", {
        method: "GET",
        headers: { cookie: `byteinn_session=${receptionistToken}` },
      });
      const res = await listUsersRoute(req);
      assert.equal(res.status, 403, "Receptionist must receive HTTP 403 for GET /api/users");
    });

    it("allows admin to create a new staff user and lists users without leaking password hashes", async () => {
      const newEmail = `staff-${Date.now()}@byteinn.local`;
      const createReq = new NextRequest("http://localhost/api/users", {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "New Front Desk",
          email: newEmail,
          password: "TempPassword@123",
          roleId: receptionistRoleId,
          mustChangePassword: true,
        }),
      });

      const createRes = await createUserRoute(createReq);
      assert.equal(createRes.status, 201, "Admin user creation must return HTTP 201");
      const createdUser = (await createRes.json()).data;
      assert.equal(createdUser.email, newEmail);
      assert.equal(createdUser.mustChangePassword, true);
      assert.equal(createdUser.passwordHash, undefined, "Password hash must never be returned in API response");

      // Verify list endpoint
      const listReq = new NextRequest("http://localhost/api/users", {
        method: "GET",
        headers: { cookie: `byteinn_session=${adminToken}` },
      });
      const listRes = await listUsersRoute(listReq);
      assert.equal(listRes.status, 200);
      const listData = (await listRes.json()).data;
      const found = listData.find((u: { id: string }) => u.id === createdUser.id);
      assert.ok(found, "Newly created user must appear in user list");
      assert.equal(found.passwordHash, undefined);
    });

    it("blocks an admin from disabling their own account (self-disable guard)", async () => {
      const req = new NextRequest(`http://localhost/api/users/${adminUserId}`, {
        method: "PATCH",
        headers: {
          cookie: `byteinn_session=${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "DISABLED" }),
      });

      const res = await updateUserRoute(req, {
        params: Promise.resolve({ id: adminUserId }),
      });

      assert.equal(res.status, 400, "Self-disable by admin must be rejected with HTTP 400");
      const json = await res.json();
      assert.ok(
        json.error.toLowerCase().includes("cannot disable") || json.error.toLowerCase().includes("own account"),
        `Error must mention cannot disable own account, got: ${json.error}`
      );
    });

    it("blocks an admin from demoting their own account from ADMIN role (self-demote guard)", async () => {
      const req = new NextRequest(`http://localhost/api/users/${adminUserId}`, {
        method: "PATCH",
        headers: {
          cookie: `byteinn_session=${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roleId: receptionistRoleId }),
      });

      const res = await updateUserRoute(req, {
        params: Promise.resolve({ id: adminUserId }),
      });

      assert.equal(res.status, 400, "Self-demotion by admin must be rejected with HTTP 400");
      const json = await res.json();
      assert.ok(
        json.error.toLowerCase().includes("cannot demote") || json.error.toLowerCase().includes("own account"),
        `Error must mention cannot demote own account, got: ${json.error}`
      );
    });

    it("blocks disabling or deleting the last active Administrator in the system", async () => {
      // Check current active admin count
      const activeAdminCount = await prisma.user.count({
        where: {
          status: "ACTIVE",
          role: { name: RoleName.ADMIN },
        },
      });
      assert.ok(activeAdminCount >= 1, "At least one active admin must exist in system");

      // Attempting to delete oneself as admin must be blocked by self-delete guard
      const reqDeleteSelf = new NextRequest(`http://localhost/api/users/${adminUserId}`, {
        method: "DELETE",
        headers: {
          cookie: `byteinn_session=${adminToken}`,
        },
      });
      const resDeleteSelf = await deleteUserRoute(reqDeleteSelf, {
        params: Promise.resolve({ id: adminUserId }),
      });
      assert.equal(resDeleteSelf.status, 400, "Deleting own admin account must be rejected with 400");
      const jsonSelf = await resDeleteSelf.json();
      assert.ok(jsonSelf.error.toLowerCase().includes("cannot delete"));

      // Create a second temporary admin to test deletion when multiple admins exist
      const secondAdmin = await prisma.user.create({
        data: {
          name: "Second Admin",
          email: `admin2-${Date.now()}@byteinn.local`,
          passwordHash: await AuthService.hashPassword("Admin2@123456"),
          roleId: adminRoleId,
          status: "ACTIVE",
        },
      });

      // Deleting secondAdmin should succeed since multiple active admins exist
      const reqDeleteSecond = new NextRequest(`http://localhost/api/users/${secondAdmin.id}`, {
        method: "DELETE",
        headers: {
          cookie: `byteinn_session=${adminToken}`,
        },
      });
      const resDeleteSecond = await deleteUserRoute(reqDeleteSecond, {
        params: Promise.resolve({ id: secondAdmin.id }),
      });
      assert.equal(resDeleteSecond.status, 200, "Deleting admin when multiple exist must succeed with 200");
    });
  });

  // =========================================================================
  // SECTION 3: IN-APP PASSWORD CHANGE & SESSION INVALIDATION
  // =========================================================================
  describe("3. In-App Password Change & Session Invalidation (ADV-SESS-05)", () => {
    it("validates current password and enforces complexity rules on new password", async () => {
      // 1. Wrong current password
      const reqBadCurrent = new NextRequest("http://localhost/api/auth/change-password", {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "WrongPassword999!",
          newPassword: "BrandNewValidPass@123",
        }),
      });
      const resBadCurrent = await changePasswordRoute(reqBadCurrent);
      assert.equal(resBadCurrent.status, 400, "Incorrect current password must return HTTP 400");
      const jsonBadCurrent = await resBadCurrent.json();
      assert.ok(jsonBadCurrent.error.toLowerCase().includes("current password"));

      // 2. Weak new password (< 8 chars)
      const reqWeak = new NextRequest("http://localhost/api/auth/change-password", {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${receptionistToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "Reception@123456",
          newPassword: "weak",
        }),
      });
      const resWeak = await changePasswordRoute(reqWeak);
      assert.equal(resWeak.status, 400, "Weak new password must return HTTP 400 validation error");
    });

    it("changes password successfully and invalidates other active sessions via token_version increment", async () => {
      // Create user for password change test
      const testEmail = `pwchange-${Date.now()}@byteinn.local`;
      const initialPassword = "OriginalPass@123";
      const user = await prisma.user.create({
        data: {
          name: "Password Test User",
          email: testEmail,
          passwordHash: await AuthService.hashPassword(initialPassword),
          roleId: receptionistRoleId,
          status: "ACTIVE",
          mustChangePassword: true,
          tokenVersion: 1,
        },
      });

      // Session A (active session on desktop)
      const sessionTokenA = await AuthService.createSessionToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: RoleName.RECEPTIONIST,
        tokenVersion: 1,
      });

      // Session B (simultaneous session on tablet)
      const sessionTokenB = await AuthService.createSessionToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: RoleName.RECEPTIONIST,
        tokenVersion: 1,
      });

      // Perform password change from Session A
      const changeReq = new NextRequest("http://localhost/api/auth/change-password", {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${sessionTokenA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: initialPassword,
          newPassword: "SuperSecureNewPassword@2026",
        }),
      });

      const changeRes = await changePasswordRoute(changeReq);
      assert.equal(changeRes.status, 200, "Password change must succeed with HTTP 200");

      // Verify user in DB has updated hash, mustChangePassword=false, and tokenVersion incremented to 2
      const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
      assert.ok(updatedUser);
      assert.equal(updatedUser.mustChangePassword, false, "mustChangePassword must be set to false");
      assert.equal(updatedUser.tokenVersion, 2, "tokenVersion must be incremented to 2");

      const isNewValid = await AuthService.verifyPassword("SuperSecureNewPassword@2026", updatedUser.passwordHash);
      assert.equal(isNewValid, true, "New password hash must match new password");

      // INVARIANT: Session B (holding tokenVersion 1) must now be REJECTED on subsequent requests
      const testReqB = new NextRequest("http://localhost/api/rooms", {
        method: "GET",
        headers: { cookie: `byteinn_session=${sessionTokenB}` },
      });
      const testResB = await listRoomsRoute(testReqB);
      assert.equal(
        testResB.status,
        401,
        "Session B with outdated tokenVersion must be rejected with HTTP 401 after password change"
      );
    });
  });

  // =========================================================================
  // SECTION 4: MUST-CHANGE-PASSWORD RESTRICTION & REDIRECT GUARD
  // =========================================================================
  describe("4. Must-Change-Password Guard Restrictions", () => {
    it("blocks access to operational endpoints when mustChangePassword is true, allowing only password change", async () => {
      const forcedUser = await prisma.user.create({
        data: {
          name: "Forced Reset User",
          email: `forced-${Date.now()}@byteinn.local`,
          passwordHash: await AuthService.hashPassword("DefaultPass@123"),
          roleId: receptionistRoleId,
          status: "ACTIVE",
          mustChangePassword: true,
          tokenVersion: 1,
        },
      });

      const forcedToken = await AuthService.createSessionToken({
        sub: forcedUser.id,
        email: forcedUser.email,
        name: forcedUser.name,
        role: RoleName.RECEPTIONIST,
        tokenVersion: 1,
      });

      // Attempt operational request (e.g. GET /api/rooms)
      const opReq = new NextRequest("http://localhost/api/rooms", {
        method: "GET",
        headers: { cookie: `byteinn_session=${forcedToken}` },
      });
      const opRes = await listRoomsRoute(opReq);
      assert.equal(
        opRes.status,
        403,
        "User with mustChangePassword=true must receive HTTP 403 on operational endpoints"
      );
      const opJson = await opRes.json();
      assert.equal(opJson.mustChangePassword, true);

      // Perform password change
      const changeReq = new NextRequest("http://localhost/api/auth/change-password", {
        method: "POST",
        headers: {
          cookie: `byteinn_session=${forcedToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "DefaultPass@123",
          newPassword: "BrandNewSecurePass@2026",
        }),
      });
      const changeRes = await changePasswordRoute(changeReq);
      assert.equal(changeRes.status, 200, "Password change must be permitted even when mustChangePassword=true");

      // Get new session cookie from change password response or mint token with new tokenVersion
      const freshUser = await prisma.user.findUnique({ where: { id: forcedUser.id } });
      assert.equal(freshUser?.mustChangePassword, false);

      const freshToken = await AuthService.createSessionToken({
        sub: freshUser!.id,
        email: freshUser!.email,
        name: freshUser!.name,
        role: RoleName.RECEPTIONIST,
        tokenVersion: freshUser!.tokenVersion,
      });

      // Operational request now succeeds
      const afterReq = new NextRequest("http://localhost/api/rooms", {
        method: "GET",
        headers: { cookie: `byteinn_session=${freshToken}` },
      });
      const afterRes = await listRoomsRoute(afterReq);
      assert.equal(afterRes.status, 200, "Operational endpoint must succeed after password change");
    });
  });

  // =========================================================================
  // SECTION 5: ADMIN VIEW OF DISCOUNTS AND RATE OVERRIDES REPORT
  // =========================================================================
  describe("5. Admin View of Discounts and Rate Overrides Report (ADV-BIL-02)", () => {
    it("rejects non-admin staff from accessing discounts report with HTTP 403", async () => {
      const req = new NextRequest("http://localhost/api/reports/discounts", {
        method: "GET",
        headers: { cookie: `byteinn_session=${receptionistToken}` },
      });
      const res = await discountsReportRoute(req);
      assert.equal(res.status, 403, "Receptionist must receive HTTP 403 for /api/reports/discounts");
    });

    it("allows admin to view comprehensive report itemizing invoice discounts and rate overrides", async () => {
      const today = getHotelTodayDateUtc();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const discCustomer = await prisma.customer.create({
        data: {
          firstName: "Discount",
          lastName: "Guest",
          email: `disc-${Date.now()}@example.com`,
        },
      });

      const discBuilding = await prisma.building.findFirst();
      const discFloor = await prisma.floor.findFirst();
      const discRoom = await prisma.room.create({
        data: {
          roomNo: `DISC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          propertyId: testPropertyId,
          buildingId: discBuilding!.id,
          floorId: discFloor!.id,
          roomCategoryId: testCategoryId,
          capacity: 2,
          status: RoomStatus.VACANT_CLEAN,
        },
      });

      // 1. Create a reservation with a rate override (room booked at 2000 vs category base price)
      const resvOverride = await prisma.reservation.create({
        data: {
          reservationNo: `RES-DISC-REP-${Date.now()}`,
          customerId: discCustomer.id,
          createdBy: adminUserId,
          status: ReservationStatus.CONFIRMED,
          rooms: {
            create: {
              roomId: discRoom.id,
              roomCategoryId: testCategoryId,
              arrivalDate: today,
              departureDate: tomorrow,
              bookedNightlyRate: 2000,
              status: AllocationStatus.CONFIRMED,
            },
          },
        },
      });

      // 2. Create an invoice with explicit discount item
      const invDiscount = await prisma.invoice.create({
        data: {
          reservationId: resvOverride.id,
          invoiceNumber: `INV-DISC-REP-${Date.now()}`,
          status: InvoiceStatus.ISSUED,
          subtotal: 2000,
          discountTotal: 500,
          taxTotal: 0,
          grandTotal: 1500,
          items: {
            createMany: {
              data: [
                {
                  description: "Room charge 1 night",
                  quantity: 1,
                  unitPrice: 2000,
                  lineTotal: 2000,
                  itemType: InvoiceItemType.ROOM_CHARGE,
                },
                {
                  description: "Promotional discount voucher",
                  quantity: 1,
                  unitPrice: -500,
                  lineTotal: -500,
                  itemType: InvoiceItemType.DISCOUNT,
                },
              ],
            },
          },
        },
      });

      // 3. Query the discounts report as Admin
      const req = new NextRequest("http://localhost/api/reports/discounts", {
        method: "GET",
        headers: { cookie: `byteinn_session=${adminToken}` },
      });

      const res = await discountsReportRoute(req);
      assert.equal(res.status, 200, "Admin discounts report must return HTTP 200");
      const json = await res.json();
      const report = json.data || json;

      assert.ok(report.summary, "Report must include summary KPI metrics");
      assert.ok(Array.isArray(report.invoiceDiscounts), "Must contain itemized invoice discounts");
      assert.ok(Array.isArray(report.rateOverrides), "Must contain itemized rate overrides");

      // Verify itemized invoice discounts contain our invoice
      const foundInv = report.invoiceDiscounts.find(
        (i: { invoiceId: string }) => i.invoiceId === invDiscount.id
      );
      assert.ok(foundInv, "Created invoice discount must be present in report");
      assert.equal(Number(foundInv.discountTotal), 500);

      // Verify rate overrides contain our room booking
      const foundOverride = report.rateOverrides.find(
        (r: { reservationId: string }) => r.reservationId === resvOverride.id
      );
      assert.ok(foundOverride, "Room rate override must be present in report");
      assert.equal(Number(foundOverride.bookedRate), 2000);
      const category = await prisma.roomCategory.findUnique({ where: { id: testCategoryId } });
      const expectedBase = Number(category!.basePrice);
      assert.equal(Number(foundOverride.basePrice), expectedBase);
      assert.equal(Number(foundOverride.rateVariance), expectedBase - 2000);
    });
  });

  after(async () => {
    // Cleanup temporary users created by Batch 3 tests
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "byteinn.local",
          notIn: ["admin@byteinn.local", "reception@byteinn.local"],
        },
      },
    });

    // Ensure seeded users are active with mustChangePassword = false
    await prisma.user.updateMany({
      where: { email: { in: ["admin@byteinn.local", "reception@byteinn.local"] } },
      data: { status: "ACTIVE", mustChangePassword: false },
    });
  });
});
