import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { RoleName, AccountType, IncomeStatus, ReceiptStatus } from "@prisma/client";
import { AuthService } from "../src/modules/auth/auth.service";
import { IncomeService } from "../src/modules/income/income.service";
import { IncomeHeadService } from "../src/modules/income/income-head.service";
import { FinancialAccountService } from "../src/modules/financial-accounts/financial-accounts.service";
import { BadRequestError } from "../src/lib/errors";

describe("Phase 3 Stage 3: Direct Income UI & Workflow Integration", () => {
  const timestamp = Date.now();
  let propA: { id: string; name: string };
  let propB: { id: string; name: string };

  let userAdminA: { id: string; email: string; name: string };
  let userAdminB: { id: string; email: string; name: string };
  let userRecepA: { id: string; email: string; name: string };
  let userSuper: { id: string; email: string; name: string };

  let bankAccountA: { id: string; accountName: string };
  let cashAccountA: { id: string; accountName: string };

  let methodBankA: { id: string; code: string; defaultAccountId: string | null };
  let methodCashA: { id: string; code: string; defaultAccountId: string | null };

  let commCategoryA: { id: string; code: string; name: string };
  let scrapCategoryA: { id: string; code: string; name: string };

  before(async () => {
    // 1. Create Properties
    propA = await prisma.property.create({
      data: {
        name: `UI Hotel A ${timestamp}`,
        city: "Goa",
        status: "ACTIVE",
      },
    });

    propB = await prisma.property.create({
      data: {
        name: `UI Hotel B ${timestamp}`,
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
    const pwdHash = await AuthService.hashPassword("TestPass@123");
    const [adminA, adminB, recepA, superUser] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Admin Hotel A",
          email: `admin-a-${timestamp}@byteinn.test`,
          passwordHash: pwdHash,
          roleId: adminRole.id,
          propertyId: propA.id,
          status: "ACTIVE",
        },
      }),
      prisma.user.create({
        data: {
          name: "Admin Hotel B",
          email: `admin-b-${timestamp}@byteinn.test`,
          passwordHash: pwdHash,
          roleId: adminRole.id,
          propertyId: propB.id,
          status: "ACTIVE",
        },
      }),
      prisma.user.create({
        data: {
          name: "Receptionist Hotel A",
          email: `recep-a-${timestamp}@byteinn.test`,
          passwordHash: pwdHash,
          roleId: recepRole.id,
          propertyId: propA.id,
          status: "ACTIVE",
        },
      }),
      prisma.user.create({
        data: {
          name: "Super Admin",
          email: `super-${timestamp}@byteinn.test`,
          passwordHash: pwdHash,
          roleId: superRole.id,
          propertyId: null,
          status: "ACTIVE",
        },
      }),
    ]);

    userAdminA = { id: adminA.id, email: adminA.email, name: adminA.name };
    userAdminB = { id: adminB.id, email: adminB.email, name: adminB.name };
    userRecepA = { id: recepA.id, email: recepA.email, name: recepA.name };
    userSuper = { id: superUser.id, email: superUser.email, name: superUser.name };

    // 4. Financial Accounts
    bankAccountA = await prisma.financialAccount.create({
      data: {
        propertyId: propA.id,
        accountName: `Main Bank Operating ${timestamp}`,
        accountType: AccountType.BANK,
        openingBalance: 10000,
        openingBalanceDate: new Date("2026-01-01"),
        isDefault: true,
        isActive: true,
      },
    });

    cashAccountA = await prisma.financialAccount.create({
      data: {
        propertyId: propA.id,
        accountName: `Front Desk Cash Drawer ${timestamp}`,
        accountType: AccountType.CASH,
        openingBalance: 2000,
        openingBalanceDate: new Date("2026-01-01"),
        isDefault: false,
        isActive: true,
      },
    });

    await prisma.financialAccount.create({
      data: {
        propertyId: propB.id,
        accountName: `Hotel B Bank ${timestamp}`,
        accountType: AccountType.BANK,
        openingBalance: 5000,
        openingBalanceDate: new Date("2026-01-01"),
        isDefault: true,
        isActive: true,
      },
    });

    // 5. Payment Methods
    methodBankA = await prisma.paymentMethod.create({
      data: {
        propertyId: propA.id,
        name: "Direct Bank Transfer",
        code: "BANK_TRANSFER",
        defaultAccountId: bankAccountA.id,
        isActive: true,
      },
    });

    methodCashA = await prisma.paymentMethod.create({
      data: {
        propertyId: propA.id,
        name: "Cash",
        code: "CASH",
        defaultAccountId: cashAccountA.id,
        isActive: true,
      },
    });

    // 6. Categories for Property A
    commCategoryA = await IncomeHeadService.createIncomeHead(
      propA.id,
      {
        name: "Tour Operator Commission",
        code: "TOUR_COMM",
        description: "Commissions earned from partnered local excursions",
      },
      userAdminA.id
    );

    scrapCategoryA = await IncomeHeadService.createIncomeHead(
      propA.id,
      {
        name: "Scrap & Linen Disposal",
        code: "SCRAP_DISPOSAL",
        description: "Disposal of obsolete hotel assets",
      },
      userAdminA.id
    );
  });

  after(async () => {
    const propIds = [propA.id, propB.id];
    await prisma.auditLog.deleteMany({
      where: {
        userId: { in: [userAdminA.id, userAdminB.id, userRecepA.id, userSuper.id] },
      },
    });
    await prisma.receipt.deleteMany({ where: { propertyId: { in: propIds } } });
    await prisma.income.deleteMany({ where: { propertyId: { in: propIds } } });
    await prisma.incomeHead.deleteMany({ where: { propertyId: { in: propIds } } });
    await prisma.paymentMethod.deleteMany({ where: { propertyId: { in: propIds } } });
    await prisma.financialAccount.deleteMany({ where: { propertyId: { in: propIds } } });
    await prisma.user.deleteMany({
      where: { id: { in: [userAdminA.id, userAdminB.id, userRecepA.id, userSuper.id] } },
    });
    await prisma.property.deleteMany({ where: { id: { in: propIds } } });
  });

  // =========================================================================
  // 1. Direct Income Summary Calculations (Correct Filtering Semantics)
  // =========================================================================
  describe("1. Summary Card Financial Semantics", () => {
    it("computes Total Expected, Received, and Outstanding accurately across records", async () => {
      // Create 3 income records
      // Income 1: 1000 expected, 600 collected (partial)
      const inc1 = await IncomeService.createIncome(
        propA.id,
        {
          incomeHeadId: commCategoryA.id,
          title: "Kerala Backwaters Tour Package Commission",
          expectedAmount: 1000,
          incomeDate: "2026-08-15",
        },
        userAdminA.id
      );

      await IncomeService.recordIncomeReceipt(
        propA.id,
        inc1.id,
        {
          amount: 600,
          accountId: bankAccountA.id,
          paymentMethod: methodBankA.code,
          paymentMethodId: methodBankA.id,
        },
        userAdminA.id
      );

      // Income 2: 500 expected, 500 collected (fully received)
      const inc2 = await IncomeService.createIncome(
        propA.id,
        {
          incomeHeadId: scrapCategoryA.id,
          title: "Old Linen & Curtain Sale",
          expectedAmount: 500,
          incomeDate: "2026-08-20",
        },
        userAdminA.id
      );

      await IncomeService.recordIncomeReceipt(
        propA.id,
        inc2.id,
        {
          amount: 500,
          accountId: cashAccountA.id,
          paymentMethod: methodCashA.code,
          paymentMethodId: methodCashA.id,
        },
        userAdminA.id
      );

      // Income 3: 300 expected, 0 collected (pending)
      await IncomeService.createIncome(
        propA.id,
        {
          incomeHeadId: commCategoryA.id,
          title: "Airport Taxi Partnership Commission",
          expectedAmount: 300,
          incomeDate: "2026-08-25",
        },
        userAdminA.id
      );

      // Income 4: 800 expected, voided (should not contribute to active totals)
      const inc4 = await IncomeService.createIncome(
        propA.id,
        {
          incomeHeadId: scrapCategoryA.id,
          title: "Discarded Kitchen Appliances Sale",
          expectedAmount: 800,
          incomeDate: "2026-08-10",
        },
        userAdminA.id
      );
      await IncomeService.voidIncome(
        propA.id,
        inc4.id,
        { voidReason: "Deal canceled by scrap buyer" },
        userAdminA.id
      );

      // Query active incomes
      const list = await IncomeService.getIncomes(propA.id, {
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      });

      const nonVoid = list.incomes.filter((i) => i.status !== "VOID");
      const totalExpected = nonVoid.reduce((sum, i) => sum + parseFloat(i.expectedAmount), 0);
      const totalReceived = nonVoid.reduce((sum, i) => sum + parseFloat(i.receivedAmount), 0);
      const totalOutstanding = nonVoid.reduce((sum, i) => sum + parseFloat(i.outstandingAmount), 0);

      // Expected = 1000 + 500 + 300 = 1800
      assert.strictEqual(totalExpected, 1800);
      // Received = 600 + 500 = 1100
      assert.strictEqual(totalReceived, 1100);
      // Outstanding = 400 + 0 + 300 = 700
      assert.strictEqual(totalOutstanding, 700);

      // Verify voided income is returned in list with status VOID
      const voidedItem = list.incomes.find((i) => i.id === inc4.id);
      assert.ok(voidedItem);
      assert.strictEqual(voidedItem.status, IncomeStatus.VOID);
      assert.strictEqual(voidedItem.voidReason, "Deal canceled by scrap buyer");
    });
  });

  // =========================================================================
  // 2. Receipt Collection & Account Auto-Suggestion
  // =========================================================================
  describe("2. Receipt Collection & Suggested Destination Account", () => {
    it("suggests the payment method default account and applies collection correctly", async () => {
      const income = await IncomeService.createIncome(
        propA.id,
        {
          incomeHeadId: commCategoryA.id,
          title: "Snack Machine Commission Q2",
          expectedAmount: 400,
        },
        userAdminA.id
      );

      // When method is BANK_TRANSFER, suggested account is bankAccountA
      assert.strictEqual(methodBankA.defaultAccountId, bankAccountA.id);

      // When method is CASH, suggested account is cashAccountA
      assert.strictEqual(methodCashA.defaultAccountId, cashAccountA.id);

      // Record partial collection to cashAccountA
      const { income: afterCash, receipt: r1 } = await IncomeService.recordIncomeReceipt(
        propA.id,
        income.id,
        {
          amount: 150,
          accountId: cashAccountA.id,
          paymentMethod: methodCashA.code,
          paymentMethodId: methodCashA.id,
          referenceNumber: "CASH-001",
        },
        userAdminA.id
      );

      assert.strictEqual(afterCash.status, IncomeStatus.PARTIALLY_RECEIVED);
      assert.strictEqual(afterCash.receivedAmount, "150.00");
      assert.strictEqual(afterCash.outstandingAmount, "250.00");

      // Verify ledger reflection in cashAccountA statement
      const cashStmt = await FinancialAccountService.getAccountStatement(propA.id, cashAccountA.id);
      const cashReceiptItem = cashStmt.items.find((i) => i.id === r1.id);
      assert.ok(cashReceiptItem);
      assert.strictEqual(cashReceiptItem.credit, "150.00");

      // Record remaining collection to bankAccountA (manual override)
      const { income: afterBank, receipt: r2 } = await IncomeService.recordIncomeReceipt(
        propA.id,
        income.id,
        {
          amount: 250,
          accountId: bankAccountA.id,
          paymentMethod: methodBankA.code,
          paymentMethodId: methodBankA.id,
          referenceNumber: "NEFT-002",
        },
        userAdminA.id
      );

      assert.strictEqual(afterBank.status, IncomeStatus.RECEIVED);
      assert.strictEqual(afterBank.receivedAmount, "400.00");
      assert.strictEqual(afterBank.outstandingAmount, "0.00");

      // Verify bank account ledger reflection
      const bankStmt = await FinancialAccountService.getAccountStatement(propA.id, bankAccountA.id);
      const bankReceiptItem = bankStmt.items.find((i) => i.id === r2.id);
      assert.ok(bankReceiptItem);
      assert.strictEqual(bankReceiptItem.credit, "250.00");
    });
  });

  // =========================================================================
  // 3. Two-Stage Voiding & Balance Reversal
  // =========================================================================
  describe("3. Itemized Receipt Voiding & Income Voiding Restrictions", () => {
    it("enforces that income cannot be voided while active receipts exist, then permits voiding once all receipts are voided", async () => {
      const income = await IncomeService.createIncome(
        propA.id,
        {
          incomeHeadId: commCategoryA.id,
          title: "Scrap Furniture Auction",
          expectedAmount: 600,
        },
        userAdminA.id
      );

      // Collect receipt
      const { receipt: rcpt } = await IncomeService.recordIncomeReceipt(
        propA.id,
        income.id,
        {
          amount: 600,
          accountId: bankAccountA.id,
          paymentMethod: methodBankA.code,
        },
        userAdminA.id
      );

      // 1. Attempting to void income directly must be rejected
      await assert.rejects(
        async () => {
          await IncomeService.voidIncome(
            propA.id,
            income.id,
            { voidReason: "Auction disputed" },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("active collections"));
          return true;
        }
      );

      // 2. Void individual receipt with mandatory reason
      const afterReceiptVoid = await IncomeService.voidIncomeReceipt(
        propA.id,
        income.id,
        rcpt.id,
        { voidReason: "Buyer check bounced; transaction reversed" },
        userAdminA.id
      );

      assert.strictEqual(afterReceiptVoid.status, IncomeStatus.PENDING);
      assert.strictEqual(afterReceiptVoid.receivedAmount, "0.00");
      assert.strictEqual(afterReceiptVoid.outstandingAmount, "600.00");

      // Verify the receipt is marked VOIDED
      const voidedReceipt = afterReceiptVoid.receipts.find((r) => r.id === rcpt.id);
      assert.ok(voidedReceipt);
      assert.strictEqual(voidedReceipt.status, ReceiptStatus.VOIDED);
      assert.strictEqual(voidedReceipt.voidReason, "Buyer check bounced; transaction reversed");

      // Verify financial account balance reversal
      const stmt = await FinancialAccountService.getAccountStatement(propA.id, bankAccountA.id);
      const isRecordedInStatement = stmt.items.some((i) => i.id === rcpt.id);
      assert.strictEqual(isRecordedInStatement, false, "Voided receipt must not appear in active account ledger items");

      // 3. Now that all receipts are voided, voiding the income record is permitted
      const voidedIncome = await IncomeService.voidIncome(
        propA.id,
        income.id,
        { voidReason: "Auction officially invalidated by management" },
        userAdminA.id
      );

      assert.strictEqual(voidedIncome.status, IncomeStatus.VOID);
      assert.strictEqual(voidedIncome.voidReason, "Auction officially invalidated by management");
    });
  });

  // =========================================================================
  // 4. Income Editing Constraints
  // =========================================================================
  describe("4. Income Editing Invariants", () => {
    it("prevents reducing expected amount below amount already collected", async () => {
      const income = await IncomeService.createIncome(
        propA.id,
        {
          incomeHeadId: scrapCategoryA.id,
          title: "Newspaper Scrap",
          expectedAmount: 300,
        },
        userAdminA.id
      );

      await IncomeService.recordIncomeReceipt(
        propA.id,
        income.id,
        {
          amount: 200,
          accountId: cashAccountA.id,
          paymentMethod: methodCashA.code,
        },
        userAdminA.id
      );

      // Attempting to lower expected amount to $150 (below $200 received) must fail
      await assert.rejects(
        async () => {
          await IncomeService.updateIncome(
            propA.id,
            income.id,
            { expectedAmount: 150 },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("cannot be less than"));
          return true;
        }
      );

      // Increasing expected amount to $400 is permitted
      const updated = await IncomeService.updateIncome(
        propA.id,
        income.id,
        { expectedAmount: 400 },
        userAdminA.id
      );

      assert.strictEqual(updated.expectedAmount, "400.00");
      assert.strictEqual(updated.receivedAmount, "200.00");
      assert.strictEqual(updated.outstandingAmount, "200.00");
    });
  });

  // =========================================================================
  // 5. Category Management & Idempotent Seeding
  // =========================================================================
  describe("5. Category Management Invariants", () => {
    it("idempotently seeds missing default categories and protects referenced categories", async () => {
      // Seed default categories
      const seed1 = await IncomeHeadService.seedDefaultIncomeHeads(propB.id, userAdminB.id);
      assert.ok(seed1.seededCount >= 5);

      // Second seed should add 0 new heads
      const seed2 = await IncomeHeadService.seedDefaultIncomeHeads(propB.id, userAdminB.id);
      assert.strictEqual(seed2.seededCount, 0);

      // Create an unreferenced category and delete it
      const tempCat = await IncomeHeadService.createIncomeHead(
        propB.id,
        { name: "Temporary Cat", code: "TEMP_CAT" },
        userAdminB.id
      );

      const del = await IncomeHeadService.deleteOrDeactivateIncomeHead(propB.id, tempCat.id, userAdminB.id);
      assert.strictEqual(del.success, true);
    });
  });
});
