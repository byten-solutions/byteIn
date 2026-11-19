import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { RoleName, AccountType, ExpenseStatus, PaymentStatus, Prisma } from "@prisma/client";
import { ExpenseHeadService, DEFAULT_EXPENSE_HEADS } from "../src/modules/expenses/expense-head.service";
import { ExpenseService } from "../src/modules/expenses/expense.service";
import { FinancialAccountService } from "../src/modules/financial-accounts/financial-accounts.service";
import { BadRequestError, ConflictError } from "../src/lib/errors";

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

    it("rejects disbursement exceeding available financial account balance", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads[0];

      // Create an account with small balance ($150)
      const lowBalanceAccount = await prisma.financialAccount.create({
        data: {
          propertyId: propA.id,
          accountName: `Low Balance Account ${Date.now()}`,
          accountType: AccountType.CASH,
          openingBalance: 150,
          openingBalanceDate: new Date("2026-01-01"),
          isDefault: false,
          isActive: true,
        },
      });

      const exp = await ExpenseService.createExpense(
        propA.id,
        {
          expenseHeadId: head.id,
          title: "Large Appliance Purchase",
          amount: 300,
        },
        userAdminA.id
      );

      // Attempt to disburse $160 (exceeds $150 available)
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp.id,
            {
              accountId: lowBalanceAccount.id,
              amount: 160,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("Insufficient funds in financial account"));
          assert.ok(String(err.message).includes("Available balance: $150.00"));
          assert.ok(String(err.message).includes("requested disbursement: $160.00"));
          return true;
        }
      );

      // Disburse $100 (succeeds, remaining available = $50)
      await ExpenseService.recordExpensePayment(
        propA.id,
        exp.id,
        {
          accountId: lowBalanceAccount.id,
          amount: 100,
        },
        userAdminA.id
      );

      // Attempting to disburse remaining $60 (exceeds $50 remaining) must fail
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp.id,
            {
              accountId: lowBalanceAccount.id,
              amount: 60,
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          assert.ok(String(err.message).includes("Insufficient funds in financial account"));
          assert.ok(String(err.message).includes("Available balance: $50.00"));
          return true;
        }
      );
    });

    it("safely serializes concurrent balance-reducing disbursements and prevents overdraft", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads[0];

      // Account with exactly $100 available
      const concurrentAccount = await prisma.financialAccount.create({
        data: {
          propertyId: propA.id,
          accountName: `Concurrent Test Account ${Date.now()}`,
          accountType: AccountType.BANK,
          openingBalance: 100,
          openingBalanceDate: new Date("2026-01-01"),
          isDefault: false,
          isActive: true,
        },
      });

      // Two separate expenses of $80 each
      const exp1 = await ExpenseService.createExpense(
        propA.id,
        { expenseHeadId: head.id, title: "Concurrent Expense 1", amount: 80 },
        userAdminA.id
      );

      const exp2 = await ExpenseService.createExpense(
        propA.id,
        { expenseHeadId: head.id, title: "Concurrent Expense 2", amount: 80 },
        userAdminA.id
      );

      // Launch two concurrent disbursements of $80 against the $100 account
      const results = await Promise.allSettled([
        ExpenseService.recordExpensePayment(
          propA.id,
          exp1.id,
          { accountId: concurrentAccount.id, amount: 80 },
          userAdminA.id
        ),
        ExpenseService.recordExpensePayment(
          propA.id,
          exp2.id,
          { accountId: concurrentAccount.id, amount: 80 },
          userAdminA.id
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly one must succeed, and one must be rejected due to insufficient funds
      assert.strictEqual(fulfilled.length, 1, "Exactly one concurrent disbursement must succeed");
      assert.strictEqual(rejected.length, 1, "Exactly one concurrent disbursement must be rejected");

      const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
      assert.ok(rejectedError instanceof BadRequestError);
      assert.ok(String(rejectedError.message).includes("Insufficient funds"));

      // Closing balance must be exactly $20 ($100 - $80), never negative!
      const stmt = await FinancialAccountService.getAccountStatement(propA.id, concurrentAccount.id);
      assert.strictEqual(stmt.closingBalance, "20.00");
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

      // Measure account balance before initial payment
      const stmtBefore = await FinancialAccountService.getAccountStatement(propA.id, accountBankA.id);
      const balanceBefore = Number(stmtBefore.closingBalance);

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

      // Verify financial account balance was reduced correctly
      const stmtAfter1 = await FinancialAccountService.getAccountStatement(propA.id, accountBankA.id);
      const balanceAfter1 = Number(stmtAfter1.closingBalance);
      assert.strictEqual(balanceAfter1, balanceBefore - 75, "Account balance must be reduced by payment amount ($75)");

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

      // Verify financial account balance is NOT deducted again on idempotent retry
      const stmtAfter2 = await FinancialAccountService.getAccountStatement(propA.id, accountBankA.id);
      const balanceAfter2 = Number(stmtAfter2.closingBalance);
      assert.strictEqual(balanceAfter2, balanceAfter1, "Account balance must NOT be reduced again on idempotent retry");

      // Verify database has only ONE payment recorded for this key
      const count = await prisma.payment.count({
        where: { propertyId: propA.id, idempotencyKey },
      });
      assert.strictEqual(count, 1, "Must never duplicate payment row on retry");

      // Verify expense still has only $75 paid
      const expCheck = await ExpenseService.getExpenseById(propA.id, exp.id);
      assert.strictEqual(expCheck.paidAmount, "75.00");

      // Attempting to reuse the SAME idempotency key with DIFFERENT details (amount = $80) must return ConflictError (409)
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
          assert.ok(err instanceof ConflictError);
          assert.ok(String(err.message).includes("different details"));
          return true;
        }
      );
    });

    it("rejects idempotency key reuse with mismatched expense, account, payment method, reference, or paidAt", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads.find((h) => h.code === "STAFF_WELFARE")!;

      const exp1 = await ExpenseService.createExpense(
        propA.id,
        { expenseHeadId: head.id, title: "Payload Compare Exp 1", amount: 300 },
        userAdminA.id
      );

      const exp2 = await ExpenseService.createExpense(
        propA.id,
        { expenseHeadId: head.id, title: "Payload Compare Exp 2", amount: 300 },
        userAdminA.id
      );

      const key = `idem-payload-${Date.now()}`;
      const originalPayload = {
        accountId: accountBankA.id,
        paymentMethodId: methodBankA.id,
        paymentMethodCode: methodBankA.code,
        amount: 50,
        referenceNumber: "REF-MATCH-01",
        paidAt: "2026-06-01T10:00:00.000Z",
        idempotencyKey: key,
      };

      // 1. Initial disbursement
      const orig = await ExpenseService.recordExpensePayment(
        propA.id,
        exp1.id,
        originalPayload,
        userAdminA.id
      );
      assert.strictEqual(orig.payment.amount, "50.00");

      // 2. Matching retry succeeds
      const replay = await ExpenseService.recordExpensePayment(
        propA.id,
        exp1.id,
        originalPayload,
        userAdminA.id
      );
      assert.strictEqual(replay.payment.id, orig.payment.id);
      assert.strictEqual(replay.idempotentReplay, true);

      // 3. Mismatched expenseId
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp2.id, // Different expense
            originalPayload,
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ConflictError);
          return true;
        }
      );

      // 4. Mismatched accountId
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp1.id,
            { ...originalPayload, accountId: accountCashA.id }, // Different account
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ConflictError);
          return true;
        }
      );

      // 5. Mismatched paymentMethodId
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp1.id,
            { ...originalPayload, paymentMethodId: methodCashA.id }, // Different method
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ConflictError);
          return true;
        }
      );

      // 6. Mismatched referenceNumber
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp1.id,
            { ...originalPayload, referenceNumber: "REF-DIFFERENT" },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ConflictError);
          return true;
        }
      );

      // 7. Mismatched paidAt
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp1.id,
            { ...originalPayload, paidAt: "2026-06-02T10:00:00.000Z" },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ConflictError);
          return true;
        }
      );
    });

    it("correctly handles omitted paidAt and server defaults during retry comparison without false mismatches", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads[0];

      const exp = await ExpenseService.createExpense(
        propA.id,
        { expenseHeadId: head.id, title: "Defaults Idempotency Test", amount: 600 },
        userAdminA.id
      );

      const keyOmitted = `idem-defaults-${Date.now()}`;

      // 1. First submission: omit paidAt, paymentMethodCode, and referenceNumber
      const orig = await ExpenseService.recordExpensePayment(
        propA.id,
        exp.id,
        {
          accountId: accountBankA.id,
          amount: 100,
          idempotencyKey: keyOmitted,
        },
        userAdminA.id
      );

      assert.strictEqual(orig.payment.idempotencyKey, keyOmitted);
      assert.strictEqual(orig.payment.paymentMethodCode, "CASH", "Defaulted to CASH");
      assert.strictEqual(orig.payment.referenceNumber, null, "Defaulted to null");
      assert.ok(orig.payment.paidAt, "Server timestamp generated");
      assert.strictEqual(orig.idempotentReplay, undefined);

      // 2. Identical retry: also omits paidAt, paymentMethodCode, and referenceNumber
      const replay = await ExpenseService.recordExpensePayment(
        propA.id,
        exp.id,
        {
          accountId: accountBankA.id,
          amount: 100,
          idempotencyKey: keyOmitted,
        },
        userAdminA.id
      );

      // Must return identical original payment with idempotentReplay: true
      assert.strictEqual(replay.payment.id, orig.payment.id);
      assert.strictEqual(replay.payment.paidAt, orig.payment.paidAt, "Server-generated timestamp preserved on replay");
      assert.strictEqual(replay.idempotentReplay, true, "Must match and replay identically");

      // Verify no duplicate row was created in database
      const dbCount = await prisma.payment.count({
        where: { propertyId: propA.id, idempotencyKey: keyOmitted },
      });
      assert.strictEqual(dbCount, 1, "Exactly one payment must exist in DB");

      // 3. Reusing same key with explicitly supplied, different paidAt must fail with ConflictError
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp.id,
            {
              accountId: accountBankA.id,
              amount: 100,
              idempotencyKey: keyOmitted,
              paidAt: "2026-05-01T00:00:00.000Z", // Explicitly supplied, different paidAt
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ConflictError);
          assert.ok(String(err.message).includes("different details"));
          return true;
        }
      );

      // 4. Reusing same key with explicitly supplied, different paymentMethodCode must fail with ConflictError
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp.id,
            {
              accountId: accountBankA.id,
              amount: 100,
              idempotencyKey: keyOmitted,
              paymentMethodCode: methodBankA.code, // Different from defaulted CASH
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ConflictError);
          assert.ok(String(err.message).includes("different details"));
          return true;
        }
      );

      // 5. Reusing same key with explicitly supplied referenceNumber must fail with ConflictError
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp.id,
            {
              accountId: accountBankA.id,
              amount: 100,
              idempotencyKey: keyOmitted,
              referenceNumber: "REF-RETRIED", // Different from defaulted null
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ConflictError);
          assert.ok(String(err.message).includes("different details"));
          return true;
        }
      );

      // 6. Reverse case: when original request HAD an explicit custom paidAt, omitting paidAt on retry produces ConflictError
      const keyExplicit = `idem-explicit-${Date.now()}`;
      const origExplicit = await ExpenseService.recordExpensePayment(
        propA.id,
        exp.id,
        {
          accountId: accountBankA.id,
          amount: 50,
          idempotencyKey: keyExplicit,
          paidAt: "2026-04-15T12:00:00.000Z",
        },
        userAdminA.id
      );
      assert.strictEqual(origExplicit.payment.paidAt, "2026-04-15T12:00:00.000Z");

      // Matching explicit retry succeeds
      const replayExplicit = await ExpenseService.recordExpensePayment(
        propA.id,
        exp.id,
        {
          accountId: accountBankA.id,
          amount: 50,
          idempotencyKey: keyExplicit,
          paidAt: "2026-04-15T12:00:00.000Z",
        },
        userAdminA.id
      );
      assert.strictEqual(replayExplicit.payment.id, origExplicit.payment.id);
      assert.strictEqual(replayExplicit.idempotentReplay, true);

      // Retry with omitted paidAt must be rejected with ConflictError
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp.id,
            {
              accountId: accountBankA.id,
              amount: 50,
              idempotencyKey: keyExplicit,
              // paidAt omitted
            },
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ConflictError);
          assert.ok(String(err.message).includes("different details"));
          return true;
        }
      );
    });

    it("prevents recreation of previously voided payment through idempotency key retry", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads[0];

      const exp = await ExpenseService.createExpense(
        propA.id,
        { expenseHeadId: head.id, title: "Void Replay Test", amount: 150 },
        userAdminA.id
      );

      const voidKey = `idem-void-${Date.now()}`;
      const payload = {
        accountId: accountBankA.id,
        paymentMethodCode: methodBankA.code,
        amount: 60,
        idempotencyKey: voidKey,
      };

      // 1. Initial payment
      const p = await ExpenseService.recordExpensePayment(
        propA.id,
        exp.id,
        payload,
        userAdminA.id
      );
      assert.strictEqual(p.payment.status, PaymentStatus.RECORDED);

      // 2. Void the payment
      await ExpenseService.voidExpensePayment(
        propA.id,
        exp.id,
        p.payment.id,
        { voidReason: "Disbursement voided due to billing error" },
        userAdminA.id
      );

      // 3. Retry with original idempotency key must be strictly rejected with ConflictError
      await assert.rejects(
        async () => {
          await ExpenseService.recordExpensePayment(
            propA.id,
            exp.id,
            payload,
            userAdminA.id
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ConflictError);
          assert.ok(String(err.message).includes("previously voided and cannot be replayed"));
          return true;
        }
      );
    });

    it("handles concurrent idempotency requests and P2002 race conditions gracefully", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads[0];

      // Scenario A: Identical payload concurrent race
      const expA = await ExpenseService.createExpense(
        propA.id,
        { expenseHeadId: head.id, title: "Concurrent Race Exp A", amount: 200 },
        userAdminA.id
      );

      const raceKeyA = `race-idem-a-${Date.now()}`;
      const payloadA = {
        accountId: accountBankA.id,
        paymentMethodCode: methodBankA.code,
        amount: 70,
        idempotencyKey: raceKeyA,
      };

      // Fire two identical requests simultaneously
      const [resA1, resA2] = await Promise.all([
        ExpenseService.recordExpensePayment(propA.id, expA.id, payloadA, userAdminA.id),
        ExpenseService.recordExpensePayment(propA.id, expA.id, payloadA, userAdminA.id),
      ]);

      // Both must resolve without throwing, and both point to the same payment ID
      assert.strictEqual(resA1.payment.id, resA2.payment.id);
      assert.strictEqual(resA1.payment.amount, "70.00");

      const countA = await prisma.payment.count({
        where: { propertyId: propA.id, idempotencyKey: raceKeyA },
      });
      assert.strictEqual(countA, 1, "Exactly one payment must exist in DB");

      // Scenario B: Conflicting concurrent requests across different expenses using the SAME key
      const expB1 = await ExpenseService.createExpense(
        propA.id,
        { expenseHeadId: head.id, title: "Concurrent Race Exp B1", amount: 200 },
        userAdminA.id
      );
      const expB2 = await ExpenseService.createExpense(
        propA.id,
        { expenseHeadId: head.id, title: "Concurrent Race Exp B2", amount: 200 },
        userAdminA.id
      );

      const raceKeyB = `race-idem-b-${Date.now()}`;

      // Fire two concurrent requests for DIFFERENT expenses with the same idempotency key
      const resultsB = await Promise.allSettled([
        ExpenseService.recordExpensePayment(
          propA.id,
          expB1.id,
          { accountId: accountBankA.id, amount: 40, idempotencyKey: raceKeyB },
          userAdminA.id
        ),
        ExpenseService.recordExpensePayment(
          propA.id,
          expB2.id,
          { accountId: accountBankA.id, amount: 40, idempotencyKey: raceKeyB },
          userAdminA.id
        ),
      ]);

      const fulfilledB = resultsB.filter((r) => r.status === "fulfilled");
      const rejectedB = resultsB.filter((r) => r.status === "rejected");

      assert.strictEqual(fulfilledB.length, 1, "Exactly one payment must win the race");
      assert.strictEqual(rejectedB.length, 1, "The loser must be rejected with ConflictError");

      const errB = (rejectedB[0] as PromiseRejectedResult).reason;
      assert.ok(errB instanceof ConflictError, `Expected ConflictError, got: ${errB}`);
      assert.ok(String(errB.message).includes("different details"));

      const countB = await prisma.payment.count({
        where: { propertyId: propA.id, idempotencyKey: raceKeyB },
      });
      assert.strictEqual(countB, 1, "Exactly one payment row created in DB");
    });

    it("recovers from PostgreSQL P2002 unique constraint race condition outside aborted transaction", async () => {
      const heads = await ExpenseHeadService.listExpenseHeads(propA.id);
      const head = heads[0];

      const exp = await ExpenseService.createExpense(
        propA.id,
        { expenseHeadId: head.id, title: "P2002 Race Condition Test", amount: 300 },
        userAdminA.id
      );

      // --- Part 1: Identical payload P2002 race recovery ---
      const p2002Key = `race-p2002-match-${Date.now()}`;

      // Pre-commit payment in database to simulate concurrent transaction winning the race
      const committedOrig = await prisma.payment.create({
        data: {
          propertyId: propA.id,
          expenseId: exp.id,
          accountId: accountBankA.id,
          paymentMethodCode: methodBankA.code,
          amount: 120,
          idempotencyKey: p2002Key,
          status: PaymentStatus.RECORDED,
          paidAt: new Date(),
          createdBy: userAdminA.id,
        },
        include: {
          account: { select: { accountName: true } },
          creator: { select: { name: true } },
        },
      });

      // Intercept prisma.$transaction to simulate race condition:
      // step 6 (tx.payment.findFirst) returns null as if concurrent transaction had not yet committed,
      // so tx proceeds to step 8 (tx.payment.create) where PostgreSQL throws 23505 / Prisma P2002
      type TxFn<T> = (tx: Prisma.TransactionClient) => Promise<T>;
      type TxOptions = { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel };

      const original$transaction = prisma.$transaction.bind(prisma);
      let raceInterceptionActive = true;

      const intercept$transaction = async function <T>(
        fn: TxFn<T>,
        options?: TxOptions
      ): Promise<T> {
        if (raceInterceptionActive) {
          raceInterceptionActive = false;
          return await original$transaction(async (tx) => {
            const hijackedTx = new Proxy(tx, {
              get(target, prop, receiver) {
                if (prop === "payment") {
                  return new Proxy(target.payment, {
                    get(pTarget, pProp) {
                      if (pProp === "findFirst") {
                        return () => Promise.resolve(null);
                      }
                      return Reflect.get(pTarget, pProp);
                    },
                  });
                }
                return Reflect.get(target, prop, receiver);
              },
            });
            return await fn(hijackedTx);
          }, options);
        }
        return await original$transaction(fn, options);
      };

      prisma.$transaction = intercept$transaction as unknown as typeof prisma.$transaction;

      try {
        // --- Part 1: Identical payload P2002 race recovery ---
        raceInterceptionActive = true;
        const replayRes = await ExpenseService.recordExpensePayment(
          propA.id,
          exp.id,
          {
            accountId: accountBankA.id,
            paymentMethodCode: methodBankA.code,
            amount: 120,
            idempotencyKey: p2002Key,
          },
          userAdminA.id
        );

        // Verification 1: P2002 recovery succeeded without 25P02 aborted transaction error
        assert.strictEqual(replayRes.idempotentReplay, true, "Must have idempotentReplay flag");
        assert.strictEqual(replayRes.payment.id, committedOrig.id, "Must return original payment ID");
        assert.strictEqual(replayRes.payment.amount, "120.00");

        // Verification 2: Exactly one payment row exists in DB
        const p2002Count = await prisma.payment.count({
          where: { propertyId: propA.id, idempotencyKey: p2002Key },
        });
        assert.strictEqual(p2002Count, 1, "Exactly one payment must exist in DB");

        // --- Part 2: Mismatched payload P2002 race recovery produces ConflictError (409) ---
        const p2002MismatchKey = `race-p2002-mismatch-${Date.now()}`;
        await prisma.payment.create({
          data: {
            propertyId: propA.id,
            expenseId: exp.id,
            accountId: accountBankA.id,
            paymentMethodCode: methodBankA.code,
            amount: 80,
            idempotencyKey: p2002MismatchKey,
            status: PaymentStatus.RECORDED,
            paidAt: new Date(),
            createdBy: userAdminA.id,
          },
        });

        raceInterceptionActive = true;
        await assert.rejects(
          async () => {
            await ExpenseService.recordExpensePayment(
              propA.id,
              exp.id,
              {
                accountId: accountBankA.id,
                paymentMethodCode: methodBankA.code,
                amount: 90, // Different amount
                idempotencyKey: p2002MismatchKey,
              },
              userAdminA.id
            );
          },
          (err: unknown) => {
            assert.ok(err instanceof ConflictError);
            assert.ok(String(err.message).includes("different details"));
            return true;
          }
        );

        // --- Part 3: Voided payment P2002 race recovery produces ConflictError (409) ---
        const p2002VoidKey = `race-p2002-void-${Date.now()}`;
        await prisma.payment.create({
          data: {
            propertyId: propA.id,
            expenseId: exp.id,
            accountId: accountBankA.id,
            paymentMethodCode: methodBankA.code,
            amount: 50,
            idempotencyKey: p2002VoidKey,
            status: PaymentStatus.VOIDED,
            voidReason: "Pre-existing voided payment",
            voidedAt: new Date(),
            voidedBy: userAdminA.id,
            paidAt: new Date(),
            createdBy: userAdminA.id,
          },
        });

        raceInterceptionActive = true;
        await assert.rejects(
          async () => {
            await ExpenseService.recordExpensePayment(
              propA.id,
              exp.id,
              {
                accountId: accountBankA.id,
                paymentMethodCode: methodBankA.code,
                amount: 50,
                idempotencyKey: p2002VoidKey,
              },
              userAdminA.id
            );
          },
          (err: unknown) => {
            assert.ok(err instanceof ConflictError);
            assert.ok(String(err.message).includes("previously voided and cannot be replayed"));
            return true;
          }
        );
      } finally {
        prisma.$transaction = original$transaction;
      }
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
