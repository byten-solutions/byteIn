import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { RoleName, AccountType } from "@prisma/client";
import { AuthService } from "../src/modules/auth/auth.service";

// Route Handlers under test
import * as IncomeHeadsRoute from "../src/app/api/income-heads/route";
import * as IncomeHeadSeedRoute from "../src/app/api/income-heads/seed/route";
import * as IncomeHeadDetailRoute from "../src/app/api/income-heads/[id]/route";
import * as IncomesRoute from "../src/app/api/incomes/route";
import * as IncomeDetailRoute from "../src/app/api/incomes/[id]/route";
import * as IncomeVoidRoute from "../src/app/api/incomes/[id]/void/route";
import * as IncomeReceiptsRoute from "../src/app/api/incomes/[id]/receipts/route";
import * as IncomeReceiptVoidRoute from "../src/app/api/incomes/[id]/receipts/[receiptId]/void/route";

describe("Phase 3 Stage 2: Income Management API Route Handlers", () => {
  const timestamp = Date.now();
  let propA: { id: string; name: string };
  let propB: { id: string; name: string };

  let userAdminA: { id: string; email: string; name: string };
  let userAdminB: { id: string; email: string; name: string };
  let userRecepA: { id: string; email: string; name: string };
  let userSuper: { id: string; email: string; name: string };

  let tokenAdminA: string;
  let tokenAdminB: string;
  let tokenRecepA: string;
  let tokenSuper: string;

  let accountA: { id: string };
  let accountB: { id: string };

  let createdIncomeHeadId: string;
  let createdIncomeId: string;
  let recordedReceiptId: string;

  function makeReq(
    url: string,
    method: string,
    token?: string,
    body?: object
  ): NextRequest {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["cookie"] = `byteinn_session=${token}`;
    }
    return new NextRequest(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  before(async () => {
    // 1. Create Properties
    propA = await prisma.property.create({
      data: {
        name: `Income Route Hotel A ${timestamp}`,
        city: "Mumbai",
        status: "ACTIVE",
      },
    });

    propB = await prisma.property.create({
      data: {
        name: `Income Route Hotel B ${timestamp}`,
        city: "Delhi",
        status: "ACTIVE",
      },
    });

    // 2. Roles
    const [adminRole, recepRole, superRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { name: RoleName.ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { name: RoleName.RECEPTIONIST } }),
      prisma.role.findUniqueOrThrow({ where: { name: RoleName.SUPER_ADMIN } }),
    ]);

    // 3. Create Users
    [userAdminA, userAdminB, userRecepA, userSuper] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Admin User A",
          email: `admin-a-${timestamp}@byteinn.test`,
          passwordHash: await AuthService.hashPassword("TestPass@123"),
          roleId: adminRole.id,
          propertyId: propA.id,
          status: "ACTIVE",
          tokenVersion: 1,
        },
      }),
      prisma.user.create({
        data: {
          name: "Admin User B",
          email: `admin-b-${timestamp}@byteinn.test`,
          passwordHash: await AuthService.hashPassword("TestPass@123"),
          roleId: adminRole.id,
          propertyId: propB.id,
          status: "ACTIVE",
          tokenVersion: 1,
        },
      }),
      prisma.user.create({
        data: {
          name: "Recep User A",
          email: `recep-a-${timestamp}@byteinn.test`,
          passwordHash: await AuthService.hashPassword("TestPass@123"),
          roleId: recepRole.id,
          propertyId: propA.id,
          status: "ACTIVE",
          tokenVersion: 1,
        },
      }),
      prisma.user.create({
        data: {
          name: "Super Admin",
          email: `super-${timestamp}@byteinn.test`,
          passwordHash: await AuthService.hashPassword("TestPass@123"),
          roleId: superRole.id,
          propertyId: null,
          status: "ACTIVE",
          tokenVersion: 1,
        },
      }),
    ]);

    // 4. Generate Session Tokens
    [tokenAdminA, tokenAdminB, tokenRecepA, tokenSuper] = await Promise.all([
      AuthService.createSessionToken({
        sub: userAdminA.id,
        email: userAdminA.email,
        name: userAdminA.name,
        role: RoleName.ADMIN,
        propertyId: propA.id,
        tokenVersion: 1,
      }),
      AuthService.createSessionToken({
        sub: userAdminB.id,
        email: userAdminB.email,
        name: userAdminB.name,
        role: RoleName.ADMIN,
        propertyId: propB.id,
        tokenVersion: 1,
      }),
      AuthService.createSessionToken({
        sub: userRecepA.id,
        email: userRecepA.email,
        name: userRecepA.name,
        role: RoleName.RECEPTIONIST,
        propertyId: propA.id,
        tokenVersion: 1,
      }),
      AuthService.createSessionToken({
        sub: userSuper.id,
        email: userSuper.email,
        name: userSuper.name,
        role: RoleName.SUPER_ADMIN,
        propertyId: null,
        tokenVersion: 1,
      }),
    ]);

    // 5. Setup Financial Accounts
    accountA = await prisma.financialAccount.create({
      data: {
        propertyId: propA.id,
        accountName: `Main Operating Account A ${timestamp}`,
        accountType: AccountType.BANK,
        openingBalance: 1000,
        openingBalanceDate: new Date("2026-01-01"),
        isDefault: true,
        isActive: true,
      },
    });

    accountB = await prisma.financialAccount.create({
      data: {
        propertyId: propB.id,
        accountName: `Main Operating Account B ${timestamp}`,
        accountType: AccountType.BANK,
        openingBalance: 500,
        openingBalanceDate: new Date("2026-01-01"),
        isDefault: true,
        isActive: true,
      },
    });
  });

  after(async () => {
    // Clean up
    await prisma.auditLog.deleteMany({
      where: {
        userId: { in: [userAdminA.id, userAdminB.id, userRecepA.id, userSuper.id] },
      },
    });
    await prisma.receipt.deleteMany({
      where: { propertyId: { in: [propA.id, propB.id] } },
    });
    await prisma.income.deleteMany({
      where: { propertyId: { in: [propA.id, propB.id] } },
    });
    await prisma.incomeHead.deleteMany({
      where: { propertyId: { in: [propA.id, propB.id] } },
    });
    await prisma.financialAccount.deleteMany({
      where: { propertyId: { in: [propA.id, propB.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userAdminA.id, userAdminB.id, userRecepA.id, userSuper.id] } },
    });
    await prisma.property.deleteMany({
      where: { id: { in: [propA.id, propB.id] } },
    });
  });

  // =========================================================================
  // 1. RBAC & Access Control
  // =========================================================================
  describe("1. Strict RBAC & Permission Guards", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const res = await IncomeHeadsRoute.GET(
        makeReq("http://localhost:3000/api/income-heads", "GET")
      );
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.ok(json.error);
    });

    it("strictly rejects RECEPTIONIST with 403 on all income endpoints", async () => {
      const endpoints = [
        () =>
          IncomeHeadsRoute.GET(
            makeReq("http://localhost:3000/api/income-heads", "GET", tokenRecepA)
          ),
        () =>
          IncomeHeadsRoute.POST(
            makeReq(
              "http://localhost:3000/api/income-heads",
              "POST",
              tokenRecepA,
              { name: "Unauthorized", code: "UNAUTH" }
            )
          ),
        () =>
          IncomeHeadSeedRoute.POST(
            makeReq(
              "http://localhost:3000/api/income-heads/seed",
              "POST",
              tokenRecepA
            )
          ),
        () =>
          IncomesRoute.GET(
            makeReq("http://localhost:3000/api/incomes", "GET", tokenRecepA)
          ),
        () =>
          IncomesRoute.POST(
            makeReq("http://localhost:3000/api/incomes", "POST", tokenRecepA, {
              incomeHeadId: "cuid",
              title: "Test",
              expectedAmount: 100,
            })
          ),
        () =>
          IncomeDetailRoute.GET(
            makeReq(
              "http://localhost:3000/api/incomes/dummy-id",
              "GET",
              tokenRecepA
            ),
            { params: Promise.resolve({ id: "dummy-id" }) }
          ),
        () =>
          IncomeVoidRoute.POST(
            makeReq(
              "http://localhost:3000/api/incomes/dummy-id/void",
              "POST",
              tokenRecepA,
              { voidReason: "Test" }
            ),
            { params: Promise.resolve({ id: "dummy-id" }) }
          ),
      ];

      for (const call of endpoints) {
        const res = await call();
        assert.strictEqual(
          res.status,
          403,
          `Endpoint must reject RECEPTIONIST with 403`
        );
        const json = await res.json();
        assert.ok(json.error);
      }
    });

    it("requires SUPER_ADMIN to specify a propertyId on query endpoints", async () => {
      const res = await IncomeHeadsRoute.GET(
        makeReq("http://localhost:3000/api/income-heads", "GET", tokenSuper)
      );
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(String(json.error).includes("propertyId"));
    });
  });

  // =========================================================================
  // 2. Income Heads Management via API
  // =========================================================================
  describe("2. Income Heads API Handlers", () => {
    it("seeds default categories via POST /api/income-heads/seed", async () => {
      const res = await IncomeHeadSeedRoute.POST(
        makeReq(
          "http://localhost:3000/api/income-heads/seed",
          "POST",
          tokenAdminA
        )
      );
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.seededCount >= 5);
    });

    it("lists seeded categories via GET /api/income-heads", async () => {
      const res = await IncomeHeadsRoute.GET(
        makeReq("http://localhost:3000/api/income-heads", "GET", tokenAdminA)
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.incomeHeads));
      assert.ok(json.incomeHeads.length >= 5);

      const commission = json.incomeHeads.find(
        (h: { code: string }) => h.code === "COMMISSION"
      );
      assert.ok(commission);
    });

    it("creates custom category via POST /api/income-heads", async () => {
      const res = await IncomeHeadsRoute.POST(
        makeReq(
          "http://localhost:3000/api/income-heads",
          "POST",
          tokenAdminA,
          {
            name: "Vending Machine Royalty",
            code: "VENDING_ROYALTY",
            description: "Quarterly proceeds from snack and beverage machines",
          }
        )
      );
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.incomeHead.code, "VENDING_ROYALTY");
      createdIncomeHeadId = json.incomeHead.id;
    });

    it("retrieves income head details via GET /api/income-heads/[id]", async () => {
      const res = await IncomeHeadDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/income-heads/${createdIncomeHeadId}`,
          "GET",
          tokenAdminA
        ),
        { params: Promise.resolve({ id: createdIncomeHeadId }) }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.incomeHead.id, createdIncomeHeadId);
      assert.strictEqual(json.incomeHead.name, "Vending Machine Royalty");
    });

    it("updates income head name and description via PATCH /api/income-heads/[id]", async () => {
      const res = await IncomeHeadDetailRoute.PATCH(
        makeReq(
          `http://localhost:3000/api/income-heads/${createdIncomeHeadId}`,
          "PATCH",
          tokenAdminA,
          {
            name: "Snack & Drink Machine Royalties",
            description: "Updated description",
          }
        ),
        { params: Promise.resolve({ id: createdIncomeHeadId }) }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.incomeHead.name, "Snack & Drink Machine Royalties");
      assert.strictEqual(json.incomeHead.code, "VENDING_ROYALTY"); // Preserved
    });

    it("rejects attempt to alter income head code via PATCH /api/income-heads/[id]", async () => {
      const res = await IncomeHeadDetailRoute.PATCH(
        makeReq(
          `http://localhost:3000/api/income-heads/${createdIncomeHeadId}`,
          "PATCH",
          tokenAdminA,
          {
            code: "MUTATED_CODE",
          }
        ),
        { params: Promise.resolve({ id: createdIncomeHeadId }) }
      );
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error, "Validation error");
      assert.ok(JSON.stringify(json.details).includes("immutable"));
    });

    it("deletes an unreferenced income head cleanly via DELETE /api/income-heads/[id]", async () => {
      // Create temporary category
      const createRes = await IncomeHeadsRoute.POST(
        makeReq(
          "http://localhost:3000/api/income-heads",
          "POST",
          tokenAdminA,
          { name: "To Delete Via API", code: "API_DEL" }
        )
      );
      const tempId = (await createRes.json()).incomeHead.id;

      const delRes = await IncomeHeadDetailRoute.DELETE(
        makeReq(
          `http://localhost:3000/api/income-heads/${tempId}`,
          "DELETE",
          tokenAdminA
        ),
        { params: Promise.resolve({ id: tempId }) }
      );
      assert.strictEqual(delRes.status, 200);
      const json = await delRes.json();
      assert.strictEqual(json.success, true);
    });
  });

  // =========================================================================
  // 3. Direct Income Lifecycle via API
  // =========================================================================
  describe("3. Direct Income Lifecycle & Itemized Receipts API", () => {
    it("creates a direct income record with status PENDING via POST /api/incomes", async () => {
      const res = await IncomesRoute.POST(
        makeReq("http://localhost:3000/api/incomes", "POST", tokenAdminA, {
          incomeHeadId: createdIncomeHeadId,
          title: "Q3 Snack Machine Royalties",
          expectedAmount: 400,
          description: "August and September earnings",
          incomeDate: "2026-09-30",
        })
      );
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.income.status, "PENDING");
      assert.strictEqual(json.income.expectedAmount, "400.00");
      assert.strictEqual(json.income.receivedAmount, "0.00");
      assert.strictEqual(json.income.outstandingAmount, "400.00");
      createdIncomeId = json.income.id;
    });

    it("lists incomes with pagination and filter via GET /api/incomes", async () => {
      const res = await IncomesRoute.GET(
        makeReq(
          `http://localhost:3000/api/incomes?status=PENDING&page=1&limit=10`,
          "GET",
          tokenAdminA
        )
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.incomes));
      const found = json.incomes.find((i: { id: string }) => i.id === createdIncomeId);
      assert.ok(found);
    });

    it("retrieves income details via GET /api/incomes/[id]", async () => {
      const res = await IncomeDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/incomes/${createdIncomeId}`,
          "GET",
          tokenAdminA
        ),
        { params: Promise.resolve({ id: createdIncomeId }) }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.income.id, createdIncomeId);
      assert.deepStrictEqual(json.income.receipts, []);
    });

    it("updates income title and expected amount via PATCH /api/incomes/[id]", async () => {
      const res = await IncomeDetailRoute.PATCH(
        makeReq(
          `http://localhost:3000/api/incomes/${createdIncomeId}`,
          "PATCH",
          tokenAdminA,
          {
            title: "Q3 Vending Royalties - Corrected",
            expectedAmount: 500,
          }
        ),
        { params: Promise.resolve({ id: createdIncomeId }) }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.income.title, "Q3 Vending Royalties - Corrected");
      assert.strictEqual(json.income.expectedAmount, "500.00");
      assert.strictEqual(json.income.outstandingAmount, "500.00");
    });

    it("records a partial receipt collection via POST /api/incomes/[id]/receipts", async () => {
      const res = await IncomeReceiptsRoute.POST(
        makeReq(
          `http://localhost:3000/api/incomes/${createdIncomeId}/receipts`,
          "POST",
          tokenAdminA,
          {
            amount: 200,
            accountId: accountA.id,
            paymentMethod: "BANK_TRANSFER",
            referenceNumber: "TXN-VEND-001",
          }
        ),
        { params: Promise.resolve({ id: createdIncomeId }) }
      );
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.income.status, "PARTIALLY_RECEIVED");
      assert.strictEqual(json.income.receivedAmount, "200.00");
      assert.strictEqual(json.income.outstandingAmount, "300.00");
      assert.strictEqual(json.receipt.amount, "200.00");
      recordedReceiptId = json.receipt.id;
    });

    it("records second collection to reach RECEIVED status", async () => {
      const res = await IncomeReceiptsRoute.POST(
        makeReq(
          `http://localhost:3000/api/incomes/${createdIncomeId}/receipts`,
          "POST",
          tokenAdminA,
          {
            amount: 300,
            accountId: accountA.id,
            paymentMethod: "CASH",
            referenceNumber: "CASH-REC-002",
          }
        ),
        { params: Promise.resolve({ id: createdIncomeId }) }
      );
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.income.status, "RECEIVED");
      assert.strictEqual(json.income.receivedAmount, "500.00");
      assert.strictEqual(json.income.outstandingAmount, "0.00");
    });

    it("strictly rejects voiding an income while active collections exist", async () => {
      const res = await IncomeVoidRoute.POST(
        makeReq(
          `http://localhost:3000/api/incomes/${createdIncomeId}/void`,
          "POST",
          tokenAdminA,
          { voidReason: "Customer canceled agreement" }
        ),
        { params: Promise.resolve({ id: createdIncomeId }) }
      );
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(String(json.error).includes("active collections"));
    });

    it("voids individual receipt via POST /api/incomes/[id]/receipts/[receiptId]/void", async () => {
      const res = await IncomeReceiptVoidRoute.POST(
        makeReq(
          `http://localhost:3000/api/incomes/${createdIncomeId}/receipts/${recordedReceiptId}/void`,
          "POST",
          tokenAdminA,
          { voidReason: "Check bounced / reversal required" }
        ),
        { params: Promise.resolve({ id: createdIncomeId, receiptId: recordedReceiptId }) }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.income.status, "PARTIALLY_RECEIVED");
      assert.strictEqual(json.income.receivedAmount, "300.00");
      assert.strictEqual(json.income.outstandingAmount, "200.00");

      const voidedReceipt = json.income.receipts.find(
        (r: { id: string }) => r.id === recordedReceiptId
      );
      assert.strictEqual(voidedReceipt.status, "VOIDED");
      assert.strictEqual(voidedReceipt.voidReason, "Check bounced / reversal required");
    });
  });

  // =========================================================================
  // 4. Cross-Property Isolation & Super Admin Scope
  // =========================================================================
  describe("4. Cross-Property Isolation & Super Admin Access", () => {
    it("prevents Admin A from querying or mutating Property B's incomes", async () => {
      // Admin A tries to pass propertyId of Property B
      const res = await IncomesRoute.GET(
        makeReq(
          `http://localhost:3000/api/incomes?propertyId=${propB.id}`,
          "GET",
          tokenAdminA
        )
      );
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.ok(String(json.error).includes("Access denied"));
    });

    it("prevents Admin B from querying Property A's specific income record", async () => {
      const res = await IncomeDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/incomes/${createdIncomeId}`,
          "GET",
          tokenAdminB
        ),
        { params: Promise.resolve({ id: createdIncomeId }) }
      );
      assert.strictEqual(res.status, 404);
    });

    it("prevents Admin A from recording receipt to an account belonging to Property B", async () => {
      const res = await IncomeReceiptsRoute.POST(
        makeReq(
          `http://localhost:3000/api/incomes/${createdIncomeId}/receipts`,
          "POST",
          tokenAdminA,
          {
            amount: 50,
            accountId: accountB.id, // Property B's account
            paymentMethod: "CASH",
          }
        ),
        { params: Promise.resolve({ id: createdIncomeId }) }
      );
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(String(json.error).includes("belongs to another property"));
    });

    it("allows SUPER_ADMIN to query Property A and Property B explicitly", async () => {
      const resA = await IncomesRoute.GET(
        makeReq(
          `http://localhost:3000/api/incomes?propertyId=${propA.id}`,
          "GET",
          tokenSuper
        )
      );
      assert.strictEqual(resA.status, 200);
      const jsonA = await resA.json();
      assert.strictEqual(jsonA.success, true);

      const resB = await IncomesRoute.GET(
        makeReq(
          `http://localhost:3000/api/incomes?propertyId=${propB.id}`,
          "GET",
          tokenSuper
        )
      );
      assert.strictEqual(resB.status, 200);
      const jsonB = await resB.json();
      assert.strictEqual(jsonB.success, true);
    });
  });
});
