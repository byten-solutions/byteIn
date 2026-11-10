import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { RoleName, AccountType, ExpenseStatus, PaymentStatus } from "@prisma/client";
import { ExpenseHeadService, DEFAULT_EXPENSE_HEADS } from "../src/modules/expenses/expense-head.service";
import { ExpenseService } from "../src/modules/expenses/expense.service";
import { FinancialAccountService } from "../src/modules/financial-accounts/financial-accounts.service";
import { BadRequestError } from "../src/lib/errors";

describe("Phase 4 Stage 1: Expense Management Domain Services & Invariants", () => {
  const timestamp = Date.now();
  let propA: { id: string; name: string };
  let propB: { id: string; name: string };

  let userAdminA: { id: string; email: string };
  let userAdminB: { id: string; email: string };

  let accountBankA: { id: string; accountName: string };
  let accountCashA: { id: string; accountName: string };
  let accountInactiveA: { id: string; accountName: string };
  let accountBankB: { id: string; accountName: string };

  let methodCashA: { id: string; code: string };
  let methodBankA: { id: string; code: string };
  let methodInactiveA: { id: string; code: string };
  let methodCashB: { id: string; code: string };

  before(async () => {
    // 1. Setup properties
    propA = await prisma.property.create({
      data: {
        name: `Expense Hotel A ${timestamp}`,
        city: "San Francisco",
        status: "ACTIVE",
      },
    });

    propB = await prisma.property.create({
      data: {
        name: `Expense Hotel B ${timestamp}`,
        city: "Oakland",
        status: "ACTIVE",
      },
    });

    // 2. Setup users
    const adminRole = await prisma.role.findFirstOrThrow({ where: { name: RoleName.ADMIN } });
    const pwdHash = "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEF";

    userAdminA = await prisma.user.create({
      data: {
        name: "Admin Hotel A",
        email: `admin-a-exp-${timestamp}@byteinn.test`,
        passwordHash: pwdHash,
        roleId: adminRole.id,
        propertyId: propA.id,
        status: "ACTIVE",
      },
    });

    userAdminB = await prisma.user.create({
      data: {
        name: "Admin Hotel B",
        email: `admin-b-exp-${timestamp}@byteinn.test`,
        passwordHash: pwdHash,
        roleId: adminRole.id,
        propertyId: propB.id,
        status: "ACTIVE",
      },
    });

    // 3. Setup Financial Accounts
    accountBankA = await prisma.financialAccount.create({
      data: {
        propertyId: propA.id,
        accountName: `Operating Bank A ${timestamp}`,
        accountType: AccountType.BANK,
        openingBalance: 10000,
        openingBalanceDate: new Date("2026-01-01"),
        isDefault: true,
        isActive: true,
      },
    });

    accountCashA = await prisma.financialAccount.create({
      data: {
        propertyId: propA.id,
        accountName: `Petty Cash A ${timestamp}`,
        accountType: AccountType.CASH,
        openingBalance: 2000,
        openingBalanceDate: new Date("2026-01-01"),
        isDefault: false,
        isActive: true,
      },
    });

    accountInactiveA = await prisma.financialAccount.create({
      data: {
        propertyId: propA.id,
        accountName: `Old Closed Bank A ${timestamp}`,
        accountType: AccountType.BANK,
        openingBalance: 0,
        openingBalanceDate: new Date("2026-01-01"),
        isDefault: false,
        isActive: false, // Inactive
      },
    });

    accountBankB = await prisma.financialAccount.create({
      data: {
        propertyId: propB.id,
        accountName: `Hotel B Operating ${timestamp}`,
        accountType: AccountType.BANK,
        openingBalance: 5000,
        openingBalanceDate: new Date("2026-01-01"),
        isDefault: true,
        isActive: true,
      },
    });

    // 4. Setup Payment Methods
    methodCashA = await prisma.paymentMethod.create({
      data: {
        propertyId: propA.id,
        name: `Cash A ${timestamp}`,
        code: `CASH_${timestamp}`,
        defaultAccountId: accountCashA.id,
        isActive: true,
      },
    });

    methodBankA = await prisma.paymentMethod.create({
      data: {
        propertyId: propA.id,
        name: `Bank Wire A ${timestamp}`,
        code: `BANK_${timestamp}`,
        defaultAccountId: accountBankA.id,
        isActive: true,
      },
    });

    methodInactiveA = await prisma.paymentMethod.create({
      data: {
        propertyId: propA.id,
        name: `Inactive Method A ${timestamp}`,
        code: `INACTIVE_${timestamp}`,
        isActive: false,
      },
    });

    methodCashB = await prisma.paymentMethod.create({
      data: {
        propertyId: propB.id,
        name: `Cash B ${timestamp}`,
        code: `CASH_B_${timestamp}`,
        defaultAccountId: accountBankB.id,
        isActive: true,
      },
    });
  });

  after(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({
      where: { userId: { in: [userAdminA.id, userAdminB.id] } },
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
      where: { id: { in: [userAdminA.id, userAdminB.id] } },
    });
    await prisma.property.deleteMany({
      where: { id: { in: [propA.id, propB.id] } },
    });
  });

  // =========================================================================
  // 1. Expense Category (ExpenseHead) Operations & Invariants
  // =========================================================================
  describe("1. Expense Category (ExpenseHead) Invariants", () => {
    it("idempotently seeds 6 default categories without duplicates", async () => {
      const res1 = await ExpenseHeadService.seedDefaultExpenseHeads(propA.id, userAdminA.id);
      assert.strictEqual(res1.seededCount, 6);
      assert.strictEqual(res1.heads.length, 6);

      // Verify all default codes exist
      const codes = res1.heads.map((h) => h.code);
      for (const def of DEFAULT_EXPENSE_HEADS) {
        assert.ok(codes.includes(def.code));
      }

      // Second call must be idempotent: 0 new seeded
      const res2 = await ExpenseHeadService.seedDefaultExpenseHeads(propA.id, userAdminA.id);
      assert.strictEqual(res2.seededCount, 0);
      assert.strictEqual(res2.heads.length, 6);
    });

    it("creates custom category with uppercase code normalization", async () => {
      const custom = await ExpenseHeadService.createExpenseHead(
        propA.id,
        {
          name: "Laundry Chemicals",
          code: "laundry_chem", // lowercase should be normalized to uppercase
          description: "Industrial washing detergents and softeners",
        },
        userAdminA.id
      );

      assert.strictEqual(custom.code, "LAUNDRY_CHEM");
      assert.strictEqual(custom.name, "Laundry Chemicals");
      assert.strictEqual(custom.isActive, true);

      // Reject duplicate code for same property
      await assert.rejects(
        async () => {
          await ExpenseHeadService.createExpenseHead(
            propA.id,
            { name: "Duplicate Code", code: "LAUNDRY_CHEM" },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("already exists"));
          return true;
        }
      );
    });

    it("prevents modifying category code (code immutability)", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads[0];

      await assert.rejects(
        async () => {
          await ExpenseHeadService.updateExpenseHead(
            propA.id,
            head.id,
            { name: "New Name", code: "CHANGED_CODE" },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("code is immutable"));
          return true;
        }
      );

      // Updating name and description is permitted
      const updated = await ExpenseHeadService.updateExpenseHead(
        propA.id,
        head.id,
        { name: "Updated Utility Name", description: "Updated description" },
        userAdminA.id
      );

      assert.strictEqual(updated.name, "Updated Utility Name");
      assert.strictEqual(updated.description, "Updated description");
      assert.strictEqual(updated.code, head.code); // Unchanged
    });

    it("prevents deleting an expense category referenced by expenses (including VOID)", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const targetHead = heads.find((h) => h.code === "UTILITIES")!;

      // Create an expense referencing this category
      const expense = await ExpenseService.createExpense(
        propA.id,
        {
          expenseHeadId: targetHead.id,
          title: "Electric Bill July",
          amount: 500,
        },
        userAdminA.id
      );

      // Attempting to delete category must fail
      await assert.rejects(
        async () => {
          await ExpenseHeadService.deleteOrDeactivateExpenseHead(propA.id, targetHead.id, userAdminA.id);
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("referenced by"));
          return true;
        }
      );

      // Void the expense
      await ExpenseService.voidExpense(
        propA.id,
        expense.id,
        { voidReason: "Bill cancelled by utility provider" },
        userAdminA.id
      );

      // Even when referencing expense is VOID, deletion must still be rejected
      await assert.rejects(
        async () => {
          await ExpenseHeadService.deleteOrDeactivateExpenseHead(propA.id, targetHead.id, userAdminA.id);
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("referenced by"));
          return true;
        }
      );

      // Deactivation is permitted
      const deactivated = await ExpenseHeadService.updateExpenseHead(
        propA.id,
        targetHead.id,
        { isActive: false },
        userAdminA.id
      );
      assert.strictEqual(deactivated.isActive, false);

      // Unreferenced category can be deleted
      const tempCat = await ExpenseHeadService.createExpenseHead(
        propA.id,
        { name: "Temp To Delete", code: "TEMP_DELETE" },
        userAdminA.id
      );
      const delRes = await ExpenseHeadService.deleteOrDeactivateExpenseHead(propA.id, tempCat.id, userAdminA.id);
      assert.strictEqual(delRes.success, true);
    });
  });

  // =========================================================================
  // 2. Expense Lifecycle & Amount Protections
  // =========================================================================
  describe("2. Expense Lifecycle & Amount Protections", () => {
    it("creates expense in PENDING status and rejects non-positive amount", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads.find((h) => h.code === "MAINTENANCE")!;

      await assert.rejects(
        async () => {
          await ExpenseService.createExpense(
            propA.id,
            {
              expenseHeadId: head.id,
              title: "Zero Amount Expense",
              amount: 0,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          return true;
        }
      );

      const exp = await ExpenseService.createExpense(
        propA.id,
        {
          expenseHeadId: head.id,
          title: "HVAC Filter Replacement",
          amount: 850.5,
          vendorName: "CoolAir HVAC Solutions",
          referenceNumber: "INV-2026-991",
          expenseDate: "2026-08-10",
        },
        userAdminA.id
      );

      assert.strictEqual(exp.status, ExpenseStatus.PENDING);
      assert.strictEqual(exp.amount, "850.50");
      assert.strictEqual(exp.paidAmount, "0.00");
      assert.strictEqual(exp.outstandingAmount, "850.50");
      assert.strictEqual(exp.vendorName, "CoolAir HVAC Solutions");
      assert.strictEqual(exp.referenceNumber, "INV-2026-991");
    });

    it("rejects reducing expense amount below already paid amount", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads.find((h) => h.code === "SUPPLIES")!;

      const exp = await ExpenseService.createExpense(
        propA.id,
        {
          expenseHeadId: head.id,
          title: "Bulk Towels & Linens",
          amount: 1000,
        },
        userAdminA.id
      );

      // Disburse $400 payment
      await ExpenseService.recordExpensePayment(
        propA.id,
        exp.id,
        {
          accountId: accountBankA.id,
          paymentMethodCode: methodBankA.code,
          amount: 400,
        },
        userAdminA.id
      );

      // Attempting to lower expense amount to $300 (below $400 paid) must fail
      await assert.rejects(
        async () => {
          await ExpenseService.updateExpense(
            propA.id,
            exp.id,
            { amount: 300 },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("cannot be less than the already paid amount"));
          return true;
        }
      );

      // Increasing amount to $1200 succeeds
      const updated = await ExpenseService.updateExpense(
        propA.id,
        exp.id,
        { amount: 1200 },
        userAdminA.id
      );

      assert.strictEqual(updated.amount, "1200.00");
      assert.strictEqual(updated.paidAmount, "400.00");
      assert.strictEqual(updated.outstandingAmount, "800.00");
      assert.strictEqual(updated.status, ExpenseStatus.PARTIALLY_PAID);
    });

    it("rejects updating a voided expense", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads.find((h) => h.code === "SUPPLIES")!;

      const exp = await ExpenseService.createExpense(
        propA.id,
        {
          expenseHeadId: head.id,
          title: "Cancelled Order",
          amount: 250,
        },
        userAdminA.id
      );

      await ExpenseService.voidExpense(
        propA.id,
        exp.id,
        { voidReason: "Order cancelled before dispatch" },
        userAdminA.id
      );

      await assert.rejects(
        async () => {
          await ExpenseService.updateExpense(
            propA.id,
            exp.id,
            { title: "New Title" },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("voided"));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 3. Disbursement, Overpayment Prevention & Status Transitions
  // =========================================================================
  describe("3. Disbursement, Overpayment Prevention & Account Deductions", () => {
    it("transitions PENDING -> PARTIALLY_PAID -> PAID and deducts financial account balance", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads.find((h) => h.code === "FOOD_BEVERAGE")!;

      const initialStmt = await FinancialAccountService.getAccountStatement(propA.id, accountCashA.id);
      const initialCashBalance = Number(initialStmt.closingBalance);

      const exp = await ExpenseService.createExpense(
        propA.id,
        {
          expenseHeadId: head.id,
          title: "Pantry Groceries & Milk",
          amount: 300,
        },
        userAdminA.id
      );

      assert.strictEqual(exp.status, ExpenseStatus.PENDING);

      // 1. Partial payment of $100 from Cash
      const p1 = await ExpenseService.recordExpensePayment(
        propA.id,
        exp.id,
        {
          accountId: accountCashA.id,
          paymentMethodCode: methodCashA.code,
          amount: 100,
          referenceNumber: "RCPT-001",
        },
        userAdminA.id
      );

      assert.strictEqual(p1.expense.status, ExpenseStatus.PARTIALLY_PAID);
      assert.strictEqual(p1.expense.paidAmount, "100.00");
      assert.strictEqual(p1.expense.outstandingAmount, "200.00");

      // Verify cash account balance was reduced by $100
      const afterP1Stmt = await FinancialAccountService.getAccountStatement(propA.id, accountCashA.id);
      const afterP1Balance = Number(afterP1Stmt.closingBalance);
      assert.strictEqual(afterP1Balance, initialCashBalance - 100);

      // 2. Reject payment exceeding remaining balance ($201 > $200)
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp.id,
            {
              accountId: accountCashA.id,
              amount: 200.01,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("cannot exceed remaining balance"));
          return true;
        }
      );

      // 3. Final payment of $200 completes the balance
      const p2 = await ExpenseService.recordExpensePayment(
        propA.id,
        exp.id,
        {
          accountId: accountCashA.id,
          paymentMethodCode: methodCashA.code,
          amount: 200,
          referenceNumber: "RCPT-002",
        },
        userAdminA.id
      );

      assert.strictEqual(p2.expense.status, ExpenseStatus.PAID);
      assert.strictEqual(p2.expense.paidAmount, "300.00");
      assert.strictEqual(p2.expense.outstandingAmount, "0.00");

      // Account balance reduced by another $200 (total $300 deducted)
      const afterP2Stmt = await FinancialAccountService.getAccountStatement(propA.id, accountCashA.id);
      const afterP2Balance = Number(afterP2Stmt.closingBalance);
      assert.strictEqual(afterP2Balance, initialCashBalance - 300);

      // 4. Reject additional disbursement when already fully paid
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp.id,
            {
              accountId: accountCashA.id,
              amount: 50,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("already fully paid"));
          return true;
        }
      );
    });

    it("rejects disbursement from inactive account or inactive payment method", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads[0];

      const exp = await ExpenseService.createExpense(
        propA.id,
        {
          expenseHeadId: head.id,
          title: "Test Inactive Account",
          amount: 100,
        },
        userAdminA.id
      );

      // Inactive financial account
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp.id,
            {
              accountId: accountInactiveA.id,
              amount: 50,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("inactive financial account"));
          return true;
        }
      );

      // Inactive payment method
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp.id,
            {
              accountId: accountBankA.id,
              paymentMethodId: methodInactiveA.id,
              amount: 50,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("inactive payment method"));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 4. Idempotency Key Handling & Replay Invariants
  // =========================================================================
  describe("4. Idempotency Key Handling & Replay Invariants", () => {
    it("returns original payment on identical retry and rejects mismatched details", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads.find((h) => h.code === "STAFF_WELFARE")!;

      const exp = await ExpenseService.createExpense(
        propA.id,
        {
          expenseHeadId: head.id,
          title: "Staff Coffee & Snacks",
          amount: 200,
        },
        userAdminA.id
      );

      const idempotencyKey = `idem-test-${Date.now()}`;

      // First submission
      const res1 = await ExpenseService.recordExpensePayment(
        propA.id,
        exp.id,
        {
          accountId: accountBankA.id,
          paymentMethodCode: methodBankA.code,
          amount: 75,
          referenceNumber: "SNACK-01",
          idempotencyKey,
        },
        userAdminA.id
      );

      assert.strictEqual(res1.payment.amount, "75.00");
      assert.strictEqual(res1.payment.idempotencyKey, idempotencyKey);
      assert.strictEqual(res1.idempotentReplay, undefined);

      // Identical retry submission with SAME idempotencyKey
      const res2 = await ExpenseService.recordExpensePayment(
        propA.id,
        exp.id,
        {
          accountId: accountBankA.id,
          paymentMethodCode: methodBankA.code,
          amount: 75,
          referenceNumber: "SNACK-01",
          idempotencyKey,
        },
        userAdminA.id
      );

      // Must return identical payment record with idempotentReplay flag
      assert.strictEqual(res2.payment.id, res1.payment.id);
      assert.strictEqual(res2.payment.amount, "75.00");
      assert.strictEqual(res2.idempotentReplay, true);

      // Verify database has only ONE payment recorded for this key
      const count = await prisma.payment.count({
        where: { propertyId: propA.id, idempotencyKey },
      });
      assert.strictEqual(count, 1, "Must never duplicate payment row on retry");

      // Verify expense still has only $75 paid
      const expCheck = await ExpenseService.getExpenseById(propA.id, exp.id);
      assert.strictEqual(expCheck.paidAmount, "75.00");

      // Attempting to reuse the SAME idempotency key with DIFFERENT details (amount = $80) must be rejected
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp.id,
            {
              accountId: accountBankA.id,
              amount: 80, // Different amount
              idempotencyKey,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("different details"));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 5. Controlled Two-Stage Voiding
  // =========================================================================
  describe("5. Controlled Two-Stage Voiding", () => {
    it("enforces two-stage voiding: rejects expense voiding with active payments, restores balance upon payment void", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads.find((h) => h.code === "MISC_EXPENSE")!;

      const exp = await ExpenseService.createExpense(
        propA.id,
        {
          expenseHeadId: head.id,
          title: "Office Stationary & Printing",
          amount: 400,
        },
        userAdminA.id
      );

      // Disburse payment
      const p = await ExpenseService.recordExpensePayment(
        propA.id,
        exp.id,
        {
          accountId: accountBankA.id,
          paymentMethodCode: methodBankA.code,
          amount: 400,
        },
        userAdminA.id
      );

      assert.strictEqual(p.expense.status, ExpenseStatus.PAID);

      // 1. Attempting to void expense directly while payment is active must fail
      await assert.rejects(
        async () => {
          await ExpenseService.voidExpense(
            propA.id,
            exp.id,
            { voidReason: "Invoice disputed with printer" },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("active payments"));
          return true;
        }
      );

      // 2. Void individual payment with mandatory reason
      const stmtBefore = await FinancialAccountService.getAccountStatement(propA.id, accountBankA.id);
      const balanceBefore = Number(stmtBefore.closingBalance);

      const afterPaymentVoid = await ExpenseService.voidExpensePayment(
        propA.id,
        exp.id,
        p.payment.id,
        { voidReason: "Printing defective; vendor refunded payment" },
        userAdminA.id
      );

      assert.strictEqual(afterPaymentVoid.status, ExpenseStatus.PENDING);
      assert.strictEqual(afterPaymentVoid.paidAmount, "0.00");
      assert.strictEqual(afterPaymentVoid.outstandingAmount, "400.00");

      // Verify the payment is marked VOIDED
      const voidedPayment = afterPaymentVoid.payments.find((pay) => pay.id === p.payment.id);
      assert.ok(voidedPayment);
      assert.strictEqual(voidedPayment.status, PaymentStatus.VOIDED);
      assert.strictEqual(voidedPayment.voidReason, "Printing defective; vendor refunded payment");

      // Verify account balance restored by $400
      const stmtAfter = await FinancialAccountService.getAccountStatement(propA.id, accountBankA.id);
      const balanceAfter = Number(stmtAfter.closingBalance);
      assert.strictEqual(balanceAfter, balanceBefore + 400);

      // 3. Now that active payments count is 0, voiding the expense itself succeeds
      const voidedExp = await ExpenseService.voidExpense(
        propA.id,
        exp.id,
        { voidReason: "Order officially cancelled by manager" },
        userAdminA.id
      );

      assert.strictEqual(voidedExp.status, ExpenseStatus.VOID);
      assert.strictEqual(voidedExp.voidReason, "Order officially cancelled by manager");
    });
  });

  // =========================================================================
  // 6. Cross-Property Isolation Enforcements
  // =========================================================================
  describe("6. Cross-Property Isolation Enforcements", () => {
    it("rejects cross-property category, account, or payment method assignment", async () => {
      // Seed categories for hotel B
      const headsB = await ExpenseHeadService.seedDefaultExpenseHeads(propB.id, userAdminB.id);
      const headB = headsB.heads[0];

      // 1. Cannot create expense in Hotel A using category from Hotel B
      await assert.rejects(
        async () => {
          await ExpenseService.createExpense(
            propA.id,
            {
              expenseHeadId: headB.id, // Hotel B category
              title: "Cross Property Category",
              amount: 100,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          return true;
        }
      );

      // Create valid expense in Hotel A
      const headsA = await ExpenseHeadService.listExpenseHeads(propA.id);
      const expA = await ExpenseService.createExpense(
        propA.id,
        {
          expenseHeadId: headsA[0].id,
          title: "Hotel A Expense",
          amount: 200,
        },
        userAdminA.id
      );

      // 2. Cannot pay Hotel A expense from Hotel B account
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            expA.id,
            {
              accountId: accountBankB.id, // Hotel B account
              amount: 50,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          return true;
        }
      );

      // 3. Cannot pay Hotel A expense using Hotel B payment method
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            expA.id,
            {
              accountId: accountBankA.id,
              paymentMethodId: methodCashB.id, // Hotel B payment method
              amount: 50,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          return true;
        }
      );
    });
  });
});
