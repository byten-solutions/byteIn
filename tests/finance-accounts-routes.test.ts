import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { RoleName, AccountType } from "@prisma/client";
import { AuthService } from "../src/modules/auth/auth.service";

// Route Handlers under test
import * as AccountsRoute from "../src/app/api/financial-accounts/route";
import * as AccountDetailRoute from "../src/app/api/financial-accounts/[id]/route";
import * as AccountStatementRoute from "../src/app/api/financial-accounts/[id]/statement/route";
import * as PaymentMethodsRoute from "../src/app/api/payment-methods/route";
import * as PaymentMethodDetailRoute from "../src/app/api/payment-methods/[id]/route";
import * as AccountTransfersRoute from "../src/app/api/account-transfers/route";

describe("Phase 2 — Financial Management API Routes", () => {
  const time = Date.now();
  let testProp: { id: string; name: string };
  let otherProp: { id: string; name: string };

  let tokenAdmin: string;
  let tokenRecep: string;
  let tokenSuperAdmin: string;

  let operatingAccountId: string;
  let inactiveAccountId: string;
  let createdAccountId: string;

  let inactivePaymentMethodId: string;

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
    // 1. Setup Test Property
    testProp = await prisma.property.create({
      data: {
        name: `Finance Route Hotel ${time}`,
        city: "Mumbai",
        status: "ACTIVE",
      },
    });

    otherProp = await prisma.property.create({
      data: {
        name: `Other Route Hotel ${time}`,
        city: "Delhi",
        status: "ACTIVE",
      },
    });

    // 2. Fetch Roles
    const [adminRole, recepRole, superRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { name: RoleName.ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { name: RoleName.RECEPTIONIST } }),
      prisma.role.findUniqueOrThrow({ where: { name: RoleName.SUPER_ADMIN } }),
    ]);

    // 3. Create Users
    const [userAdmin, userRecep, userSuper] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Admin User",
          email: `admin-${time}@byteinn.test`,
          passwordHash: await AuthService.hashPassword("TestPass@123"),
          roleId: adminRole.id,
          propertyId: testProp.id,
          status: "ACTIVE",
          tokenVersion: 1,
        },
      }),
      prisma.user.create({
        data: {
          name: "Receptionist User",
          email: `recep-${time}@byteinn.test`,
          passwordHash: await AuthService.hashPassword("TestPass@123"),
          roleId: recepRole.id,
          propertyId: testProp.id,
          status: "ACTIVE",
          tokenVersion: 1,
        },
      }),
      prisma.user.create({
        data: {
          name: "Super Admin User",
          email: `super-${time}@byteinn.test`,
          passwordHash: await AuthService.hashPassword("TestPass@123"),
          roleId: superRole.id,
          propertyId: null,
          status: "ACTIVE",
          tokenVersion: 1,
        },
      }),
    ]);

    // 4. Generate Session Tokens
    tokenAdmin = await AuthService.createSessionToken({
      sub: userAdmin.id,
      email: userAdmin.email,
      name: userAdmin.name,
      role: RoleName.ADMIN,
      propertyId: testProp.id,
      tokenVersion: 1,
    });

    tokenRecep = await AuthService.createSessionToken({
      sub: userRecep.id,
      email: userRecep.email,
      name: userRecep.name,
      role: RoleName.RECEPTIONIST,
      propertyId: testProp.id,
      tokenVersion: 1,
    });

    tokenSuperAdmin = await AuthService.createSessionToken({
      sub: userSuper.id,
      email: userSuper.email,
      name: userSuper.name,
      role: RoleName.SUPER_ADMIN,
      propertyId: null,
      tokenVersion: 1,
    });

    // 5. Seed baseline financial accounts
    const opAcc = await prisma.financialAccount.create({
      data: {
        propertyId: testProp.id,
        accountName: "Main Operating Cash",
        accountType: AccountType.CASH,
        openingBalance: 10000,
        openingBalanceDate: new Date("2026-01-01"),
        isDefault: true,
        isActive: true,
      },
    });
    operatingAccountId = opAcc.id;

    const inAcc = await prisma.financialAccount.create({
      data: {
        propertyId: testProp.id,
        accountName: "Old Inactive Safe",
        accountType: AccountType.CASH,
        openingBalance: 0,
        isDefault: false,
        isActive: false,
      },
    });
    inactiveAccountId = inAcc.id;

    // 6. Seed baseline payment methods
    await prisma.paymentMethod.create({
      data: {
        propertyId: testProp.id,
        name: "Desk Cash",
        code: `CASH_${time}`,
        defaultAccountId: operatingAccountId,
        isActive: true,
      },
    });

    const pmIn = await prisma.paymentMethod.create({
      data: {
        propertyId: testProp.id,
        name: "Old Cheque Method",
        code: `CHEQUE_${time}`,
        isActive: false,
      },
    });
    inactivePaymentMethodId = pmIn.id;
  });

  after(async () => {
    await prisma.accountTransfer.deleteMany({
      where: { propertyId: { in: [testProp.id, otherProp.id] } },
    });
    await prisma.receipt.deleteMany({
      where: { propertyId: { in: [testProp.id, otherProp.id] } },
    });
    await prisma.payment.deleteMany({
      where: { propertyId: { in: [testProp.id, otherProp.id] } },
    });
    await prisma.paymentMethod.deleteMany({
      where: { propertyId: { in: [testProp.id, otherProp.id] } },
    });
    await prisma.financialAccount.deleteMany({
      where: { propertyId: { in: [testProp.id, otherProp.id] } },
    });
    await prisma.user.deleteMany({
      where: { propertyId: { in: [testProp.id, otherProp.id] } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: `${time}@byteinn.test` } },
    });
    await prisma.property.deleteMany({
      where: { id: { in: [testProp.id, otherProp.id] } },
    });
  });

  // --------------------------------------------------------------------------
  // Financial Accounts Route Tests
  // --------------------------------------------------------------------------

  it("GET /api/financial-accounts: rejects unauthenticated request with 401", async () => {
    const req = makeReq("http://localhost/api/financial-accounts", "GET");
    const res = await AccountsRoute.GET(req);
    assert.equal(res.status, 401);
  });

  it("GET /api/financial-accounts: Receptionist receives only active accounts", async () => {
    const req = makeReq("http://localhost/api/financial-accounts", "GET", tokenRecep);
    const res = await AccountsRoute.GET(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.accounts));
    assert.ok(body.accounts.length >= 1);

    const hasInactive = body.accounts.some((a: { isActive: boolean }) => !a.isActive);
    assert.equal(hasInactive, false, "Receptionist must never receive inactive accounts");
  });

  it("GET /api/financial-accounts: Admin can list accounts including inactive", async () => {
    const req = makeReq("http://localhost/api/financial-accounts", "GET", tokenAdmin);
    const res = await AccountsRoute.GET(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    const foundInactive = body.accounts.some((a: { id: string }) => a.id === inactiveAccountId);
    assert.equal(foundInactive, true, "Admin should see inactive accounts when not filtering");
  });

  it("GET /api/financial-accounts: SuperAdmin requires explicit propertyId", async () => {
    // Missing propertyId -> 400
    const reqMissing = makeReq("http://localhost/api/financial-accounts", "GET", tokenSuperAdmin);
    const resMissing = await AccountsRoute.GET(reqMissing);
    assert.equal(resMissing.status, 400);

    // Provided propertyId -> 200
    const reqWith = makeReq(
      `http://localhost/api/financial-accounts?propertyId=${testProp.id}`,
      "GET",
      tokenSuperAdmin
    );
    const resWith = await AccountsRoute.GET(reqWith);
    assert.equal(resWith.status, 200);
    const body = await resWith.json();
    assert.ok(body.accounts.length >= 1);
  });

  it("POST /api/financial-accounts: Receptionist receives 403 Forbidden", async () => {
    const req = makeReq("http://localhost/api/financial-accounts", "POST", tokenRecep, {
      accountName: "Hacked Account",
    });
    const res = await AccountsRoute.POST(req);
    assert.equal(res.status, 403);
  });

  it("POST /api/financial-accounts: Admin can create new account with 201", async () => {
    const req = makeReq("http://localhost/api/financial-accounts", "POST", tokenAdmin, {
      accountName: "HDFC Operating Bank",
      accountType: AccountType.BANK,
      openingBalance: 50000,
      openingBalanceDate: "2026-01-01",
    });
    const res = await AccountsRoute.POST(req);
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.account.accountName, "HDFC Operating Bank");
    assert.equal(body.account.accountType, AccountType.BANK);
    assert.equal(body.account.propertyId, testProp.id);
    createdAccountId = body.account.id;
  });

  it("POST /api/financial-accounts: Rejects duplicate account name with 409", async () => {
    const req = makeReq("http://localhost/api/financial-accounts", "POST", tokenAdmin, {
      accountName: "HDFC Operating Bank",
      accountType: AccountType.BANK,
    });
    const res = await AccountsRoute.POST(req);
    assert.equal(res.status, 409);
  });

  it("POST /api/financial-accounts: Rejects malformed payload with 400", async () => {
    const req = makeReq("http://localhost/api/financial-accounts", "POST", tokenAdmin, {
      accountName: "",
    });
    const res = await AccountsRoute.POST(req);
    assert.equal(res.status, 400);
  });

  it("GET /api/financial-accounts/[id]: Admin fetches account by ID with balance", async () => {
    const req = makeReq(
      `http://localhost/api/financial-accounts/${operatingAccountId}`,
      "GET",
      tokenAdmin
    );
    const res = await AccountDetailRoute.GET(req, {
      params: Promise.resolve({ id: operatingAccountId }),
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.account.id, operatingAccountId);
    assert.equal(body.account.accountName, "Main Operating Cash");
    assert.equal(Number(body.account.currentBalance), 10000);
  });

  it("GET /api/financial-accounts/[id]: Receptionist receives 403 Forbidden", async () => {
    const req = makeReq(
      `http://localhost/api/financial-accounts/${operatingAccountId}`,
      "GET",
      tokenRecep
    );
    const res = await AccountDetailRoute.GET(req, {
      params: Promise.resolve({ id: operatingAccountId }),
    });
    assert.equal(res.status, 403);
  });

  it("PATCH /api/financial-accounts/[id]: Admin updates account name and settings", async () => {
    const req = makeReq(
      `http://localhost/api/financial-accounts/${createdAccountId}`,
      "PATCH",
      tokenAdmin,
      { accountName: "HDFC Main Primary Bank" }
    );
    const res = await AccountDetailRoute.PATCH(req, {
      params: Promise.resolve({ id: createdAccountId }),
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.account.accountName, "HDFC Main Primary Bank");
  });

  it("PATCH /api/financial-accounts/[id]: Rejects deactivating the default account with 400", async () => {
    const req = makeReq(
      `http://localhost/api/financial-accounts/${operatingAccountId}`,
      "PATCH",
      tokenAdmin,
      { isActive: false }
    );
    const res = await AccountDetailRoute.PATCH(req, {
      params: Promise.resolve({ id: operatingAccountId }),
    });
    assert.equal(res.status, 400);
  });

  it("DELETE /api/financial-accounts/[id]: Admin can delete unused non-default account", async () => {
    // Create temporary account to delete
    const tempAcc = await prisma.financialAccount.create({
      data: {
        propertyId: testProp.id,
        accountName: "Temporary Drawer",
        accountType: AccountType.CASH,
        isDefault: false,
        isActive: true,
      },
    });

    const req = makeReq(
      `http://localhost/api/financial-accounts/${tempAcc.id}`,
      "DELETE",
      tokenAdmin
    );
    const res = await AccountDetailRoute.DELETE(req, {
      params: Promise.resolve({ id: tempAcc.id }),
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
  });

  it("GET /api/financial-accounts/[id]/statement: Admin receives statement with 200", async () => {
    const req = makeReq(
      `http://localhost/api/financial-accounts/${operatingAccountId}/statement?startDate=2026-01-01&endDate=2026-12-31`,
      "GET",
      tokenAdmin
    );
    const res = await AccountStatementRoute.GET(req, {
      params: Promise.resolve({ id: operatingAccountId }),
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.statement.account.id, operatingAccountId);
    assert.equal(Number(body.statement.openingBalanceOnStartDate), 10000);
    assert.ok(Array.isArray(body.statement.items));
  });

  it("GET /api/financial-accounts/[id]/statement: Receptionist receives 403 Forbidden", async () => {
    const req = makeReq(
      `http://localhost/api/financial-accounts/${operatingAccountId}/statement`,
      "GET",
      tokenRecep
    );
    const res = await AccountStatementRoute.GET(req, {
      params: Promise.resolve({ id: operatingAccountId }),
    });
    assert.equal(res.status, 403);
  });

  // --------------------------------------------------------------------------
  // Payment Methods Route Tests
  // --------------------------------------------------------------------------

  it("GET /api/payment-methods: Receptionist receives only active payment methods", async () => {
    const req = makeReq("http://localhost/api/payment-methods", "GET", tokenRecep);
    const res = await PaymentMethodsRoute.GET(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    const hasInactive = body.paymentMethods.some((pm: { isActive: boolean }) => !pm.isActive);
    assert.equal(hasInactive, false, "Receptionist must never see inactive payment methods");
  });

  it("GET /api/payment-methods: Admin can list all methods including inactive", async () => {
    const req = makeReq("http://localhost/api/payment-methods", "GET", tokenAdmin);
    const res = await PaymentMethodsRoute.GET(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    const foundInactive = body.paymentMethods.some(
      (pm: { id: string }) => pm.id === inactivePaymentMethodId
    );
    assert.equal(foundInactive, true);
  });

  it("POST /api/payment-methods: Receptionist receives 403 Forbidden", async () => {
    const req = makeReq("http://localhost/api/payment-methods", "POST", tokenRecep, {
      name: "UPI QR",
      code: "UPI",
    });
    const res = await PaymentMethodsRoute.POST(req);
    assert.equal(res.status, 403);
  });

  it("POST /api/payment-methods: Admin creates new payment method with 201", async () => {
    const req = makeReq("http://localhost/api/payment-methods", "POST", tokenAdmin, {
      name: "Front Desk UPI",
      code: `UPI_${time}`,
      defaultAccountId: operatingAccountId,
    });
    const res = await PaymentMethodsRoute.POST(req);
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.paymentMethod.name, "Front Desk UPI");
    assert.equal(body.paymentMethod.code, `UPI_${time}`);
    assert.equal(body.paymentMethod.defaultAccountId, operatingAccountId);
  });

  it("POST /api/payment-methods: Rejects duplicate code with 409 Conflict", async () => {
    const req = makeReq("http://localhost/api/payment-methods", "POST", tokenAdmin, {
      name: "Desk Cash Duplicate",
      code: `CASH_${time}`,
    });
    const res = await PaymentMethodsRoute.POST(req);
    assert.equal(res.status, 409);
  });

  it("PATCH /api/payment-methods/[id]: Admin updates payment method name and active state", async () => {
    const req = makeReq(
      `http://localhost/api/payment-methods/${inactivePaymentMethodId}`,
      "PATCH",
      tokenAdmin,
      { name: "Reactivated Cheque Method", isActive: true }
    );
    const res = await PaymentMethodDetailRoute.PATCH(req, {
      params: Promise.resolve({ id: inactivePaymentMethodId }),
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.paymentMethod.name, "Reactivated Cheque Method");
    assert.equal(body.paymentMethod.isActive, true);
  });

  it("DELETE /api/payment-methods/[id]: Receptionist receives 403 Forbidden", async () => {
    const req = makeReq(
      `http://localhost/api/payment-methods/${inactivePaymentMethodId}`,
      "DELETE",
      tokenRecep
    );
    const res = await PaymentMethodDetailRoute.DELETE(req, {
      params: Promise.resolve({ id: inactivePaymentMethodId }),
    });
    assert.equal(res.status, 403);
  });

  // --------------------------------------------------------------------------
  // Account Transfers Route Tests
  // --------------------------------------------------------------------------

  it("GET /api/account-transfers: Receptionist receives 403 Forbidden", async () => {
    const req = makeReq("http://localhost/api/account-transfers", "GET", tokenRecep);
    const res = await AccountTransfersRoute.GET(req);
    assert.equal(res.status, 403);
  });

  it("POST /api/account-transfers: Receptionist receives 403 Forbidden", async () => {
    const req = makeReq("http://localhost/api/account-transfers", "POST", tokenRecep, {
      fromAccountId: operatingAccountId,
      toAccountId: createdAccountId,
      amount: 1000,
    });
    const res = await AccountTransfersRoute.POST(req);
    assert.equal(res.status, 403);
  });

  it("POST /api/account-transfers: Rejects self-transfer with 400", async () => {
    const req = makeReq("http://localhost/api/account-transfers", "POST", tokenAdmin, {
      fromAccountId: operatingAccountId,
      toAccountId: operatingAccountId,
      amount: 500,
    });
    const res = await AccountTransfersRoute.POST(req);
    assert.equal(res.status, 400);
  });

  it("POST /api/account-transfers: Rejects transfer exceeding source balance with 400", async () => {
    const req = makeReq("http://localhost/api/account-transfers", "POST", tokenAdmin, {
      fromAccountId: operatingAccountId,
      toAccountId: createdAccountId,
      amount: 999999, // Exceeds 10000 balance
    });
    const res = await AccountTransfersRoute.POST(req);
    assert.equal(res.status, 400);
  });

  it("POST /api/account-transfers: Admin successfully executes inter-account transfer", async () => {
    const req = makeReq("http://localhost/api/account-transfers", "POST", tokenAdmin, {
      fromAccountId: operatingAccountId,
      toAccountId: createdAccountId,
      amount: 2500,
      description: "Transfer cash to bank",
      referenceNumber: `TR-${time}`,
    });
    const res = await AccountTransfersRoute.POST(req);
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(Number(body.transfer.amount), 2500);
    assert.equal(body.transfer.fromAccountId, operatingAccountId);
    assert.equal(body.transfer.toAccountId, createdAccountId);
  });

  it("GET /api/account-transfers: Admin lists transfers with pagination", async () => {
    const req = makeReq("http://localhost/api/account-transfers", "GET", tokenAdmin);
    const res = await AccountTransfersRoute.GET(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.transfers.length >= 1);
    assert.ok(body.total >= 1);

    const match = body.transfers.find(
      (t: { referenceNumber: string }) => t.referenceNumber === `TR-${time}`
    );
    assert.ok(match, "Recorded transfer must be returned in the list");
    assert.equal(Number(match.amount), 2500);
  });
});
