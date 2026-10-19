import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { RoleName, RoomStatus, ReservationStatus, InvoiceStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { AuthService } from "../src/modules/auth/auth.service";
import { setCacheStub } from "../src/lib/scoped-cache";
import * as InvoicesRoute from "../src/app/api/invoices/route";
import * as InvoicePaymentsRoute from "../src/app/api/invoices/[id]/payments/route";

describe("Cache Invalidation & Scoped Caching Test", () => {
  let propA: { id: string };
  let propB: { id: string };
  let adminA: { id: string; email: string };
  let superAdmin: { id: string; email: string };
  let tokenAdminA: string;
  let tokenSuperAdmin: string;
  let invA: { id: string };

  const inMemoryCache = new Map<string, unknown>();

  before(async () => {
    // Install cache stub to simulate Next.js cache store in test runner
    setCacheStub({
      cached: async <T>(
        loader: () => Promise<T>,
        key: string[],
        _options: { tags: string[]; revalidate: number }
      ) => {
        const cacheKey = key.join(":");
        if (inMemoryCache.has(cacheKey)) {
          return inMemoryCache.get(cacheKey) as T;
        }
        const fresh = await loader();
        inMemoryCache.set(cacheKey, fresh);
        return fresh;
      },
      expireTag: (tag: string) => {
        // Tag format "${base}:all"
        const prefix = tag.split(":")[0];
        for (const k of inMemoryCache.keys()) {
          if (k.startsWith(prefix) || k.includes(tag)) {
            inMemoryCache.delete(k);
          }
        }
      },
    });

    const time = Date.now();
    // 1. Create properties
    propA = await prisma.property.create({
      data: { name: `Cache Hotel A ${time}`, status: "ACTIVE" },
    });
    propB = await prisma.property.create({
      data: { name: `Cache Hotel B ${time}`, status: "ACTIVE" },
    });

    // 2. Roles
    const [adminRole, superAdminRole] = await Promise.all([
      prisma.role.findFirstOrThrow({ where: { name: RoleName.ADMIN } }),
      prisma.role.findFirstOrThrow({ where: { name: RoleName.SUPER_ADMIN } }),
    ]);

    // 3. Users
    adminA = await prisma.user.create({
      data: {
        name: "Admin Hotel A",
        email: `cache-admin-a-${time}@byteinn.test`,
        passwordHash: await AuthService.hashPassword("TestPass@123"),
        roleId: adminRole.id,
        propertyId: propA.id,
        status: "ACTIVE",
        tokenVersion: 1,
      },
    });

    superAdmin = await prisma.user.create({
      data: {
        name: "Platform SuperAdmin",
        email: `cache-superadmin-${time}@byteinn.test`,
        passwordHash: await AuthService.hashPassword("TestPass@123"),
        roleId: superAdminRole.id,
        propertyId: null,
        status: "ACTIVE",
        tokenVersion: 1,
      },
    });

    tokenAdminA = await AuthService.createSessionToken({
      sub: adminA.id,
      email: adminA.email,
      name: "Admin Hotel A",
      role: RoleName.ADMIN,
      propertyId: propA.id,
      tokenVersion: 1,
    });

    tokenSuperAdmin = await AuthService.createSessionToken({
      sub: superAdmin.id,
      email: superAdmin.email,
      name: "Platform SuperAdmin",
      role: RoleName.SUPER_ADMIN,
      propertyId: null,
      tokenVersion: 1,
    });

    // 4. Create Hotel A hierarchy, customer, reservation, invoice
    const bldgA = await prisma.building.create({
      data: { name: "Bldg A", propertyId: propA.id },
    });
    const floorA = await prisma.floor.create({
      data: { name: "Floor 1", floorNo: 1, buildingId: bldgA.id },
    });
    const catA = await prisma.roomCategory.create({
      data: { name: `Cat A ${time}`, basePrice: 1000, maxOccupancy: 2, propertyId: propA.id },
    });
    const roomA = await prisma.room.create({
      data: {
        roomNo: `CA-101-${time}`,
        propertyId: propA.id,
        buildingId: bldgA.id,
        floorId: floorA.id,
        roomCategoryId: catA.id,
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    });
    const custA = await prisma.customer.create({
      data: {
        firstName: "Cache",
        lastName: "Guest",
        phone: `911223${Math.floor(1000 + Math.random() * 9000)}`,
        registeredPropertyId: propA.id,
      },
    });
    const resA = await prisma.reservation.create({
      data: {
        propertyId: propA.id,
        reservationNo: `RES-CA-${time}`,
        customerId: custA.id,
        createdBy: adminA.id,
        status: ReservationStatus.CONFIRMED,
      },
    });
    const allocA = await prisma.reservationRoom.create({
      data: {
        reservationId: resA.id,
        roomId: roomA.id,
        roomCategoryId: catA.id,
        arrivalDate: new Date("2026-10-20T00:00:00Z"),
        departureDate: new Date("2026-10-21T00:00:00Z"),
        bookedNightlyRate: 1000,
        status: ReservationStatus.CONFIRMED,
      },
    });
    invA = await prisma.invoice.create({
      data: {
        propertyId: propA.id,
        reservationId: resA.id,
        invoiceNumber: `INV-CA-${time}`,
        subtotal: 1000,
        grandTotal: 1000,
        status: InvoiceStatus.ISSUED,
      },
    });
    await prisma.invoiceItem.create({
      data: {
        invoiceId: invA.id,
        reservationRoomId: allocA.id,
        description: "Room charge",
        quantity: 1,
        unitPrice: 1000,
        lineTotal: 1000,
        itemType: "ROOM_CHARGE",
      },
    });
  });

  after(async () => {
    setCacheStub(null);
    if (propA && propB) {
      await prisma.payment.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
      await prisma.invoiceItem.deleteMany({
        where: { invoice: { propertyId: { in: [propA.id, propB.id] } } },
      });
      await prisma.invoice.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
      await prisma.reservationRoom.deleteMany({
        where: { room: { propertyId: { in: [propA.id, propB.id] } } },
      });
      await prisma.reservation.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
      await prisma.room.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
      await prisma.roomCategory.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
      await prisma.floor.deleteMany({
        where: { building: { propertyId: { in: [propA.id, propB.id] } } },
      });
      await prisma.building.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
      await prisma.customer.deleteMany({
        where: { registeredPropertyId: { in: [propA.id, propB.id] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [adminA.id, superAdmin.id] } },
      });
      await prisma.property.deleteMany({ where: { id: { in: [propA.id, propB.id] } } });
    }
  });

  function makeReq(url: string, method: string, token: string, body?: object): NextRequest {
    return new NextRequest(url, {
      method,
      headers: {
        cookie: `byteinn_session=${token}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("proves immediate billing cache invalidation via real route handlers", async () => {
    // 1. Warm billing summary for Hotel A via GET /api/invoices (Hotel Admin)
    const reqA1 = makeReq("http://localhost/api/invoices", "GET", tokenAdminA);
    const resA1 = await InvoicesRoute.GET(reqA1);
    assert.equal(resA1.status, 200);
    const bodyA1 = await resA1.json();
    assert.equal(bodyA1.data.summary.totalInvoiced, "1000.00");
    const initialCollectedA = Number(bodyA1.data.summary.totalCollected);

    // 2. Warm billing summary for global via GET /api/invoices (SuperAdmin, platform-wide)
    const reqGlobal1 = makeReq("http://localhost/api/invoices", "GET", tokenSuperAdmin);
    const resGlobal1 = await InvoicesRoute.GET(reqGlobal1);
    assert.equal(resGlobal1.status, 200);
    const bodyGlobal1 = await resGlobal1.json();
    const initialCollectedGlobal = Number(bodyGlobal1.data.summary.totalCollected);

    // Check that global billing summary was cached in cache stub
    assert.ok(inMemoryCache.has("billing-summary:all"), "Global summary must be cached under 'billing-summary:all'");

    // 3. Record a payment of 250.00 in Hotel A via POST /api/invoices/[id]/payments
    const payReq = makeReq(`http://localhost/api/invoices/${invA.id}/payments`, "POST", tokenAdminA, {
      amount: 250,
      paymentMethod: "CASH",
      idempotencyKey: `cache-test-pay-${Date.now()}`,
    });
    const payRes = await InvoicePaymentsRoute.POST(payReq, {
      params: Promise.resolve({ id: invA.id }),
    });
    assert.equal(payRes.status, 201);

    // 4. Invalidation must have purged 'billing-summary:all' from cache immediately
    assert.ok(
      !inMemoryCache.has("billing-summary:all"),
      "Mutation must immediately expire 'billing-summary:all' from cache"
    );

    // 5. Next GET as Hotel A shows new total immediately (bypasses cache, fresh calculation)
    const reqA2 = makeReq("http://localhost/api/invoices", "GET", tokenAdminA);
    const resA2 = await InvoicesRoute.GET(reqA2);
    assert.equal(resA2.status, 200);
    const bodyA2 = await resA2.json();
    const newCollectedA = Number(bodyA2.data.summary.totalCollected);
    assert.equal(newCollectedA, initialCollectedA + 250, "Hotel A must reflect +250 payment immediately");

    // 6. Next GET as SuperAdmin shows new global total immediately (re-evaluated on demand, no stale read)
    const reqGlobal2 = makeReq("http://localhost/api/invoices", "GET", tokenSuperAdmin);
    const resGlobal2 = await InvoicesRoute.GET(reqGlobal2);
    assert.equal(resGlobal2.status, 200);
    const bodyGlobal2 = await resGlobal2.json();
    const newCollectedGlobal = Number(bodyGlobal2.data.summary.totalCollected);
    assert.ok(
      newCollectedGlobal >= initialCollectedGlobal + 250,
      `Global SuperAdmin must reflect at least +250 payment immediately without waiting (got ${newCollectedGlobal}, expected >= ${initialCollectedGlobal + 250})`
    );
  });
});
