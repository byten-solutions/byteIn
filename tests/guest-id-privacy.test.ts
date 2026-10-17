import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { AuthService } from "../src/modules/auth/auth.service";
import { RoleName, RoomStatus, AllocationStatus } from "@prisma/client";
import { POST as createCustomerRoute, GET as getCustomersRoute } from "../src/app/api/customers/route";
import { GET as getCustomerRoute, PUT as updateCustomerRoute } from "../src/app/api/customers/[id]/route";
import { POST as checkInRoute } from "../src/app/api/room-allocations/[id]/check-in/route";
import { GET as getReservationRoute } from "../src/app/api/reservations/[id]/route";

describe("Guest ID Privacy & Masking Tests", () => {
  let receptionistToken: string;
  let receptionistUserId: string;
  let testCustomerId: string;
  let testPropertyId: string;
  let testBuildingId: string;
  let testFloorId: string;
  let testCategoryId: string;
  let testRoomId: string;
  let testReservationId: string;
  let testAllocationId: string;

  before(async () => {
    // 1. Roles & Users
    const recepRole = await prisma.role.findFirst({ where: { name: RoleName.RECEPTIONIST } });
    assert.ok(recepRole, "Receptionist role must exist");

    let recep = await prisma.user.findFirst({ where: { email: "reception@byteinn.local" } });
    if (!recep) {
      recep = await prisma.user.create({
        data: {
          name: "Front Desk Staff",
          email: "reception@byteinn.local",
          passwordHash: await AuthService.hashPassword("Reception@123456"),
          roleId: recepRole.id,
          status: "ACTIVE",
          mustChangePassword: false,
          tokenVersion: 1,
        },
      });
    }
    receptionistUserId = recep.id;
    receptionistToken = await AuthService.createSessionToken({
      sub: recep.id,
      email: recep.email,
      name: recep.name,
      role: RoleName.RECEPTIONIST,
      tokenVersion: recep.tokenVersion || 1,
    });

    // 2. Property, Building, Floor, Category, Room
    let property = await prisma.property.findFirst();
    if (!property) {
      property = await prisma.property.create({
        data: { name: "Privacy Test Hotel", status: "ACTIVE" },
      });
    }
    testPropertyId = property.id;

    let building = await prisma.building.findFirst({ where: { propertyId: testPropertyId } });
    if (!building) {
      building = await prisma.building.create({
        data: { name: "Privacy Wing", propertyId: testPropertyId },
      });
    }
    testBuildingId = building.id;

    let floor = await prisma.floor.findFirst({ where: { buildingId: testBuildingId } });
    if (!floor) {
      floor = await prisma.floor.create({
        data: { floorNo: 1, name: "1st Floor", buildingId: testBuildingId },
      });
    }
    testFloorId = floor.id;

    let category = await prisma.roomCategory.findFirst();
    if (!category) {
      category = await prisma.roomCategory.create({
        data: { name: "Privacy Suite", basePrice: 2000, maxOccupancy: 2, propertyId: testPropertyId },
      });
    }
    testCategoryId = category.id;

    const room = await prisma.room.create({
      data: {
        roomNo: `P-${Date.now().toString().slice(-4)}`,
        propertyId: testPropertyId,
        buildingId: testBuildingId,
        floorId: testFloorId,
        roomCategoryId: testCategoryId,
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    });
    testRoomId = room.id;
  });

  after(async () => {
    // Cleanup created test records
    if (testAllocationId) {
      await prisma.reservationRoom.deleteMany({ where: { id: testAllocationId } });
    }
    if (testReservationId) {
      await prisma.reservation.deleteMany({ where: { id: testReservationId } });
    }
    if (testRoomId) {
      await prisma.room.deleteMany({ where: { id: testRoomId } });
    }
    if (testCustomerId) {
      await prisma.customer.deleteMany({ where: { id: testCustomerId } });
    }
  });

  it("POST /api/customers: should store only last 4 digits and return masked value", async () => {
    const req = new NextRequest("http://localhost/api/customers", {
      method: "POST",
      headers: {
        cookie: `byteinn_session=${receptionistToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: "Anand",
        lastName: "Verma",
        phone: "+91-9876543210",
        email: "anand.verma@example.com",
        idProofType: "Passport",
        idProofNumber: "IND-PASS-99887766", // 8 digits / full ID
      }),
    });

    const res = await createCustomerRoute(req);
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    testCustomerId = data.customer.id;

    // Verify API response masks the value: "•••• 7766"
    assert.equal(data.customer.idProofNumber, "•••• 7766");

    // Verify DB stores only the last 4 characters: "7766"
    const inDb = await prisma.customer.findUnique({ where: { id: testCustomerId } });
    assert.equal(inDb?.idProofNumber, "7766");
  });

  it("GET /api/customers: should return masked ID and search by last 4 digits only", async () => {
    // 1. Fetch list
    const reqList = new NextRequest("http://localhost/api/customers", {
      headers: { cookie: `byteinn_session=${receptionistToken}` },
    });
    const resList = await getCustomersRoute(reqList);
    assert.equal(resList.status, 200);
    const dataList = await resList.json();
    const found = dataList.customers.find((c: { id: string }) => c.id === testCustomerId);
    assert.ok(found, "Created customer must be in list");
    assert.equal(found.idProofNumber, "•••• 7766");

    // 2. Search by last 4: "7766"
    const reqSearch4 = new NextRequest("http://localhost/api/customers?search=7766", {
      headers: { cookie: `byteinn_session=${receptionistToken}` },
    });
    const resSearch4 = await getCustomersRoute(reqSearch4);
    const dataSearch4 = await resSearch4.json();
    assert.ok(dataSearch4.customers.some((c: { id: string }) => c.id === testCustomerId));

    // 3. Search by masked query: "•••• 7766"
    const reqSearchMask = new NextRequest("http://localhost/api/customers?search=%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2%207766", {
      headers: { cookie: `byteinn_session=${receptionistToken}` },
    });
    const resSearchMask = await getCustomersRoute(reqSearchMask);
    const dataSearchMask = await resSearchMask.json();
    assert.ok(dataSearchMask.customers.some((c: { id: string }) => c.id === testCustomerId));

    // 4. Search by full ID: "IND-PASS-99887766" (should match via extracted last 4)
    const reqSearchFull = new NextRequest("http://localhost/api/customers?search=IND-PASS-99887766", {
      headers: { cookie: `byteinn_session=${receptionistToken}` },
    });
    const resSearchFull = await getCustomersRoute(reqSearchFull);
    const dataSearchFull = await resSearchFull.json();
    assert.ok(dataSearchFull.customers.some((c: { id: string }) => c.id === testCustomerId));
  });

  it("GET /api/customers/[id]: should return masked ID proof number", async () => {
    const req = new NextRequest(`http://localhost/api/customers/${testCustomerId}`, {
      headers: { cookie: `byteinn_session=${receptionistToken}` },
    });
    const res = await getCustomerRoute(req, { params: Promise.resolve({ id: testCustomerId }) });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.customer.idProofNumber, "•••• 7766");
  });

  it("PUT /api/customers/[id]: updating ID should store only last 4 and return masked value", async () => {
    const req = new NextRequest(`http://localhost/api/customers/${testCustomerId}`, {
      method: "PUT",
      headers: {
        cookie: `byteinn_session=${receptionistToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idProofType: "Aadhaar Card",
        idProofNumber: "9182-4402-1234",
      }),
    });

    const res = await updateCustomerRoute(req, { params: Promise.resolve({ id: testCustomerId }) });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.customer.idProofNumber, "•••• 1234");

    const inDb = await prisma.customer.findUnique({ where: { id: testCustomerId } });
    assert.equal(inDb?.idProofNumber, "1234");
  });

  it("POST /api/room-allocations/[id]/check-in: verified ID should store only last 4 in customer record", async () => {
    // Create reservation for testCustomerId
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    const resv = await prisma.reservation.create({
      data: {
        reservationNo: `RES-PRIV-${Date.now().toString().slice(-6)}`,
        customerId: testCustomerId,
        createdBy: receptionistUserId,
        rooms: {
          create: {
            roomId: testRoomId,
            roomCategoryId: testCategoryId,
            arrivalDate: today,
            departureDate: tomorrow,
            bookedNightlyRate: 2000,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
      include: { rooms: true },
    });
    testReservationId = resv.id;
    testAllocationId = resv.rooms[0]!.id;

    const req = new NextRequest(`http://localhost/api/room-allocations/${testAllocationId}/check-in`, {
      method: "POST",
      headers: {
        cookie: `byteinn_session=${receptionistToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        verifiedIdType: "Driving License",
        verifiedIdNumber: "DL-KA-04-2024-5544",
      }),
    });

    const res = await checkInRoute(req, { params: Promise.resolve({ id: testAllocationId }) });
    assert.equal(res.status, 200);

    const updatedCustomer = await prisma.customer.findUnique({ where: { id: testCustomerId } });
    assert.equal(updatedCustomer?.idProofNumber, "5544");
  });

  it("GET /api/reservations/[id]: should return masked customer ID", async () => {
    const req = new NextRequest(`http://localhost/api/reservations/${testReservationId}`, {
      headers: { cookie: `byteinn_session=${receptionistToken}` },
    });
    const res = await getReservationRoute(req, { params: Promise.resolve({ id: testReservationId }) });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.reservation.customer.idProofNumber, "•••• 5544");
  });

  it("CustomerService.migrateExistingCustomerIds: should truncate legacy long IDs to last 4 only", async () => {
    const legacyCustomer = await prisma.customer.create({
      data: {
        firstName: "Legacy",
        lastName: "Guest",
        phone: "+91-9999988888",
        idProofType: "Passport",
        idProofNumber: "IND-PASS-55443322",
      },
    });

    const { CustomerService } = await import("../src/modules/customers/customer.service");
    const count = await CustomerService.migrateExistingCustomerIds();
    assert.ok(count >= 1);

    const migrated = await prisma.customer.findUnique({ where: { id: legacyCustomer.id } });
    assert.equal(migrated?.idProofNumber, "3322");

    await prisma.customer.delete({ where: { id: legacyCustomer.id } });
  });

  it("Audit log privacy: should strip ID numbers from new entries and redact existing entries", async () => {
    const { createSafeAuditLog, redactExistingAuditLogs } = await import("../src/lib/audit");

    // 1. Create a legacy un-redacted audit log directly
    const rawLog = await prisma.auditLog.create({
      data: {
        userId: receptionistUserId,
        entityType: "Customer",
        entityId: testCustomerId,
        action: "CUSTOMER_REGISTERED",
        newData: {
          idProofNumber: "RAW-SECRET-9988",
          customerName: "Anand Verma",
        },
      },
    });

    // 2. Redact existing entries
    const redactedCount = await redactExistingAuditLogs();
    assert.ok(redactedCount >= 1);

    const updatedLog = await prisma.auditLog.findUnique({ where: { id: rawLog.id } });
    const newData = updatedLog?.newData as Record<string, unknown>;
    assert.equal(newData.idProofNumber, undefined, "Sensitive idProofNumber must be stripped from audit log");
    assert.equal(newData.customerName, "Anand Verma", "Non-sensitive data must be preserved");

    // 3. Create a new safe audit log
    const safeLog = await createSafeAuditLog(prisma, {
      userId: receptionistUserId,
      entityType: "Customer",
      entityId: testCustomerId,
      action: "CUSTOMER_UPDATED",
      newData: {
        verifiedIdNumber: "DL-KA-SECRET-1234",
        notes: "Verified identity document",
      },
    });

    const safeNewData = safeLog.newData as Record<string, unknown>;
    assert.equal(safeNewData.verifiedIdNumber, undefined, "verifiedIdNumber must be stripped from new audit log");
    assert.equal(safeNewData.notes, "Verified identity document");

    await prisma.auditLog.deleteMany({ where: { id: { in: [rawLog.id, safeLog.id] } } });
  });
});

