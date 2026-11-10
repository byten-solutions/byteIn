import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { RoleName, AccountType } from "@prisma/client";
import { AuthService } from "../src/modules/auth/auth.service";

// Route Handlers under test
import * as ExpenseHeadsRoute from "../src/app/api/expense-heads/route";
import * as ExpenseHeadSeedRoute from "../src/app/api/expense-heads/seed/route";
import * as ExpenseHeadDetailRoute from "../src/app/api/expense-heads/[id]/route";
import * as ExpensesRoute from "../src/app/api/expenses/route";
import * as ExpenseDetailRoute from "../src/app/api/expenses/[id]/route";
import * as ExpenseVoidRoute from "../src/app/api/expenses/[id]/void/route";
import * as ExpensePaymentsRoute from "../src/app/api/expenses/[id]/payments/route";
import * as ExpensePaymentVoidRoute from "../src/app/api/expenses/[id]/payments/[paymentId]/void/route";

describe("Phase 4 Stage 2: Expense Management API Route Handlers", () => {
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
  let pmA: { id: string };

  let createdExpenseHeadId: string;
  let createdExpenseId: string;
  let recordedPaymentId: string;
  let secondPaymentId: string;

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
        name: `Expense Route Hotel A ${timestamp}`,
        city: "Bangalore",
        status: "ACTIVE",
      },
    });

    propB = await prisma.property.create({
      data: {
        name: `Expense Route Hotel B ${timestamp}`,
        city: "Hyderabad",
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
        openingBalance: 5000,
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
        openingBalance: 1000,
        openingBalanceDate: new Date("2026-01-01"),
        isDefault: true,
        isActive: true,
      },
    });

    // 6. Setup Payment Methods
    pmA = await prisma.paymentMethod.create({
      data: {
        id: `pm_bank_${timestamp}`,
        propertyId: propA.id,
        name: "Corporate Bank Transfer",
        code: "BANK_TRANSFER",
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
    await prisma.payment.deleteMany({
      where: { propertyId: { in: [propA.id, propB.id] } },
    });
    await prisma.expense.deleteMany({
      where: { propertyId: { in: [propA.id, propB.id] } },
    });
    await prisma.expenseHead.deleteMany({
      where: { propertyId: { in: [propA.id, propB.id] } },
    });
    await prisma.paymentMethod.deleteMany({
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
      const res = await ExpenseHeadsRoute.GET(
        makeReq("http://localhost:3000/api/expense-heads", "GET")
      );
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.ok(json.error);
    });

    it("strictly rejects RECEPTIONIST with 403 on all expense endpoints", async () => {
      const endpoints = [
        () =>
          ExpenseHeadsRoute.GET(
            makeReq("http://localhost:3000/api/expense-heads", "GET", tokenRecepA)
          ),
        () =>
          ExpenseHeadsRoute.POST(
            makeReq(
              "http://localhost:3000/api/expense-heads",
              "POST",
              tokenRecepA,
              { name: "Unauthorized", code: "UNAUTH" }
            )
          ),
        () =>
          ExpenseHeadSeedRoute.POST(
            makeReq(
              "http://localhost:3000/api/expense-heads/seed",
              "POST",
              tokenRecepA
            )
          ),
        () =>
          ExpensesRoute.GET(
            makeReq("http://localhost:3000/api/expenses", "GET", tokenRecepA)
          ),
        () =>
          ExpensesRoute.POST(
            makeReq("http://localhost:3000/api/expenses", "POST", tokenRecepA, {
              expenseHeadId: "cuid",
              title: "Test",
              amount: 100,
            })
          ),
        () =>
          ExpenseDetailRoute.GET(
            makeReq(
              "http://localhost:3000/api/expenses/dummy-id",
              "GET",
              tokenRecepA
            ),
            { params: Promise.resolve({ id: "dummy-id" }) }
          ),
        () =>
          ExpenseVoidRoute.POST(
            makeReq(
              "http://localhost:3000/api/expenses/dummy-id/void",
              "POST",
              tokenRecepA,
              { voidReason: "Test" }
            ),
            { params: Promise.resolve({ id: "dummy-id" }) }
          ),
        () =>
          ExpensePaymentsRoute.POST(
            makeReq(
              "http://localhost:3000/api/expenses/dummy-id/payments",
              "POST",
              tokenRecepA,
              {
                accountId: accountA.id,
                amount: 50,
              }
            ),
            { params: Promise.resolve({ id: "dummy-id" }) }
          ),
        () =>
          ExpensePaymentVoidRoute.POST(
            makeReq(
              "http://localhost:3000/api/expenses/dummy-id/payments/dummy-pid/void",
              "POST",
              tokenRecepA,
              { voidReason: "Test" }
            ),
            { params: Promise.resolve({ id: "dummy-id", paymentId: "dummy-pid" }) }
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
      const res = await ExpenseHeadsRoute.GET(
        makeReq("http://localhost:3000/api/expense-heads", "GET", tokenSuper)
      );
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(String(json.error).toLowerCase().includes("propertyid"));
    });
  });

  // =========================================================================
  // 2. Expense Heads Management via API
  // =========================================================================
  describe("2. Expense Heads API Handlers", () => {
    it("seeds default categories via POST /api/expense-heads/seed", async () => {
      const res = await ExpenseHeadSeedRoute.POST(
        makeReq(
          "http://localhost:3000/api/expense-heads/seed",
          "POST",
          tokenAdminA
        )
      );
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.seededCount >= 6);
    });

    it("is idempotent when re-seeding default categories", async () => {
      const res = await ExpenseHeadSeedRoute.POST(
        makeReq(
          "http://localhost:3000/api/expense-heads/seed",
          "POST",
          tokenAdminA
        )
      );
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.seededCount, 0); // Already seeded
    });

    it("lists seeded categories via GET /api/expense-heads", async () => {
      const res = await ExpenseHeadsRoute.GET(
        makeReq("http://localhost:3000/api/expense-heads", "GET", tokenAdminA)
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.expenseHeads));
      assert.ok(json.expenseHeads.length >= 6);

      const utilities = json.expenseHeads.find(
        (h: { code: string }) => h.code === "UTILITIES"
      );
      assert.ok(utilities);
    });

    it("creates custom category via POST /api/expense-heads", async () => {
      const res = await ExpenseHeadsRoute.POST(
        makeReq(
          "http://localhost:3000/api/expense-heads",
          "POST",
          tokenAdminA,
          {
            name: "Linen Replacement",
            code: "LINEN_REPLACEMENT",
            description: "Bedsheets, duvet covers and towels procurement",
          }
        )
      );
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.expenseHead.code, "LINEN_REPLACEMENT");
      createdExpenseHeadId = json.expenseHead.id;
    });

    it("retrieves expense head details via GET /api/expense-heads/[id]", async () => {
      const res = await ExpenseHeadDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/expense-heads/${createdExpenseHeadId}`,
          "GET",
          tokenAdminA
        ),
        { params: Promise.resolve({ id: createdExpenseHeadId }) }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.expenseHead.id, createdExpenseHeadId);
      assert.strictEqual(json.expenseHead.name, "Linen Replacement");
    });

    it("updates expense head name and description via PATCH /api/expense-heads/[id]", async () => {
      const res = await ExpenseHeadDetailRoute.PATCH(
        makeReq(
          `http://localhost:3000/api/expense-heads/${createdExpenseHeadId}`,
          "PATCH",
          tokenAdminA,
          {
            name: "Linen & Towel Replacement",
            description: "Updated description for linen and towels",
          }
        ),
        { params: Promise.resolve({ id: createdExpenseHeadId }) }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.expenseHead.name, "Linen & Towel Replacement");
      assert.strictEqual(json.expenseHead.code, "LINEN_REPLACEMENT"); // Immutable
    });

    it("rejects attempt to alter expense head code via PATCH /api/expense-heads/[id]", async () => {
      const res = await ExpenseHeadDetailRoute.PATCH(
        makeReq(
          `http://localhost:3000/api/expense-heads/${createdExpenseHeadId}`,
          "PATCH",
          tokenAdminA,
          {
            code: "MUTATED_CODE",
          }
        ),
        { params: Promise.resolve({ id: createdExpenseHeadId }) }
      );
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error, "Validation error");
      assert.ok(JSON.stringify(json.details).includes("immutable"));
    });

    it("deletes an unreferenced expense head cleanly via DELETE /api/expense-heads/[id]", async () => {
      const createRes = await ExpenseHeadsRoute.POST(
        makeReq(
          "http://localhost:3000/api/expense-heads",
          "POST",
          tokenAdminA,
          { name: "To Delete Via API", code: "API_DEL" }
        )
      );
      const tempId = (await createRes.json()).expenseHead.id;

      const delRes = await ExpenseHeadDetailRoute.DELETE(
        makeReq(
          `http://localhost:3000/api/expense-heads/${tempId}`,
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
  // 3. Expense Lifecycle & Itemized Payments API
  // =========================================================================
  describe("3. Expense Lifecycle & Itemized Payments API", () => {
    it("creates an expense record with status PENDING via POST /api/expenses", async () => {
      const res = await ExpensesRoute.POST(
        makeReq("http://localhost:3000/api/expenses", "POST", tokenAdminA, {
          expenseHeadId: createdExpenseHeadId,
          title: "New Egyptian Cotton Linens",
          amount: 600,
          description: "Batch of 50 king-size bedsheets",
          vendorName: "Bombay Dyeing Ltd",
          referenceNumber: "INV-BD-9988",
          expenseDate: "2026-10-15",
        })
      );
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.expense.status, "PENDING");
      assert.strictEqual(json.expense.amount, "600.00");
      assert.strictEqual(json.expense.paidAmount, "0.00");
      assert.strictEqual(json.expense.outstandingAmount, "600.00");
      assert.strictEqual(json.expense.vendorName, "Bombay Dyeing Ltd");
      createdExpenseId = json.expense.id;
    });

    it("lists expenses with pagination and summary metrics via GET /api/expenses?summary=true", async () => {
      const res = await ExpensesRoute.GET(
        makeReq(
          `http://localhost:3000/api/expenses?status=PENDING&page=1&limit=10&summary=true`,
          "GET",
          tokenAdminA
        )
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.expenses));
      const found = json.expenses.find((e: { id: string }) => e.id === createdExpenseId);
      assert.ok(found);
      assert.ok(json.summary);
      assert.strictEqual(typeof json.summary.totalIncurred, "string");
      assert.strictEqual(typeof json.summary.totalPaid, "string");
      assert.strictEqual(typeof json.summary.totalOutstanding, "string");
    });

    it("retrieves expense details via GET /api/expenses/[id]", async () => {
      const res = await ExpenseDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/expenses/${createdExpenseId}`,
          "GET",
          tokenAdminA
        ),
        { params: Promise.resolve({ id: createdExpenseId }) }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.expense.id, createdExpenseId);
      assert.deepStrictEqual(json.expense.payments, []);
    });

    it("updates expense title and amount via PATCH /api/expenses/[id]", async () => {
      const res = await ExpenseDetailRoute.PATCH(
        makeReq(
          `http://localhost:3000/api/expenses/${createdExpenseId}`,
          "PATCH",
          tokenAdminA,
          {
            title: "New Egyptian Cotton Linens - Updated Batch",
            amount: 700,
          }
        ),
        { params: Promise.resolve({ id: createdExpenseId }) }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.expense.title, "New Egyptian Cotton Linens - Updated Batch");
      assert.strictEqual(json.expense.amount, "700.00");
      assert.strictEqual(json.expense.outstandingAmount, "700.00");
    });

    it("records a partial payment disbursement via POST /api/expenses/[id]/payments", async () => {
      const idempotencyKey = `idem-route-test-${timestamp}-1`;
      const res = await ExpensePaymentsRoute.POST(
        makeReq(
          `http://localhost:3000/api/expenses/${createdExpenseId}/payments`,
          "POST",
          tokenAdminA,
          {
            amount: 300,
            accountId: accountA.id,
            paymentMethodId: pmA.id,
            referenceNumber: "TXN-EXP-001",
            idempotencyKey,
            paidAt: "2026-10-16T10:00:00.000Z",
          }
        ),
        { params: Promise.resolve({ id: createdExpenseId }) }
      );
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.expense.status, "PARTIALLY_PAID");
      assert.strictEqual(json.expense.paidAmount, "300.00");
      assert.strictEqual(json.expense.outstandingAmount, "400.00");
      assert.strictEqual(json.payment.amount, "300.00");
      assert.strictEqual(json.payment.idempotencyKey, idempotencyKey);
      recordedPaymentId = json.payment.id;
    });

    it("replays payment safely with identical idempotency key (idempotent replay)", async () => {
      const idempotencyKey = `idem-route-test-${timestamp}-1`;
      const res = await ExpensePaymentsRoute.POST(
        makeReq(
          `http://localhost:3000/api/expenses/${createdExpenseId}/payments`,
          "POST",
          tokenAdminA,
          {
            amount: 300,
            accountId: accountA.id,
            paymentMethodId: pmA.id,
            referenceNumber: "TXN-EXP-001",
            idempotencyKey,
            paidAt: "2026-10-16T10:00:00.000Z",
          }
        ),
        { params: Promise.resolve({ id: createdExpenseId }) }
      );
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.idempotentReplay, true);
      assert.strictEqual(json.payment.id, recordedPaymentId);
      assert.strictEqual(json.expense.paidAmount, "300.00");
    });

    it("rejects reuse of idempotency key with conflicting details (409 Conflict)", async () => {
      const idempotencyKey = `idem-route-test-${timestamp}-1`;
      const res = await ExpensePaymentsRoute.POST(
        makeReq(
          `http://localhost:3000/api/expenses/${createdExpenseId}/payments`,
          "POST",
          tokenAdminA,
          {
            amount: 350, // Different amount!
            accountId: accountA.id,
            paymentMethodId: pmA.id,
            idempotencyKey,
          }
        ),
        { params: Promise.resolve({ id: createdExpenseId }) }
      );
      assert.strictEqual(res.status, 409);
      const json = await res.json();
      assert.ok(String(json.error).includes("different details"));
    });

    it("rejects reducing expense amount below already paid amount (300.00)", async () => {
      const res = await ExpenseDetailRoute.PATCH(
        makeReq(
          `http://localhost:3000/api/expenses/${createdExpenseId}`,
          "PATCH",
          tokenAdminA,
          {
            amount: 250, // Below paid 300
          }
        ),
        { params: Promise.resolve({ id: createdExpenseId }) }
      );
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(
        String(json.error).includes("cannot be less than") ||
          String(json.error).includes("cannot be reduced below")
      );
    });

    it("rejects payment that exceeds financial account liquid balance", async () => {
      // Create empty account with 10.00 balance
      const emptyAccount = await prisma.financialAccount.create({
        data: {
          propertyId: propA.id,
          accountName: `Low Balance Account ${timestamp}`,
          accountType: AccountType.CASH,
          openingBalance: 10,
          openingBalanceDate: new Date("2026-01-01"),
          isActive: true,
        },
      });

      const res = await ExpensePaymentsRoute.POST(
        makeReq(
          `http://localhost:3000/api/expenses/${createdExpenseId}/payments`,
          "POST",
          tokenAdminA,
          {
            amount: 200,
            accountId: emptyAccount.id,
          }
        ),
        { params: Promise.resolve({ id: createdExpenseId }) }
      );
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(String(json.error).includes("Insufficient funds"));
    });

    it("records second disbursement to reach PAID status", async () => {
      const res = await ExpensePaymentsRoute.POST(
        makeReq(
          `http://localhost:3000/api/expenses/${createdExpenseId}/payments`,
          "POST",
          tokenAdminA,
          {
            amount: 400,
            accountId: accountA.id,
            paymentMethodId: pmA.id,
            referenceNumber: "TXN-EXP-002",
          }
        ),
        { params: Promise.resolve({ id: createdExpenseId }) }
      );
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.expense.status, "PAID");
      assert.strictEqual(json.expense.paidAmount, "700.00");
      assert.strictEqual(json.expense.outstandingAmount, "0.00");
      secondPaymentId = json.payment.id;
    });

    it("strictly rejects voiding an expense while active payments exist", async () => {
      const res = await ExpenseVoidRoute.POST(
        makeReq(
          `http://localhost:3000/api/expenses/${createdExpenseId}/void`,
          "POST",
          tokenAdminA,
          { voidReason: "Vendor order canceled" }
        ),
        { params: Promise.resolve({ id: createdExpenseId }) }
      );
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(String(json.error).includes("active payments"));
    });

    it("voids individual payment via POST /api/expenses/[id]/payments/[paymentId]/void", async () => {
      const res = await ExpensePaymentVoidRoute.POST(
        makeReq(
          `http://localhost:3000/api/expenses/${createdExpenseId}/payments/${recordedPaymentId}/void`,
          "POST",
          tokenAdminA,
          { voidReason: "Disbursement made from wrong account" }
        ),
        { params: Promise.resolve({ id: createdExpenseId, paymentId: recordedPaymentId }) }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.expense.status, "PARTIALLY_PAID");
      assert.strictEqual(json.expense.paidAmount, "400.00");
      assert.strictEqual(json.expense.outstandingAmount, "300.00");

      const voidedPayment = json.expense.payments.find(
        (p: { id: string }) => p.id === recordedPaymentId
      );
      assert.strictEqual(voidedPayment.status, "VOIDED");
      assert.strictEqual(voidedPayment.voidReason, "Disbursement made from wrong account");
    });

    it("voids remaining payment and then voids the expense record", async () => {
      // Void second payment
      const voidRes = await ExpensePaymentVoidRoute.POST(
        makeReq(
          `http://localhost:3000/api/expenses/${createdExpenseId}/payments/${secondPaymentId}/void`,
          "POST",
          tokenAdminA,
          { voidReason: "Vendor refunded full amount" }
        ),
        { params: Promise.resolve({ id: createdExpenseId, paymentId: secondPaymentId }) }
      );
      assert.strictEqual(voidRes.status, 200);
      assert.strictEqual((await voidRes.json()).expense.status, "PENDING");

      // Now void the expense
      const res = await ExpenseVoidRoute.POST(
        makeReq(
          `http://localhost:3000/api/expenses/${createdExpenseId}/void`,
          "POST",
          tokenAdminA,
          { voidReason: "Contract mutually terminated" }
        ),
        { params: Promise.resolve({ id: createdExpenseId }) }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.expense.status, "VOID");
      assert.strictEqual(json.expense.voidReason, "Contract mutually terminated");
    });
  });

  // =========================================================================
  // 4. Cross-Property Isolation & Super Admin Explicit PropertyId Enforcement
  // =========================================================================
  describe("4. Cross-Property Isolation & Super Admin Explicit PropertyId Enforcement", () => {
    let testExpAId: string;
    let testExpBId: string;
    let testHeadAId: string;
    let testHeadBId: string;

    before(async () => {
      // Create categories and active expenses in Property A and Property B
      const headA = await prisma.expenseHead.create({
        data: {
          propertyId: propA.id,
          name: `Category Prop A ${timestamp}`,
          code: `CAT_A_${timestamp}`,
        },
      });
      testHeadAId = headA.id;

      const headB = await prisma.expenseHead.create({
        data: {
          propertyId: propB.id,
          name: `Category Prop B ${timestamp}`,
          code: `CAT_B_${timestamp}`,
        },
      });
      testHeadBId = headB.id;

      const expA = await prisma.expense.create({
        data: {
          propertyId: propA.id,
          expenseHeadId: headA.id,
          title: `Expense Prop A ${timestamp}`,
          amount: 500,
          status: "PENDING",
          createdBy: userAdminA.id,
        },
      });
      testExpAId = expA.id;

      const expB = await prisma.expense.create({
        data: {
          propertyId: propB.id,
          expenseHeadId: headB.id,
          title: `Expense Prop B ${timestamp}`,
          amount: 500,
          status: "PENDING",
          createdBy: userAdminB.id,
        },
      });
      testExpBId = expB.id;
    });

    // 4.1 Missing propertyId for Super Admin
    it("strictly rejects Super Admin on entity GET endpoints when propertyId is missing", async () => {
      const resExp = await ExpenseDetailRoute.GET(
        makeReq(`http://localhost:3000/api/expenses/${testExpAId}`, "GET", tokenSuper),
        { params: Promise.resolve({ id: testExpAId }) }
      );
      assert.strictEqual(resExp.status, 400);
      const jsonExp = await resExp.json();
      assert.ok(String(jsonExp.error).toLowerCase().includes("propertyid"));

      const resHead = await ExpenseHeadDetailRoute.GET(
        makeReq(`http://localhost:3000/api/expense-heads/${testHeadAId}`, "GET", tokenSuper),
        { params: Promise.resolve({ id: testHeadAId }) }
      );
      assert.strictEqual(resHead.status, 400);
      const jsonHead = await resHead.json();
      assert.ok(String(jsonHead.error).toLowerCase().includes("propertyid"));
    });

    it("strictly rejects Super Admin on entity PATCH/DELETE/POST endpoints when propertyId is missing", async () => {
      const resPatch = await ExpenseDetailRoute.PATCH(
        makeReq(`http://localhost:3000/api/expenses/${testExpAId}`, "PATCH", tokenSuper, {
          title: "New Title Without Property",
        }),
        { params: Promise.resolve({ id: testExpAId }) }
      );
      assert.strictEqual(resPatch.status, 400);
      assert.ok(String((await resPatch.json()).error).toLowerCase().includes("propertyid"));

      const resDelHead = await ExpenseHeadDetailRoute.DELETE(
        makeReq(`http://localhost:3000/api/expense-heads/${testHeadAId}`, "DELETE", tokenSuper),
        { params: Promise.resolve({ id: testHeadAId }) }
      );
      assert.strictEqual(resDelHead.status, 400);
      assert.ok(String((await resDelHead.json()).error).toLowerCase().includes("propertyid"));

      const resVoid = await ExpenseVoidRoute.POST(
        makeReq(`http://localhost:3000/api/expenses/${testExpAId}/void`, "POST", tokenSuper, {
          voidReason: "Super Admin Void Attempt",
        }),
        { params: Promise.resolve({ id: testExpAId }) }
      );
      assert.strictEqual(resVoid.status, 400);
      assert.ok(String((await resVoid.json()).error).toLowerCase().includes("propertyid"));

      const resPay = await ExpensePaymentsRoute.POST(
        makeReq(`http://localhost:3000/api/expenses/${testExpAId}/payments`, "POST", tokenSuper, {
          accountId: accountA.id,
          amount: 50,
        }),
        { params: Promise.resolve({ id: testExpAId }) }
      );
      assert.strictEqual(resPay.status, 400);
      assert.ok(String((await resPay.json()).error).toLowerCase().includes("propertyid"));

      const resVoidPay = await ExpensePaymentVoidRoute.POST(
        makeReq(
          `http://localhost:3000/api/expenses/${testExpAId}/payments/dummy-pid/void`,
          "POST",
          tokenSuper,
          { voidReason: "Super Admin Void Pay Attempt" }
        ),
        { params: Promise.resolve({ id: testExpAId, paymentId: "dummy-pid" }) }
      );
      assert.strictEqual(resVoidPay.status, 400);
      assert.ok(String((await resVoidPay.json()).error).toLowerCase().includes("propertyid"));
    });

    // 4.2 Matching propertyId for Super Admin
    it("allows Super Admin when explicit propertyId matches target entity property", async () => {
      // Test Property A match
      const resExpA = await ExpenseDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/expenses/${testExpAId}?propertyId=${propA.id}`,
          "GET",
          tokenSuper
        ),
        { params: Promise.resolve({ id: testExpAId }) }
      );
      assert.strictEqual(resExpA.status, 200);
      const jsonExpA = await resExpA.json();
      assert.strictEqual(jsonExpA.success, true);
      assert.strictEqual(jsonExpA.expense.id, testExpAId);

      const resHeadA = await ExpenseHeadDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/expense-heads/${testHeadAId}?propertyId=${propA.id}`,
          "GET",
          tokenSuper
        ),
        { params: Promise.resolve({ id: testHeadAId }) }
      );
      assert.strictEqual(resHeadA.status, 200);
      const jsonHeadA = await resHeadA.json();
      assert.strictEqual(jsonHeadA.success, true);
      assert.strictEqual(jsonHeadA.expenseHead.id, testHeadAId);

      // Test Property B match
      const resExpB = await ExpenseDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/expenses/${testExpBId}?propertyId=${propB.id}`,
          "GET",
          tokenSuper
        ),
        { params: Promise.resolve({ id: testExpBId }) }
      );
      assert.strictEqual(resExpB.status, 200);
      const jsonExpB = await resExpB.json();
      assert.strictEqual(jsonExpB.success, true);
      assert.strictEqual(jsonExpB.expense.id, testExpBId);

      const resHeadB = await ExpenseHeadDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/expense-heads/${testHeadBId}?propertyId=${propB.id}`,
          "GET",
          tokenSuper
        ),
        { params: Promise.resolve({ id: testHeadBId }) }
      );
      assert.strictEqual(resHeadB.status, 200);
      const jsonHeadB = await resHeadB.json();
      assert.strictEqual(jsonHeadB.success, true);
      assert.strictEqual(jsonHeadB.expenseHead.id, testHeadBId);
    });

    // 4.3 Mismatched propertyId for Super Admin
    it("rejects Super Admin when explicit propertyId does not match target entity property", async () => {
      // testExpAId belongs to propA, but Super Admin queries with propB.id
      const resExp = await ExpenseDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/expenses/${testExpAId}?propertyId=${propB.id}`,
          "GET",
          tokenSuper
        ),
        { params: Promise.resolve({ id: testExpAId }) }
      );
      assert.strictEqual(resExp.status, 400);
      const jsonExp = await resExp.json();
      assert.ok(String(jsonExp.error).includes("does not belong to the selected property"));

      // testHeadAId belongs to propA, but Super Admin queries with propB.id
      const resHead = await ExpenseHeadDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/expense-heads/${testHeadAId}?propertyId=${propB.id}`,
          "GET",
          tokenSuper
        ),
        { params: Promise.resolve({ id: testHeadAId }) }
      );
      assert.strictEqual(resHead.status, 400);
      const jsonHead = await resHead.json();
      assert.ok(String(jsonHead.error).includes("does not belong to the selected property"));

      // Attempt to patch expense in propA passing propB.id
      const resPatch = await ExpenseDetailRoute.PATCH(
        makeReq(
          `http://localhost:3000/api/expenses/${testExpAId}?propertyId=${propB.id}`,
          "PATCH",
          tokenSuper,
          { title: "Mismatch Attempt" }
        ),
        { params: Promise.resolve({ id: testExpAId }) }
      );
      assert.strictEqual(resPatch.status, 400);
      assert.ok(String((await resPatch.json()).error).includes("does not belong to the selected property"));

      // Attempt to disburse payment on propA expense with propB.id
      const resPay = await ExpensePaymentsRoute.POST(
        makeReq(
          `http://localhost:3000/api/expenses/${testExpAId}/payments?propertyId=${propB.id}`,
          "POST",
          tokenSuper,
          { accountId: accountB.id, amount: 50 }
        ),
        { params: Promise.resolve({ id: testExpAId }) }
      );
      assert.strictEqual(resPay.status, 400);
      assert.ok(String((await resPay.json()).error).includes("does not belong to the selected property"));
    });

    // 4.4 Admin property scoping and cross-property protection
    it("prevents Admin A from querying or mutating Property B's expenses via query override", async () => {
      const res = await ExpensesRoute.GET(
        makeReq(
          `http://localhost:3000/api/expenses?propertyId=${propB.id}`,
          "GET",
          tokenAdminA
        )
      );
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.ok(String(json.error).includes("Access denied"));
    });

    it("prevents Admin B from querying Property A's specific expense record", async () => {
      const res = await ExpenseDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/expenses/${testExpAId}`,
          "GET",
          tokenAdminB
        ),
        { params: Promise.resolve({ id: testExpAId }) }
      );
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(String(json.error).includes("does not belong to the selected property"));
    });

    it("prevents Admin B from accessing Property A's expense by passing query override ?propertyId=propA", async () => {
      const res = await ExpenseDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/expenses/${testExpAId}?propertyId=${propA.id}`,
          "GET",
          tokenAdminB
        ),
        { params: Promise.resolve({ id: testExpAId }) }
      );
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.ok(String(json.error).includes("Access denied"));
    });

    it("prevents Admin B from querying Property A's specific category", async () => {
      const res = await ExpenseHeadDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/expense-heads/${testHeadAId}`,
          "GET",
          tokenAdminB
        ),
        { params: Promise.resolve({ id: testHeadAId }) }
      );
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(String(json.error).includes("does not belong to the selected property"));
    });

    it("prevents Admin A from disbursing payment using an account belonging to Property B", async () => {
      const res = await ExpensePaymentsRoute.POST(
        makeReq(
          `http://localhost:3000/api/expenses/${testExpAId}/payments`,
          "POST",
          tokenAdminA,
          {
            amount: 50,
            accountId: accountB.id, // Property B account!
          }
        ),
        { params: Promise.resolve({ id: testExpAId }) }
      );
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(String(json.error).includes("does not exist for this property"));
    });

    it("allows Admin A to access their own Property A expense without specifying propertyId", async () => {
      const res = await ExpenseDetailRoute.GET(
        makeReq(
          `http://localhost:3000/api/expenses/${testExpAId}`,
          "GET",
          tokenAdminA
        ),
        { params: Promise.resolve({ id: testExpAId }) }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.expense.id, testExpAId);
    });

    it("allows Super Admin to explicitly query Property A and Property B lists", async () => {
      const resA = await ExpensesRoute.GET(
        makeReq(
          `http://localhost:3000/api/expenses?propertyId=${propA.id}`,
          "GET",
          tokenSuper
        )
      );
      assert.strictEqual(resA.status, 200);
      const jsonA = await resA.json();
      assert.strictEqual(jsonA.success, true);

      const resB = await ExpensesRoute.GET(
        makeReq(
          `http://localhost:3000/api/expenses?propertyId=${propB.id}`,
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
