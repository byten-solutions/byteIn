import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { RoleName, AccountType, IncomeStatus, ReceiptStatus, Prisma } from "@prisma/client";
import { AuthService } from "../src/modules/auth/auth.service";
import { IncomeHeadService } from "../src/modules/income/income-head.service";
import { IncomeService } from "../src/modules/income/income.service";
import { FinancialAccountService } from "../src/modules/financial-accounts/financial-accounts.service";
import { BadRequestError, ConflictError, NotFoundError } from "../src/lib/errors";
import { updateIncomeHeadSchema } from "../src/modules/income/income.validation";

describe("Phase 3 Stage 1: Income Management Domain Services", () => {
  let propA: { id: string; name: string };
  let propB: { id: string; name: string };

  let userAdminA: { id: string };
  let userAdminB: { id: string };

  let accountA: { id: string };
  let accountB: { id: string };

  let methodCashA: { id: string; code: string };

  before(async () => {
    // 1. Roles
    const adminRole = await prisma.role.upsert({
      where: { name: RoleName.ADMIN },
      update: {},
      create: { name: RoleName.ADMIN, description: "Hotel Admin" },
    });

    // 2. Properties
    propA = await prisma.property.create({
      data: {
        name: `Income Test Hotel A ${Date.now()}`,
        status: "ACTIVE",
        address: "101 Ocean Blvd",
        city: "Goa",
      },
    });
    propB = await prisma.property.create({
      data: {
        name: `Income Test Hotel B ${Date.now()}`,
        status: "ACTIVE",
        address: "202 Mountain Rd",
        city: "Manali",
      },
    });

    const passwordHash = await AuthService.hashPassword("Password@123");

    // 3. Admin Users
    userAdminA = await prisma.user.create({
      data: {
        name: "Admin Hotel A",
        email: `admin_inc_a_${Date.now()}@byteinn.local`,
        passwordHash,
        roleId: adminRole.id,
        propertyId: propA.id,
        status: "ACTIVE",
      },
    });

    userAdminB = await prisma.user.create({
      data: {
        name: "Admin Hotel B",
        email: `admin_inc_b_${Date.now()}@byteinn.local`,
        passwordHash,
        roleId: adminRole.id,
        propertyId: propB.id,
        status: "ACTIVE",
      },
    });

    // 4. Financial Accounts
    accountA = await prisma.financialAccount.create({
      data: {
        propertyId: propA.id,
        accountName: "Front Desk Cash Drawer",
        accountType: AccountType.CASH,
        openingBalance: new Prisma.Decimal("1000.00"),
        isDefault: true,
        isActive: true,
      },
    });

    accountB = await prisma.financialAccount.create({
      data: {
        propertyId: propB.id,
        accountName: "Hotel B Bank Account",
        accountType: AccountType.BANK,
        openingBalance: new Prisma.Decimal("5000.00"),
        isDefault: true,
        isActive: true,
      },
    });

    // 5. Payment Methods
    methodCashA = await prisma.paymentMethod.create({
      data: {
        propertyId: propA.id,
        name: "Cash",
        code: "CASH",
        defaultAccountId: accountA.id,
        isActive: true,
      },
    });
  });

  after(async () => {
    const propIds = [propA?.id, propB?.id].filter(Boolean);
    if (propIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { user: { id: { in: [userAdminA?.id, userAdminB?.id].filter(Boolean) } } },
      }).catch(() => {});

      await prisma.receipt.deleteMany({
        where: { propertyId: { in: propIds } },
      }).catch(() => {});

      await prisma.income.deleteMany({
        where: { propertyId: { in: propIds } },
      }).catch(() => {});

      await prisma.incomeHead.deleteMany({
        where: { propertyId: { in: propIds } },
      }).catch(() => {});

      await prisma.paymentMethod.deleteMany({
        where: { propertyId: { in: propIds } },
      }).catch(() => {});

      await prisma.financialAccount.deleteMany({
        where: { propertyId: { in: propIds } },
      }).catch(() => {});
    }

    await prisma.user.deleteMany({
      where: { id: { in: [userAdminA?.id, userAdminB?.id].filter(Boolean) } },
    }).catch(() => {});

    await prisma.property.deleteMany({
      where: { id: { in: propIds } },
    }).catch(() => {});
  });

  // =========================================================================
  // 1. IncomeHeadService Tests
  // =========================================================================
  describe("1. IncomeHeadService (Categories)", () => {
    it("creates an income head with uppercase code slug", async () => {
      const head = await IncomeHeadService.createIncomeHead(
        propA.id,
        {
          name: "Tour Operator Commission",
          code: "tour_comm",
          description: "Commissions from local safari and tour bookings",
        },
        userAdminA.id
      );

      assert.ok(head.id);
      assert.strictEqual(head.propertyId, propA.id);
      assert.strictEqual(head.name, "Tour Operator Commission");
      assert.strictEqual(head.code, "TOUR_COMM"); // Normalized to uppercase
      assert.strictEqual(head.isActive, true);
    });

    it("rejects duplicate category code on the same property (ConflictError)", async () => {
      await assert.rejects(
        async () => {
          await IncomeHeadService.createIncomeHead(
            propA.id,
            {
              name: "Duplicate Tour Commission",
              code: "TOUR_COMM",
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ConflictError);
          assert.ok(String(err.message).includes("already exists"));
          return true;
        }
      );
    });

    it("allows identical category code on a different property (Multi-Hotel Isolation)", async () => {
      const headB = await IncomeHeadService.createIncomeHead(
        propB.id,
        {
          name: "Hotel B Tour Commission",
          code: "TOUR_COMM",
        },
        userAdminB.id
      );

      assert.ok(headB.id);
      assert.strictEqual(headB.propertyId, propB.id);
      assert.strictEqual(headB.code, "TOUR_COMM");
    });

    it("updates income head name, description and status", async () => {
      const head = await IncomeHeadService.createIncomeHead(
        propA.id,
        { name: "Old Name", code: "TEMP_HEAD" },
        userAdminA.id
      );

      const updated = await IncomeHeadService.updateIncomeHead(
        propA.id,
        head.id,
        { name: "Updated Name", description: "Added description", isActive: false },
        userAdminA.id
      );

      assert.strictEqual(updated.name, "Updated Name");
      assert.strictEqual(updated.description, "Added description");
      assert.strictEqual(updated.isActive, false);
      assert.strictEqual(updated.code, "TEMP_HEAD"); // Code is immutable
    });

    it("strictly rejects attempts to modify income head code via service and schema", async () => {
      // 1. Zod schema validation
      const parseResult = updateIncomeHeadSchema.safeParse({ code: "ALTERED_CODE", name: "Altered" });
      assert.strictEqual(parseResult.success, false);
      if (!parseResult.success) {
        assert.ok(
          parseResult.error.issues.some((i) => i.message.includes("immutable")),
          "Schema must reject code modifications with immutable message"
        );
      }

      // 2. Service level enforcement
      const heads = await IncomeHeadService.getIncomeHeads(propA.id);
      const targetHead = heads.find((h) => h.code === "TEMP_HEAD");
      assert.ok(targetHead);

      await assert.rejects(
        async () => {
          await IncomeHeadService.updateIncomeHead(
            propA.id,
            targetHead.id,
            // @ts-expect-error - testing malicious / unvalidated input
            { code: "ILLEGAL_MUTATION", name: "Hacked" },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("immutable"));
          return true;
        }
      );
    });

    it("deletes an unreferenced income head cleanly", async () => {
      const head = await IncomeHeadService.createIncomeHead(
        propA.id,
        { name: "To Delete", code: "TO_DEL" },
        userAdminA.id
      );

      const res = await IncomeHeadService.deleteOrDeactivateIncomeHead(
        propA.id,
        head.id,
        userAdminA.id
      );

      assert.strictEqual(res.success, true);
      await assert.rejects(async () => {
        await IncomeHeadService.getIncomeHeadById(propA.id, head.id);
      }, NotFoundError);
    });

    it("idempotently seeds default income heads for a hotel property", async () => {
      const seed1 = await IncomeHeadService.seedDefaultIncomeHeads(propA.id, userAdminA.id);
      assert.ok(seed1.seededCount >= 5, "Must seed standard default categories");

      const heads = await IncomeHeadService.getIncomeHeads(propA.id);
      const codes = heads.map((h) => h.code);
      assert.ok(codes.includes("COMMISSION"));
      assert.ok(codes.includes("SCRAP_ASSET_SALE"));
      assert.ok(codes.includes("FOREX_COMMISSION"));
      assert.ok(codes.includes("INTEREST"));
      assert.ok(codes.includes("OTHER_DIRECT_INCOME"));
      assert.ok(!codes.includes("BANQUET_EVENT"), "BANQUET_EVENT must NOT be seeded");

      // Second execution must be strictly idempotent
      const seed2 = await IncomeHeadService.seedDefaultIncomeHeads(propA.id, userAdminA.id);
      assert.strictEqual(seed2.seededCount, 0, "Idempotent re-seed must not add duplicates");
    });
  });

  // =========================================================================
  // 2. IncomeService Lifecycle & Calculations
  // =========================================================================
  describe("2. IncomeService Lifecycle & Direct Income Operations", () => {
    let commHeadId: string;

    before(async () => {
      const heads = await IncomeHeadService.getIncomeHeads(propA.id);
      const commHead = heads.find((h) => h.code === "COMMISSION");
      assert.ok(commHead);
      commHeadId = commHead.id;
    });

    it("creates a direct income with status PENDING and derived amounts", async () => {
      const income = await IncomeService.createIncome(
        propA.id,
        {
          incomeHeadId: commHeadId,
          title: "Taj Tour Desk Commission Nov 2026",
          expectedAmount: 500,
          description: "Monthly payout for sight-seeing tours",
        },
        userAdminA.id
      );

      assert.ok(income.id);
      assert.strictEqual(income.propertyId, propA.id);
      assert.strictEqual(income.expectedAmount, "500.00");
      assert.strictEqual(income.receivedAmount, "0.00");
      assert.strictEqual(income.outstandingAmount, "500.00");
      assert.strictEqual(income.status, IncomeStatus.PENDING);
      assert.strictEqual(income.receiptCount, 0);
    });

    it("rejects non-positive expected amount (<= 0)", async () => {
      await assert.rejects(
        async () => {
          await IncomeService.createIncome(
            propA.id,
            {
              incomeHeadId: commHeadId,
              title: "Zero Dollar Income",
              expectedAmount: 0,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("greater than zero"));
          return true;
        }
      );
    });

    it("rejects creating income under an inactive category", async () => {
      const inactiveHead = await IncomeHeadService.createIncomeHead(
        propA.id,
        { name: "Inactive Head", code: "INACTIVE_HEAD" },
        userAdminA.id
      );
      await IncomeHeadService.updateIncomeHead(propA.id, inactiveHead.id, { isActive: false }, userAdminA.id);

      await assert.rejects(
        async () => {
          await IncomeService.createIncome(
            propA.id,
            {
              incomeHeadId: inactiveHead.id,
              title: "Income With Inactive Head",
              expectedAmount: 250,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("inactive category"));
          return true;
        }
      );
    });

    it("prevents deleting an income head referenced by an existing income", async () => {
      await assert.rejects(
        async () => {
          await IncomeHeadService.deleteOrDeactivateIncomeHead(propA.id, commHeadId, userAdminA.id);
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("referenced by"));
          return true;
        }
      );
    });

    it("prevents deleting an income head even if all referencing incomes are VOID", async () => {
      // 1. Create a special category
      const voidCat = await IncomeHeadService.createIncomeHead(
        propA.id,
        { name: "Voided Category Only", code: "VOID_ONLY_CAT" },
        userAdminA.id
      );

      // 2. Create an income referencing it
      const tempIncome = await IncomeService.createIncome(
        propA.id,
        {
          incomeHeadId: voidCat.id,
          title: "Temporary Income to Void",
          expectedAmount: 100,
        },
        userAdminA.id
      );

      // 3. Void the income
      await IncomeService.voidIncome(
        propA.id,
        tempIncome.id,
        { voidReason: "Voided for category test" },
        userAdminA.id
      );

      // 4. Verify attempting to delete the income head is strictly rejected
      await assert.rejects(
        async () => {
          await IncomeHeadService.deleteOrDeactivateIncomeHead(propA.id, voidCat.id, userAdminA.id);
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("referenced by"));
          assert.ok(String(err.message).includes("voided records"));
          return true;
        }
      );
    });

    it("updates income title, description, and expected amount when PENDING", async () => {
      const income = await IncomeService.createIncome(
        propA.id,
        {
          incomeHeadId: commHeadId,
          title: "Scrap Newspaper Sale",
          expectedAmount: 150,
        },
        userAdminA.id
      );

      const updated = await IncomeService.updateIncome(
        propA.id,
        income.id,
        {
          title: "Old Newspapers & Cardboard Sale",
          expectedAmount: 180,
          description: "Vendor weighed 90kg paper",
        },
        userAdminA.id
      );

      assert.strictEqual(updated.title, "Old Newspapers & Cardboard Sale");
      assert.strictEqual(updated.expectedAmount, "180.00");
      assert.strictEqual(updated.outstandingAmount, "180.00");
    });
  });

  // =========================================================================
  // 3. Collection Receipts, Financial Account Balances & Status Transitions
  // =========================================================================
  describe("3. Income Collections & Derived Financial Balances", () => {
    let incomeId: string;
    let initialBalance: string;

    before(async () => {
      const heads = await IncomeHeadService.getIncomeHeads(propA.id);
      const scrapHead = heads.find((h) => h.code === "SCRAP_ASSET_SALE");
      assert.ok(scrapHead);

      const income = await IncomeService.createIncome(
        propA.id,
        {
          incomeHeadId: scrapHead.id,
          title: "Old Metal Scrap Sale",
          expectedAmount: 1000,
        },
        userAdminA.id
      );
      incomeId = income.id;

      // Check baseline balance of accountA
      const accs = await FinancialAccountService.getAccounts(propA.id);
      const acc = accs.find((a) => a.id === accountA.id);
      assert.ok(acc);
      initialBalance = acc.currentBalance;
    });

    it("records partial collection receipt: status becomes PARTIALLY_RECEIVED", async () => {
      const { income, receipt } = await IncomeService.recordIncomeReceipt(
        propA.id,
        incomeId,
        {
          amount: 400,
          accountId: accountA.id,
          paymentMethod: "CASH",
          paymentMethodId: methodCashA.id,
          referenceNumber: "SCRAP-REC-001",
        },
        userAdminA.id
      );

      // Verify Receipt attributes
      assert.ok(receipt.id);
      assert.strictEqual(receipt.incomeId, incomeId);
      assert.strictEqual(receipt.amount, "400.00");
      assert.strictEqual(receipt.paymentMethodCode, "CASH");
      assert.strictEqual(receipt.status, ReceiptStatus.RECORDED);

      // Verify DB constraint chk_receipts_source_exclusivity: invoiceId MUST be null
      const rawReceipt = await prisma.receipt.findUniqueOrThrow({ where: { id: receipt.id } });
      assert.strictEqual(rawReceipt.incomeId, incomeId);
      assert.strictEqual(rawReceipt.invoiceId, null);

      // Verify Income derived status and amounts
      assert.strictEqual(income.status, IncomeStatus.PARTIALLY_RECEIVED);
      assert.strictEqual(income.expectedAmount, "1000.00");
      assert.strictEqual(income.receivedAmount, "400.00");
      assert.strictEqual(income.outstandingAmount, "600.00");
      assert.strictEqual(income.receipts.length, 1);

      // Verify FinancialAccount balance increased by exactly 400.00
      const accs = await FinancialAccountService.getAccounts(propA.id);
      const acc = accs.find((a) => a.id === accountA.id);
      assert.ok(acc);
      const expectedNewBalance = new Prisma.Decimal(initialBalance).add(400).toFixed(2);
      assert.strictEqual(acc.currentBalance, expectedNewBalance);
    });

    it("rejects lowering expected amount below already collected amount", async () => {
      await assert.rejects(
        async () => {
          await IncomeService.updateIncome(
            propA.id,
            incomeId,
            { expectedAmount: 350 }, // Less than collected 400.00!
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("cannot be less than the already collected amount"));
          return true;
        }
      );
    });

    it("rejects collection exceeding remaining outstanding balance", async () => {
      // Outstanding balance is $600. Attempting to collect $700 must be rejected
      await assert.rejects(
        async () => {
          await IncomeService.recordIncomeReceipt(
            propA.id,
            incomeId,
            {
              amount: 700,
              accountId: accountA.id,
              paymentMethod: "CASH",
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("exceeds remaining outstanding balance of $600.00"));
          return true;
        }
      );
    });

    it("records second collection completing full amount: status becomes RECEIVED", async () => {
      const { income, receipt } = await IncomeService.recordIncomeReceipt(
        propA.id,
        incomeId,
        {
          amount: 600, // Completes 400 + 600 = 1000.00
          accountId: accountA.id,
          paymentMethod: "CASH",
          referenceNumber: "SCRAP-REC-002",
        },
        userAdminA.id
      );

      assert.strictEqual(receipt.amount, "600.00");
      assert.strictEqual(income.status, IncomeStatus.RECEIVED);
      assert.strictEqual(income.receivedAmount, "1000.00");
      assert.strictEqual(income.outstandingAmount, "0.00");
      assert.strictEqual(income.receipts.length, 2);

      // Verify FinancialAccount balance increased by total $1000.00
      const accs = await FinancialAccountService.getAccounts(propA.id);
      const acc = accs.find((a) => a.id === accountA.id);
      assert.ok(acc);
      const expectedTotalBalance = new Prisma.Decimal(initialBalance).add(1000).toFixed(2);
      assert.strictEqual(acc.currentBalance, expectedTotalBalance);
    });

    it("rejects further collection once income is fully collected", async () => {
      await assert.rejects(
        async () => {
          await IncomeService.recordIncomeReceipt(
            propA.id,
            incomeId,
            {
              amount: 50,
              accountId: accountA.id,
              paymentMethod: "CASH",
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("already fully collected"));
          return true;
        }
      );
    });

    it("verifies direct income receipts are visible in the Financial Account Statement", async () => {
      const stmt = await FinancialAccountService.getAccountStatement(propA.id, accountA.id);
      const incomeEntries = stmt.items.filter(
        (i) => i.description === "Direct Income"
      );
      assert.ok(incomeEntries.length >= 2, "Account statement must include direct income receipt items");
    });
  });

  // =========================================================================
  // 4. Concurrency & Over-Collection Prevention
  // =========================================================================
  describe("4. Concurrency & Row-Lock Serialization", () => {
    it("serializes simultaneous collections and prevents concurrent over-spending", async () => {
      const heads = await IncomeHeadService.getIncomeHeads(propA.id);
      const miscHead = heads.find((h) => h.code === "OTHER_DIRECT_INCOME");
      assert.ok(miscHead);

      const income = await IncomeService.createIncome(
        propA.id,
        {
          incomeHeadId: miscHead.id,
          title: "Parking Lot Rental - Festival Weekend",
          expectedAmount: 500,
        },
        userAdminA.id
      );

      // Launch 3 simultaneous payments of $300 each against $500 total
      // Exactly 1 must succeed ($300), and second/third must either be rejected or accepted only up to $500 total
      const promises = [
        IncomeService.recordIncomeReceipt(
          propA.id,
          income.id,
          { amount: 300, accountId: accountA.id, paymentMethod: "CASH" },
          userAdminA.id
        ),
        IncomeService.recordIncomeReceipt(
          propA.id,
          income.id,
          { amount: 300, accountId: accountA.id, paymentMethod: "CASH" },
          userAdminA.id
        ),
      ];

      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      assert.strictEqual(fulfilled.length, 1, "Only one concurrent $300 payment should succeed");
      assert.strictEqual(rejected.length, 1, "Second concurrent $300 payment must be rejected for exceeding $500 expected total");

      // Verify final income state remains exact
      const verified = await IncomeService.getIncomeById(propA.id, income.id);
      assert.strictEqual(verified.receivedAmount, "300.00");
      assert.strictEqual(verified.outstandingAmount, "200.00");
      assert.strictEqual(verified.status, IncomeStatus.PARTIALLY_RECEIVED);
    });
  });

  // =========================================================================
  // 5. Voiding Safeguards & Financial Reversals
  // =========================================================================
  describe("5. Voiding Safeguards & Financial Reversals", () => {
    let incomeId: string;
    let receipt1Id: string;
    let receipt2Id: string;
    let initialAccountBalance: string;

    before(async () => {
      const heads = await IncomeHeadService.getIncomeHeads(propA.id);
      const forexHead = heads.find((h) => h.code === "FOREX_COMMISSION");
      assert.ok(forexHead);

      const income = await IncomeService.createIncome(
        propA.id,
        {
          incomeHeadId: forexHead.id,
          title: "Foreign Exchange Margin - Group Tour",
          expectedAmount: 800,
        },
        userAdminA.id
      );
      incomeId = income.id;

      const accs = await FinancialAccountService.getAccounts(propA.id);
      const acc = accs.find((a) => a.id === accountA.id);
      assert.ok(acc);
      initialAccountBalance = acc.currentBalance;

      // Record 2 collections ($500 + $300)
      const pay1 = await IncomeService.recordIncomeReceipt(
        propA.id,
        incomeId,
        { amount: 500, accountId: accountA.id, paymentMethod: "CASH" },
        userAdminA.id
      );
      receipt1Id = pay1.receipt.id;

      const pay2 = await IncomeService.recordIncomeReceipt(
        propA.id,
        incomeId,
        { amount: 300, accountId: accountA.id, paymentMethod: "CASH" },
        userAdminA.id
      );
      receipt2Id = pay2.receipt.id;
    });

    it("blocks voiding an income directly while active receipts exist", async () => {
      await assert.rejects(
        async () => {
          await IncomeService.voidIncome(
            propA.id,
            incomeId,
            { voidReason: "Direct cancellation attempt" },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("active collections"));
          return true;
        }
      );
    });

    it("voids a receipt, reverses account balance, and transitions status to PARTIALLY_RECEIVED", async () => {
      const updated = await IncomeService.voidIncomeReceipt(
        propA.id,
        incomeId,
        receipt2Id, // Void $300 receipt
        { voidReason: "Guest canceled forex exchange" },
        userAdminA.id
      );

      // Income transitions back from RECEIVED to PARTIALLY_RECEIVED
      assert.strictEqual(updated.status, IncomeStatus.PARTIALLY_RECEIVED);
      assert.strictEqual(updated.receivedAmount, "500.00");
      assert.strictEqual(updated.outstandingAmount, "300.00");

      // Verify the voided receipt has void metadata
      const voidedReceipt = updated.receipts.find((r) => r.id === receipt2Id);
      assert.ok(voidedReceipt);
      assert.strictEqual(voidedReceipt.status, ReceiptStatus.VOIDED);
      assert.strictEqual(voidedReceipt.voidReason, "Guest canceled forex exchange");
      assert.ok(voidedReceipt.voidedAt);
      assert.strictEqual(voidedReceipt.voidedBy, userAdminA.id);

      // Verify FinancialAccount balance automatically reversed by $300
      const accs = await FinancialAccountService.getAccounts(propA.id);
      const acc = accs.find((a) => a.id === accountA.id);
      assert.ok(acc);
      const expectedBalance = new Prisma.Decimal(initialAccountBalance).add(500).toFixed(2);
      assert.strictEqual(acc.currentBalance, expectedBalance);
    });

    it("voiding the remaining receipt transitions status back to PENDING", async () => {
      const updated = await IncomeService.voidIncomeReceipt(
        propA.id,
        incomeId,
        receipt1Id, // Void remaining $500 receipt
        { voidReason: "Operator error entered wrong amount" },
        userAdminA.id
      );

      assert.strictEqual(updated.status, IncomeStatus.PENDING);
      assert.strictEqual(updated.receivedAmount, "0.00");
      assert.strictEqual(updated.outstandingAmount, "800.00");

      // FinancialAccount balance reversed completely back to initial baseline
      const accs = await FinancialAccountService.getAccounts(propA.id);
      const acc = accs.find((a) => a.id === accountA.id);
      assert.ok(acc);
      assert.strictEqual(acc.currentBalance, initialAccountBalance);
    });

    it("allows voiding the income once all receipts have been voided", async () => {
      const voidedIncome = await IncomeService.voidIncome(
        propA.id,
        incomeId,
        { voidReason: "Entire transaction negotiated directly by owner" },
        userAdminA.id
      );

      assert.strictEqual(voidedIncome.status, IncomeStatus.VOID);
      assert.strictEqual(voidedIncome.voidReason, "Entire transaction negotiated directly by owner");
      assert.ok(voidedIncome.voidedAt);
      assert.strictEqual(voidedIncome.voidedBy, userAdminA.id);

      // Verify that further collections against voided income are rejected
      await assert.rejects(
        async () => {
          await IncomeService.recordIncomeReceipt(
            propA.id,
            incomeId,
            { amount: 100, accountId: accountA.id, paymentMethod: "CASH" },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("voided income record"));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 6. Property-Level Relationship Integrity
  // =========================================================================
  describe("6. Cross-Property Integrity Enforcements", () => {
    it("rejects creating income referencing an income head from another property", async () => {
      // Create head on Property B
      const headB = await IncomeHeadService.createIncomeHead(
        propB.id,
        { name: "Prop B Category", code: "PROP_B_CAT" },
        userAdminB.id
      );

      // Attempt to create income on Property A using headB -> must be rejected by service and composite FK
      await assert.rejects(
        async () => {
          await IncomeService.createIncome(
            propA.id, // Property A
            {
              incomeHeadId: headB.id, // Belonging to Property B!
              title: "Cross Property Income",
              expectedAmount: 100,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("does not exist for this property"));
          return true;
        }
      );
    });

    it("rejects recording receipt referencing a financial account from another property", async () => {
      const heads = await IncomeHeadService.getIncomeHeads(propA.id);
      const headA = heads[0];

      const incomeA = await IncomeService.createIncome(
        propA.id,
        { incomeHeadId: headA.id, title: "Legit Income A", expectedAmount: 200 },
        userAdminA.id
      );

      // Attempt to route receipt into accountB (belonging to Property B!)
      await assert.rejects(
        async () => {
          await IncomeService.recordIncomeReceipt(
            propA.id,
            incomeA.id,
            {
              amount: 100,
              accountId: accountB.id, // Belonging to Property B!
              paymentMethod: "CASH",
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("belongs to another property"));
          return true;
        }
      );
    });
  });
});
