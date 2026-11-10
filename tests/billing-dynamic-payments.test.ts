import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { RoleName, AccountType, InvoiceStatus, ReservationStatus, RoomStatus } from "@prisma/client";
import { AuthService } from "../src/modules/auth/auth.service";

// Handlers under test
import * as InvoicePaymentsRoute from "../src/app/api/invoices/[id]/payments/route";
import * as PaymentMethodsRoute from "../src/app/api/payment-methods/route";
import * as FinancialAccountsRoute from "../src/app/api/financial-accounts/route";

describe("Phase 2 — Dynamic Payment Methods & Accounts Integration in Billing", () => {
  const time = Date.now();
  let propA: { id: string; name: string };
  let propB: { id: string; name: string };

  let tokenAdminA: string;
  let tokenRecepA: string;

  let cashDrawerId: string;
  let hdfcBankId: string;
  let inactiveAccountId: string;
  let propBAccountId: string;

  let cashMethodId: string;
  let upiMethodId: string;
  let cardMethodId: string;
  let bankTransferMethodId: string;
  let inactiveMethodId: string;
  let propBMethodId: string;

  let invoice1Id: string;
  let invoice2Id: string;
  let propBInvoiceId: string;

  function makeReq(
    url: string,
    method: string,
    token: string,
    body?: object,
    idempotencyKey?: string
  ): NextRequest {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      cookie: `byteinn_session=${token}`,
    };
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    return new NextRequest(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  before(async () => {
    // 1. Properties
    propA = await prisma.property.create({
      data: { name: `Hotel A Dynamic Pay ${time}`, city: "Goa", status: "ACTIVE" },
    });
    propB = await prisma.property.create({
      data: { name: `Hotel B Cross Attack ${time}`, city: "Kochi", status: "ACTIVE" },
    });

    // 2. Roles
    const [adminRole, recepRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { name: RoleName.ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { name: RoleName.RECEPTIONIST } }),
    ]);

    // 3. Users
    const [userAdminA, userRecepA, _userAdminB] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Admin A",
          email: `admin-a-${time}@byteinn.test`,
          passwordHash: await AuthService.hashPassword("TestPass@123"),
          roleId: adminRole.id,
          propertyId: propA.id,
          status: "ACTIVE",
          tokenVersion: 1,
        },
      }),
      prisma.user.create({
        data: {
          name: "Receptionist A",
          email: `recep-a-${time}@byteinn.test`,
          passwordHash: await AuthService.hashPassword("TestPass@123"),
          roleId: recepRole.id,
          propertyId: propA.id,
          status: "ACTIVE",
          tokenVersion: 1,
        },
      }),
      prisma.user.create({
        data: {
          name: "Admin B",
          email: `admin-b-${time}@byteinn.test`,
          passwordHash: await AuthService.hashPassword("TestPass@123"),
          roleId: adminRole.id,
          propertyId: propB.id,
          status: "ACTIVE",
          tokenVersion: 1,
        },
      }),
    ]);

    // 4. Tokens
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

    // 5. Financial Accounts on Property A
    const accCash = await prisma.financialAccount.create({
      data: {
        propertyId: propA.id,
        accountName: "Front Desk Cash Drawer",
        accountType: AccountType.CASH,
        openingBalance: 15000,
        isDefault: true,
        isActive: true,
      },
    });
    cashDrawerId = accCash.id;

    const accBank = await prisma.financialAccount.create({
      data: {
        propertyId: propA.id,
        accountName: "Operating HDFC Bank",
        accountType: AccountType.BANK,
        openingBalance: 50000,
        isDefault: false,
        isActive: true,
      },
    });
    hdfcBankId = accBank.id;

    const accInactive = await prisma.financialAccount.create({
      data: {
        propertyId: propA.id,
        accountName: "Closed Petty Drawer",
        accountType: AccountType.CASH,
        openingBalance: 0,
        isDefault: false,
        isActive: false,
      },
    });
    inactiveAccountId = accInactive.id;

    // Financial Account on Property B
    const accB = await prisma.financialAccount.create({
      data: {
        propertyId: propB.id,
        accountName: "Hotel B Vault",
        accountType: AccountType.CASH,
        openingBalance: 10000,
        isDefault: true,
        isActive: true,
      },
    });
    propBAccountId = accB.id;

    // 6. Payment Methods on Property A
    const pmCash = await prisma.paymentMethod.create({
      data: {
        propertyId: propA.id,
        name: "Desk Cash",
        code: `CASH_${time}`,
        defaultAccountId: cashDrawerId,
        isActive: true,
      },
    });
    cashMethodId = pmCash.id;

    const pmUpi = await prisma.paymentMethod.create({
      data: {
        propertyId: propA.id,
        name: "UPI QR Scanner",
        code: `UPI_${time}`,
        defaultAccountId: hdfcBankId,
        isActive: true,
      },
    });
    upiMethodId = pmUpi.id;

    const pmCard = await prisma.paymentMethod.create({
      data: {
        propertyId: propA.id,
        name: "Card Terminal POS",
        code: `CARD_${time}`,
        defaultAccountId: null, // No default account configured
        isActive: true,
      },
    });
    cardMethodId = pmCard.id;

    const pmBank = await prisma.paymentMethod.create({
      data: {
        propertyId: propA.id,
        name: "Direct Bank Transfer",
        code: `BANK_TRANSFER_${time}`,
        defaultAccountId: hdfcBankId,
        isActive: true,
      },
    });
    bankTransferMethodId = pmBank.id;

    const pmInactive = await prisma.paymentMethod.create({
      data: {
        propertyId: propA.id,
        name: "Old Paper Cheque",
        code: `CHEQUE_${time}`,
        defaultAccountId: null,
        isActive: false,
      },
    });
    inactiveMethodId = pmInactive.id;

    // Payment Method on Property B
    const pmB = await prisma.paymentMethod.create({
      data: {
        propertyId: propB.id,
        name: "Hotel B Cash",
        code: `B_CASH_${time}`,
        defaultAccountId: propBAccountId,
        isActive: true,
      },
    });
    propBMethodId = pmB.id;

    // 7. Customers & Reservations for Invoices
    const custA = await prisma.customer.create({
      data: {
        registeredPropertyId: propA.id,
        firstName: "Rajesh",
        lastName: "Kumar",
        email: `rajesh-${time}@byteinn.test`,
      },
    });

    const buildingA = await prisma.building.create({
      data: { propertyId: propA.id, name: "Main Tower" },
    });
    const floorA = await prisma.floor.create({
      data: { buildingId: buildingA.id, floorNo: 1, name: "Floor 1" },
    });
    const catA = await prisma.roomCategory.create({
      data: { propertyId: propA.id, name: `Deluxe ${time}`, basePrice: 3000, maxOccupancy: 2 },
    });
    await prisma.room.create({
      data: {
        propertyId: propA.id,
        buildingId: buildingA.id,
        floorId: floorA.id,
        roomCategoryId: catA.id,
        roomNo: `101-${time}`,
        capacity: 2,
        status: RoomStatus.OCCUPIED,
      },
    });

    const resA1 = await prisma.reservation.create({
      data: {
        propertyId: propA.id,
        reservationNo: `RES-A1-${time}`,
        customerId: custA.id,
        createdBy: userAdminA.id,
        status: ReservationStatus.CONFIRMED,
      },
    });

    const resA2 = await prisma.reservation.create({
      data: {
        propertyId: propA.id,
        reservationNo: `RES-A2-${time}`,
        customerId: custA.id,
        createdBy: userAdminA.id,
        status: ReservationStatus.CONFIRMED,
      },
    });

    // Invoices on Property A
    const inv1 = await prisma.invoice.create({
      data: {
        propertyId: propA.id,
        invoiceNumber: `INV-A1-${time}`,
        reservationId: resA1.id,
        customerId: custA.id,
        customerName: "Rajesh Kumar",
        subtotal: 5000,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 5000,
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
      },
    });
    invoice1Id = inv1.id;

    const inv2 = await prisma.invoice.create({
      data: {
        propertyId: propA.id,
        invoiceNumber: `INV-A2-${time}`,
        reservationId: resA2.id,
        customerId: custA.id,
        customerName: "Rajesh Kumar",
        subtotal: 8000,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 8000,
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
      },
    });
    invoice2Id = inv2.id;

    // Customer & Invoice on Property B
    const custB = await prisma.customer.create({
      data: {
        registeredPropertyId: propB.id,
        firstName: "Vikram",
        email: `vikram-${time}@byteinn.test`,
      },
    });
    const invB = await prisma.invoice.create({
      data: {
        propertyId: propB.id,
        invoiceNumber: `INV-B-${time}`,
        customerId: custB.id,
        customerName: "Vikram",
        subtotal: 2000,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 2000,
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
      },
    });
    propBInvoiceId = invB.id;
  });

  after(async () => {
    await prisma.receipt.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.payment.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.invoiceItem.deleteMany({
      where: { invoice: { propertyId: { in: [propA.id, propB.id] } } },
    });
    await prisma.invoice.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.reservation.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.room.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.roomCategory.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.floor.deleteMany({ where: { building: { propertyId: { in: [propA.id, propB.id] } } } });
    await prisma.building.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.customer.deleteMany({
      where: { registeredPropertyId: { in: [propA.id, propB.id] } },
    });
    await prisma.paymentMethod.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.financialAccount.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.user.deleteMany({ where: { propertyId: { in: [propA.id, propB.id] } } });
    await prisma.property.deleteMany({ where: { id: { in: [propA.id, propB.id] } } });
  });

  // --------------------------------------------------------------------------
  // 1. Fetching Active Configuration (Receptionist & Admin)
  // --------------------------------------------------------------------------

  it("1. GET /api/payment-methods: Receptionist receives only active payment methods", async () => {
    const req = makeReq(`http://localhost/api/payment-methods?propertyId=${propA.id}`, "GET", tokenRecepA);
    const res = await PaymentMethodsRoute.GET(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.paymentMethods));

    const foundInactive = body.paymentMethods.some(
      (m: { id: string }) => m.id === inactiveMethodId
    );
    assert.equal(foundInactive, false, "Inactive payment methods must not be returned to receptionist");

    const foundCash = body.paymentMethods.find((m: { id: string }) => m.id === cashMethodId);
    assert.ok(foundCash);
    assert.equal(foundCash.defaultAccountId, cashDrawerId, "Cash method must specify cash drawer default");

    const foundCard = body.paymentMethods.find((m: { id: string }) => m.id === cardMethodId);
    assert.ok(foundCard);
    assert.equal(foundCard.defaultAccountId, null, "Card method has no default account configured");
  });

  it("2. GET /api/financial-accounts: Receptionist receives only active financial accounts", async () => {
    const req = makeReq(`http://localhost/api/financial-accounts?propertyId=${propA.id}`, "GET", tokenRecepA);
    const res = await FinancialAccountsRoute.GET(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    const foundInactive = body.accounts.some((a: { id: string }) => a.id === inactiveAccountId);
    assert.equal(foundInactive, false, "Inactive accounts must not be returned to receptionist");
  });

  // --------------------------------------------------------------------------
  // 2. Recording Payments with Payment Methods & Accounts
  // --------------------------------------------------------------------------

  it("3. Partial Payment: Records payment using Cash Desk & its suggested Cash Drawer account", async () => {
    const req = makeReq(
      `http://localhost/api/invoices/${invoice1Id}/payments`,
      "POST",
      tokenRecepA,
      {
        amount: 2000,
        paymentMethod: `CASH_${time}`,
        paymentMethodId: cashMethodId,
        accountId: cashDrawerId,
        referenceNumber: `CASH-REC-${time}`,
      },
      `idem-cash-1-${time}`
    );
    const res = await InvoicePaymentsRoute.POST(req, {
      params: Promise.resolve({ id: invoice1Id }),
    });
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.invoice.status, InvoiceStatus.PARTIALLY_PAID);
    assert.equal(Number(body.data.invoice.totalPaid), 2000);
    assert.equal(Number(body.data.invoice.balanceDue), 3000);

    // Verify stored receipt fields
    const receipt = await prisma.receipt.findUniqueOrThrow({
      where: { id: body.data.receipt.paymentId },
    });
    assert.equal(receipt.accountId, cashDrawerId);
    assert.equal(receipt.paymentMethodId, cashMethodId);
    assert.equal(receipt.paymentMethodCode, `CASH_${time}`);
    assert.equal(receipt.propertyId, propA.id);
  });

  it("4. Full Payment: Settles remaining balance using UPI linked to HDFC Bank", async () => {
    const req = makeReq(
      `http://localhost/api/invoices/${invoice1Id}/payments`,
      "POST",
      tokenRecepA,
      {
        amount: 3000,
        paymentMethod: `UPI_${time}`,
        paymentMethodId: upiMethodId,
        accountId: hdfcBankId, // Suggested by UPI method
        referenceNumber: `UPI-TXN-${time}`,
      },
      `idem-upi-1-${time}`
    );
    const res = await InvoicePaymentsRoute.POST(req, {
      params: Promise.resolve({ id: invoice1Id }),
    });
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.invoice.status, InvoiceStatus.PAID);
    assert.equal(Number(body.data.invoice.balanceDue), 0);

    const receipt = await prisma.receipt.findUniqueOrThrow({
      where: { id: body.data.receipt.paymentId },
    });
    assert.equal(receipt.accountId, hdfcBankId);
    assert.equal(receipt.paymentMethodId, upiMethodId);
  });

  it("5. Card payment without default account: Accepts manual destination account selection", async () => {
    // Card has defaultAccountId: null. User manually selects HDFC Bank
    const req = makeReq(
      `http://localhost/api/invoices/${invoice2Id}/payments`,
      "POST",
      tokenAdminA,
      {
        amount: 4000,
        paymentMethod: `CARD_${time}`,
        paymentMethodId: cardMethodId,
        accountId: hdfcBankId, // Manually chosen
        referenceNumber: `CARD-AUTH-9921`,
      },
      `idem-card-1-${time}`
    );
    const res = await InvoicePaymentsRoute.POST(req, {
      params: Promise.resolve({ id: invoice2Id }),
    });
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.invoice.status, InvoiceStatus.PARTIALLY_PAID);

    const receipt = await prisma.receipt.findUniqueOrThrow({
      where: { id: body.data.receipt.paymentId },
    });
    assert.equal(receipt.accountId, hdfcBankId);
    assert.equal(receipt.paymentMethodId, cardMethodId);
  });

  it("6. Manual override: Payment method suggests Cash Drawer, but user manually overrides to HDFC Bank", async () => {
    // Cash Desk suggests cashDrawerId, but user manually selects hdfcBankId
    const req = makeReq(
      `http://localhost/api/invoices/${invoice2Id}/payments`,
      "POST",
      tokenRecepA,
      {
        amount: 2000,
        paymentMethod: `CASH_${time}`,
        paymentMethodId: cashMethodId,
        accountId: hdfcBankId, // Overridden
        referenceNumber: `CASH-DEP-BANK-${time}`,
      },
      `idem-override-1-${time}`
    );
    const res = await InvoicePaymentsRoute.POST(req, {
      params: Promise.resolve({ id: invoice2Id }),
    });
    assert.equal(res.status, 201);

    const body = await res.json();
    const receipt = await prisma.receipt.findUniqueOrThrow({
      where: { id: body.data.receipt.paymentId },
    });
    assert.equal(receipt.accountId, hdfcBankId, "Manually selected account must be respected");
  });

  it("7. Direct Bank Transfer: Full settlement using Bank Transfer method", async () => {
    // Settle remaining 2000 on invoice2
    const req = makeReq(
      `http://localhost/api/invoices/${invoice2Id}/payments`,
      "POST",
      tokenRecepA,
      {
        amount: 2000,
        paymentMethod: `BANK_TRANSFER_${time}`,
        paymentMethodId: bankTransferMethodId,
        accountId: hdfcBankId,
        referenceNumber: `NEFT-00912-${time}`,
      },
      `idem-neft-1-${time}`
    );
    const res = await InvoicePaymentsRoute.POST(req, {
      params: Promise.resolve({ id: invoice2Id }),
    });
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.data.invoice.status, InvoiceStatus.PAID);
    assert.equal(Number(body.data.invoice.balanceDue), 0);
  });

  // --------------------------------------------------------------------------
  // 3. Negative & Security Edge Cases
  // --------------------------------------------------------------------------

  it("8. Rejects payment with inactive financial account (400)", async () => {
    // Create new invoice to test invalid payment
    const tempInv = await prisma.invoice.create({
      data: {
        propertyId: propA.id,
        invoiceNumber: `INV-TEMP-1-${time}`,
        subtotal: 1000,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 1000,
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
      },
    });

    const req = makeReq(
      `http://localhost/api/invoices/${tempInv.id}/payments`,
      "POST",
      tokenAdminA,
      {
        amount: 500,
        paymentMethod: `CASH_${time}`,
        accountId: inactiveAccountId, // Inactive account!
      },
      `idem-inactive-acc-${time}`
    );
    const res = await InvoicePaymentsRoute.POST(req, {
      params: Promise.resolve({ id: tempInv.id }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes("inactive"));
  });

  it("9. Rejects payment with inactive payment method (400)", async () => {
    const tempInv = await prisma.invoice.create({
      data: {
        propertyId: propA.id,
        invoiceNumber: `INV-TEMP-2-${time}`,
        subtotal: 1000,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 1000,
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
      },
    });

    const req = makeReq(
      `http://localhost/api/invoices/${tempInv.id}/payments`,
      "POST",
      tokenAdminA,
      {
        amount: 500,
        paymentMethod: `CHEQUE_${time}`,
        paymentMethodId: inactiveMethodId, // Inactive method!
        accountId: cashDrawerId,
      },
      `idem-inactive-pm-${time}`
    );
    const res = await InvoicePaymentsRoute.POST(req, {
      params: Promise.resolve({ id: tempInv.id }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes("inactive"));
  });

  it("10. Rejects payment with cross-property financial account (400)", async () => {
    const tempInv = await prisma.invoice.create({
      data: {
        propertyId: propA.id,
        invoiceNumber: `INV-TEMP-3-${time}`,
        subtotal: 1000,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 1000,
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
      },
    });

    // Try paying Hotel A invoice into Hotel B account
    const req = makeReq(
      `http://localhost/api/invoices/${tempInv.id}/payments`,
      "POST",
      tokenAdminA,
      {
        amount: 500,
        paymentMethod: `CASH_${time}`,
        accountId: propBAccountId, // Hotel B account!
      },
      `idem-cross-acc-${time}`
    );
    const res = await InvoicePaymentsRoute.POST(req, {
      params: Promise.resolve({ id: tempInv.id }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes("another property") || body.error.includes("not exist"));
  });

  it("11. Rejects payment with cross-property payment method (400)", async () => {
    const tempInv = await prisma.invoice.create({
      data: {
        propertyId: propA.id,
        invoiceNumber: `INV-TEMP-4-${time}`,
        subtotal: 1000,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 1000,
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
      },
    });

    // Try paying Hotel A invoice with Hotel B payment method
    const req = makeReq(
      `http://localhost/api/invoices/${tempInv.id}/payments`,
      "POST",
      tokenAdminA,
      {
        amount: 500,
        paymentMethod: `B_CASH_${time}`,
        paymentMethodId: propBMethodId, // Hotel B method!
        accountId: cashDrawerId,
      },
      `idem-cross-pm-${time}`
    );
    const res = await InvoicePaymentsRoute.POST(req, {
      params: Promise.resolve({ id: tempInv.id }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes("another property") || body.error.includes("not exist"));
  });

  it("12. Blocks Receptionist from cross-property invoice payment (403/404)", async () => {
    // Hotel A Receptionist attempts payment on Hotel B invoice
    const req = makeReq(
      `http://localhost/api/invoices/${propBInvoiceId}/payments`,
      "POST",
      tokenRecepA,
      {
        amount: 500,
        paymentMethod: "CASH",
      },
      `idem-cross-inv-${time}`
    );
    const res = await InvoicePaymentsRoute.POST(req, {
      params: Promise.resolve({ id: propBInvoiceId }),
    });
    assert.ok(
      res.status === 403 || res.status === 404,
      `Expected 403 or 404 for cross-property invoice access, got ${res.status}`
    );
  });

  // --------------------------------------------------------------------------
  // 4. Backwards Compatibility & Omitted Configuration
  // --------------------------------------------------------------------------

  it("13. Backwards Compatibility: Legacy payment call without accountId/methodId succeeds using defaults", async () => {
    const tempInv = await prisma.invoice.create({
      data: {
        propertyId: propA.id,
        invoiceNumber: `INV-TEMP-LEGACY-${time}`,
        subtotal: 1000,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 1000,
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
      },
    });

    // Caller passes only amount and paymentMethod string (no accountId, no paymentMethodId)
    const req = makeReq(
      `http://localhost/api/invoices/${tempInv.id}/payments`,
      "POST",
      tokenRecepA,
      {
        amount: 1000,
        paymentMethod: "CASH",
      },
      `idem-legacy-${time}`
    );
    const res = await InvoicePaymentsRoute.POST(req, {
      params: Promise.resolve({ id: tempInv.id }),
    });
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.invoice.status, InvoiceStatus.PAID);

    // Stored receipt must automatically be assigned to the property's default active account
    const receipt = await prisma.receipt.findUniqueOrThrow({
      where: { id: body.data.receipt.paymentId },
    });
    assert.equal(
      receipt.accountId,
      cashDrawerId,
      "Legacy call must safely default to property default active account"
    );
  });
});
