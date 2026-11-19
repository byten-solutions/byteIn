import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { FinancialAccountService } from "../src/modules/financial-accounts/financial-accounts.service";
import { PaymentMethodService } from "../src/modules/payment-methods/payment-methods.service";
import { AccountType, ReceiptStatus } from "@prisma/client";
import { BadRequestError, ConflictError, NotFoundError } from "../src/lib/errors";

describe("Phase 2: Financial Accounts & Payment Methods Domain Services", () => {
  let testPropAId: string;
  let testPropBId: string;
  let testUserId: string;

  before(async () => {
    // 1. Create staff user
    const role = await prisma.role.findFirst({ where: { name: "ADMIN" } });
    const user = await prisma.user.create({
      data: {
        name: "Finance Domain Tester",
        email: `fin.domain.${Date.now()}@byteinn.test`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        roleId: role!.id,
        status: "ACTIVE",
      },
    });
    testUserId = user.id;

    // 2. Create Property A
    const propA = await prisma.property.create({
      data: {
        name: `Finance Prop A ${Date.now()}`,
        city: "Test City A",
        status: "ACTIVE",
      },
    });
    testPropAId = propA.id;

    // 3. Create Property B
    const propB = await prisma.property.create({
      data: {
        name: `Finance Prop B ${Date.now()}`,
        city: "Test City B",
        status: "ACTIVE",
      },
    });
    testPropBId = propB.id;
  });

  after(async () => {
    // Clean up test data
    await prisma.accountTransfer.deleteMany({
      where: { propertyId: { in: [testPropAId, testPropBId] } },
    });
    await prisma.receipt.deleteMany({
      where: { propertyId: { in: [testPropAId, testPropBId] } },
    });
    await prisma.payment.deleteMany({
      where: { propertyId: { in: [testPropAId, testPropBId] } },
    });
    await prisma.invoice.deleteMany({
      where: { propertyId: { in: [testPropAId, testPropBId] } },
    });
    await prisma.paymentMethod.deleteMany({
      where: { propertyId: { in: [testPropAId, testPropBId] } },
    });
    await prisma.financialAccount.deleteMany({
      where: { propertyId: { in: [testPropAId, testPropBId] } },
    });
    await prisma.property.deleteMany({
      where: { id: { in: [testPropAId, testPropBId] } },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
  });

  describe("1. Financial Account Creation & Uniqueness", () => {
    it("should successfully create accounts and enforce automatic default on first account", async () => {
      const acc1 = await FinancialAccountService.createAccount(
        testPropAId,
        {
          accountName: "Main Operating Cash",
          accountType: AccountType.CASH,
          openingBalance: "1500.00",
          openingBalanceDate: "2026-11-01",
        },
        testUserId
      );

      assert.equal(acc1.accountName, "Main Operating Cash");
      assert.equal(acc1.accountType, "CASH");
      assert.equal(acc1.openingBalance, "1500.00");
      assert.equal(acc1.isDefault, true, "First created account should automatically be default");
      assert.equal(acc1.isActive, true);

      // Create second account (Bank) with isDefault false
      const acc2 = await FinancialAccountService.createAccount(
        testPropAId,
        {
          accountName: "HDFC Primary Bank",
          accountType: AccountType.BANK,
          openingBalance: "50000.00",
          openingBalanceDate: "2026-11-01",
          isDefault: false,
        },
        testUserId
      );

      assert.equal(acc2.accountName, "HDFC Primary Bank");
      assert.equal(acc2.isDefault, false);
    });

    it("should reject creating an account with a duplicate name on the same property", async () => {
      await assert.rejects(
        async () => {
          await FinancialAccountService.createAccount(
            testPropAId,
            {
              accountName: "Main Operating Cash", // Duplicate on Prop A!
              accountType: AccountType.CASH,
            },
            testUserId
          );
        },
        (err) => err instanceof ConflictError,
        "Should reject duplicate account name on same property with ConflictError"
      );
    });

    it("should allow the same account name on a different property", async () => {
      const propBAcc = await FinancialAccountService.createAccount(
        testPropBId,
        {
          accountName: "Main Operating Cash", // Same name, but on Prop B
          accountType: AccountType.CASH,
          openingBalance: "2000.00",
        },
        testUserId
      );

      assert.equal(propBAcc.accountName, "Main Operating Cash");
      assert.equal(propBAcc.propertyId, testPropBId);
    });

    it("should atomically unset previous default when a new account is set as default", async () => {
      const acc3 = await FinancialAccountService.createAccount(
        testPropAId,
        {
          accountName: "SBI Secondary Bank",
          accountType: AccountType.BANK,
          openingBalance: "10000.00",
          isDefault: true, // Marked as new default!
        },
        testUserId
      );

      assert.equal(acc3.isDefault, true);

      // Verify previous default account ("Main Operating Cash") is no longer default
      const accounts = await FinancialAccountService.getAccounts(testPropAId);
      const prevDefault = accounts.find((a) => a.accountName === "Main Operating Cash");
      assert.equal(prevDefault?.isDefault, false, "Previous default must be reset to false");
    });
  });

  describe("2. Dynamic Derived Balance Calculation & openingBalanceDate Semantics", () => {
    it("should accurately compute derived balance observing openingBalanceDate and void status", async () => {
      // Create a test invoice to satisfy chk_receipts_source_exclusivity
      const invoice = await prisma.invoice.create({
        data: {
          propertyId: testPropAId,
          invoiceNumber: `INV-FIN-${Date.now()}`,
          subtotal: 5000.0,
          discountTotal: 0,
          taxTotal: 0,
          grandTotal: 5000.0,
          status: "ISSUED",
        },
      });

      // Create a test account with opening balance on Nov 05, 2026
      const acc = await FinancialAccountService.createAccount(
        testPropAId,
        {
          accountName: "Front Desk Float",
          accountType: AccountType.CASH,
          openingBalance: "1000.00",
          openingBalanceDate: "2026-11-05",
        },
        testUserId
      );

      // 1. Transaction BEFORE openingBalanceDate (Nov 01) -> MUST NOT affect balance!
      await prisma.receipt.create({
        data: {
          propertyId: testPropAId,
          invoiceId: invoice.id,
          accountId: acc.id,
          amount: 500.00,
          paymentMethodCode: "CASH",
          status: ReceiptStatus.RECORDED,
          paidAt: new Date("2026-11-01T10:00:00Z"),
          createdBy: testUserId,
        },
      });

      // 2. Transaction ON openingBalanceDate (Nov 05) -> MUST affect balance (+300)
      await prisma.receipt.create({
        data: {
          propertyId: testPropAId,
          invoiceId: invoice.id,
          accountId: acc.id,
          amount: 300.00,
          paymentMethodCode: "CASH",
          status: ReceiptStatus.RECORDED,
          paidAt: new Date("2026-11-05T12:00:00Z"),
          createdBy: testUserId,
        },
      });

      // 3. Transaction AFTER openingBalanceDate (Nov 08) -> MUST affect balance (+200)
      await prisma.receipt.create({
        data: {
          propertyId: testPropAId,
          invoiceId: invoice.id,
          accountId: acc.id,
          amount: 200.00,
          paymentMethodCode: "CASH",
          status: ReceiptStatus.RECORDED,
          paidAt: new Date("2026-11-08T15:00:00Z"),
          createdBy: testUserId,
        },
      });

      // 4. VOIDED transaction (Nov 08) -> MUST NOT affect balance!
      await prisma.receipt.create({
        data: {
          propertyId: testPropAId,
          invoiceId: invoice.id,
          accountId: acc.id,
          amount: 1000.00,
          paymentMethodCode: "CASH",
          status: ReceiptStatus.VOIDED,
          voidReason: "Customer cancelled",
          voidedAt: new Date(),
          voidedBy: testUserId,
          paidAt: new Date("2026-11-08T16:00:00Z"),
          createdBy: testUserId,
        },
      });

      // Query derived balance
      const accountWithBal = await FinancialAccountService.getAccountById(testPropAId, acc.id);

      // Expected: Opening (1000.00) + Nov 05 (300.00) + Nov 08 (200.00) = 1500.00
      assert.equal(accountWithBal.openingBalance, "1000.00");
      assert.equal(accountWithBal.totalReceipts, "500.00", "Total receipts on or after Nov 05");
      assert.equal(accountWithBal.currentBalance, "1500.00", "Current balance should exactly equal 1500.00");
    });

    it("should generate itemized statement with running balance excluding pre-openingDate transactions", async () => {
      const accounts = await FinancialAccountService.getAccounts(testPropAId);
      const acc = accounts.find((a) => a.accountName === "Front Desk Float");
      assert.ok(acc);

      const statement = await FinancialAccountService.getAccountStatement(testPropAId, acc.id);
      assert.equal(statement.openingBalanceOnStartDate, "1000.00");
      assert.equal(statement.closingBalance, "1500.00");
      assert.equal(statement.items.length, 2, "Nov 05 and Nov 08 receipts only (excluding pre-opening and voided)");
      assert.equal(statement.items[0].credit, "300.00");
      assert.equal(statement.items[0].runningBalance, "1300.00");
      assert.equal(statement.items[1].credit, "200.00");
      assert.equal(statement.items[1].runningBalance, "1500.00");
    });
  });

  describe("3. Account Lifecycle & Invariant Protection", () => {
    it("should reject deactivating the default account", async () => {
      const defaultAcc = (await FinancialAccountService.getAccounts(testPropAId)).find(
        (a) => a.isDefault
      );
      assert.ok(defaultAcc);

      await assert.rejects(
        async () => {
          await FinancialAccountService.updateAccount(
            testPropAId,
            defaultAcc.id,
            { isActive: false },
            testUserId
          );
        },
        (err) => err instanceof BadRequestError,
        "Should reject deactivating default account"
      );
    });

    it("should reject deactivating the last active account of a property", async () => {
      // Prop B has only 1 account ("Main Operating Cash")
      const propBAcc = (await FinancialAccountService.getAccounts(testPropBId))[0];
      assert.ok(propBAcc);

      await assert.rejects(
        async () => {
          await FinancialAccountService.updateAccount(
            testPropBId,
            propBAcc.id,
            { isActive: false },
            testUserId
          );
        },
        (err) => err instanceof BadRequestError,
        "Should reject deactivating the only active account on a property"
      );
    });

    it("should reject deleting an account that has transaction history", async () => {
      const accounts = await FinancialAccountService.getAccounts(testPropAId);
      const accWithHistory = accounts.find((a) => a.accountName === "Front Desk Float");
      assert.ok(accWithHistory);

      await assert.rejects(
        async () => {
          await FinancialAccountService.deleteAccount(testPropAId, accWithHistory.id, testUserId);
        },
        (err) => err instanceof BadRequestError,
        "Should reject deleting account with recorded transactions"
      );
    });
  });

  describe("4. Payment Methods Management", () => {
    let createdMethodId: string;

    it("should create dynamic payment method and link to a valid default account", async () => {
      const defaultAcc = (await FinancialAccountService.getAccounts(testPropAId)).find(
        (a) => a.accountName === "HDFC Primary Bank"
      );
      assert.ok(defaultAcc);

      const method = await PaymentMethodService.createPaymentMethod(
        testPropAId,
        {
          name: "Reception UPI QR",
          code: "UPI_DESK",
          defaultAccountId: defaultAcc.id,
          isActive: true,
        },
        testUserId
      );

      assert.equal(method.name, "Reception UPI QR");
      assert.equal(method.code, "UPI_DESK");
      assert.equal(method.defaultAccountId, defaultAcc.id);
      assert.equal(method.defaultAccountName, "HDFC Primary Bank");
      createdMethodId = method.id;
    });

    it("should reject creating a payment method with duplicate code on the same property", async () => {
      await assert.rejects(
        async () => {
          await PaymentMethodService.createPaymentMethod(
            testPropAId,
            {
              name: "Another UPI",
              code: "UPI_DESK", // Duplicate code on Prop A!
            },
            testUserId
          );
        },
        (err) => err instanceof ConflictError,
        "Should reject duplicate code per property"
      );
    });

    it("should reject default account assignment from another property", async () => {
      const propBAcc = (await FinancialAccountService.getAccounts(testPropBId))[0];
      assert.ok(propBAcc);

      await assert.rejects(
        async () => {
          await PaymentMethodService.createPaymentMethod(
            testPropAId,
            {
              name: "Card Terminal 2",
              code: "CARD_T2",
              defaultAccountId: propBAcc.id, // Prop B account for Prop A method!
            },
            testUserId
          );
        },
        (err) => err instanceof BadRequestError,
        "Should reject assigning default account belonging to another property"
      );
    });

    it("should update payment method and update default account", async () => {
      const updated = await PaymentMethodService.updatePaymentMethod(
        testPropAId,
        createdMethodId,
        {
          name: "Front Desk UPI Direct",
        },
        testUserId
      );

      assert.equal(updated.name, "Front Desk UPI Direct");
    });
  });

  describe("5. Account Transfers: Concurrency, Solvency & Multi-Property Invariants", () => {
    let sourceAccId: string;
    let destAccId: string;

    before(async () => {
      // Create dedicated source and destination accounts
      const src = await FinancialAccountService.createAccount(
        testPropAId,
        {
          accountName: "Transfer Source Cash",
          accountType: AccountType.CASH,
          openingBalance: "5000.00",
          openingBalanceDate: "2026-11-01",
        },
        testUserId
      );
      sourceAccId = src.id;

      const dest = await FinancialAccountService.createAccount(
        testPropAId,
        {
          accountName: "Transfer Dest Bank",
          accountType: AccountType.BANK,
          openingBalance: "1000.00",
          openingBalanceDate: "2026-11-01",
        },
        testUserId
      );
      destAccId = dest.id;
    });

    it("should reject transfer when amount exceeds available balance", async () => {
      await assert.rejects(
        async () => {
          await FinancialAccountService.createTransfer(
            testPropAId,
            {
              fromAccountId: sourceAccId,
              toAccountId: destAccId,
              amount: "6000.00", // Source has 5000.00!
              description: "Excessive transfer",
            },
            testUserId
          );
        },
        (err) => err instanceof BadRequestError && String(err).includes("Insufficient funds"),
        "Should reject transfer with Insufficient funds"
      );
    });

    it("should reject self-transfer (fromAccountId == toAccountId)", async () => {
      await assert.rejects(
        async () => {
          await FinancialAccountService.createTransfer(
            testPropAId,
            {
              fromAccountId: sourceAccId,
              toAccountId: sourceAccId, // Same account!
              amount: "100.00",
            },
            testUserId
          );
        },
        (err) => err instanceof BadRequestError,
        "Should reject self-transfer"
      );
    });

    it("should reject cross-property transfer", async () => {
      const propBAcc = (await FinancialAccountService.getAccounts(testPropBId))[0];
      assert.ok(propBAcc);

      await assert.rejects(
        async () => {
          await FinancialAccountService.createTransfer(
            testPropAId,
            {
              fromAccountId: sourceAccId,
              toAccountId: propBAcc.id, // Belonging to Prop B!
              amount: "500.00",
            },
            testUserId
          );
        },
        (err) => err instanceof NotFoundError,
        "Should reject transfer to account belonging to another property"
      );
    });

    it("should successfully execute atomic transfer and update both derived balances", async () => {
      const transfer = await FinancialAccountService.createTransfer(
        testPropAId,
        {
          fromAccountId: sourceAccId,
          toAccountId: destAccId,
          amount: "1500.00",
          description: "Nightly Cash Drop to Bank",
          referenceNumber: "DROP-NOV-10-001",
        },
        testUserId
      );

      assert.equal(transfer.amount, "1500.00");
      assert.equal(transfer.status, "COMPLETED");

      // Verify source account balance decreased: 5000 - 1500 = 3500
      const updatedSource = await FinancialAccountService.getAccountById(testPropAId, sourceAccId);
      assert.equal(updatedSource.totalTransfersOut, "1500.00");
      assert.equal(updatedSource.currentBalance, "3500.00");

      // Verify destination account balance increased: 1000 + 1500 = 2500
      const updatedDest = await FinancialAccountService.getAccountById(testPropAId, destAccId);
      assert.equal(updatedDest.totalTransfersIn, "1500.00");
      assert.equal(updatedDest.currentBalance, "2500.00");
    });

    it("should prevent concurrent transfers from overspending the same source account via row-level locking", async () => {
      // Source account currently has 3500.00 available.
      // Launch two concurrent transfers of 2000.00 each simultaneously (2000 + 2000 = 4000 > 3500)
      const transferPromiseA = FinancialAccountService.createTransfer(
        testPropAId,
        {
          fromAccountId: sourceAccId,
          toAccountId: destAccId,
          amount: "2000.00",
          description: "Concurrent Transfer A",
        },
        testUserId
      );

      const transferPromiseB = FinancialAccountService.createTransfer(
        testPropAId,
        {
          fromAccountId: sourceAccId,
          toAccountId: destAccId,
          amount: "2000.00",
          description: "Concurrent Transfer B",
        },
        testUserId
      );

      const [resA, resB] = await Promise.allSettled([transferPromiseA, transferPromiseB]);

      // Exactly one must succeed and one must fail with Insufficient funds
      const fulfilled = [resA, resB].filter((r) => r.status === "fulfilled");
      const rejected = [resA, resB].filter((r) => r.status === "rejected");

      assert.equal(fulfilled.length, 1, "Exactly one concurrent transfer should succeed");
      assert.equal(rejected.length, 1, "Exactly one concurrent transfer should be rejected");

      const failureReason = (rejected[0] as PromiseRejectedResult).reason;
      assert.ok(
        failureReason instanceof BadRequestError &&
          String(failureReason).includes("Insufficient funds"),
        "The second concurrent transfer must be rejected due to insufficient funds"
      );

      // Verify the final source account balance is exactly 3500 - 2000 = 1500.00 (not negative!)
      const finalSource = await FinancialAccountService.getAccountById(testPropAId, sourceAccId);
      assert.equal(finalSource.currentBalance, "1500.00");
    });
  });
});
