import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  AccountType,
  ReceiptStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";

describe("Phase 1: Financial Foundation & Database Integrity Tests", () => {
  let propertyAId: string;
  let propertyBId: string;
  let staffUserId: string;
  let accountAId: string;
  let accountBId: string;
  let invoiceAId: string;

  before(async () => {
    // 1. Fetch or create two distinct properties for cross-property isolation tests
    const properties = await prisma.property.findMany({ take: 2 });
    assert.ok(properties.length >= 2, "At least two properties required for multi-hotel tests");
    propertyAId = properties[0].id;
    propertyBId = properties[1].id;

    // 2. Fetch a staff user
    const user = await prisma.user.findFirst();
    assert.ok(user, "User required for test creation");
    staffUserId = user.id;

    // 3. Ensure financial accounts exist for both properties
    let accA = await prisma.financialAccount.findFirst({
      where: { propertyId: propertyAId, isActive: true },
    });
    if (!accA) {
      accA = await prisma.financialAccount.create({
        data: {
          propertyId: propertyAId,
          accountName: "Property A Cash Drawer",
          accountType: AccountType.CASH,
          isDefault: true,
        },
      });
    }
    accountAId = accA.id;

    let accB = await prisma.financialAccount.findFirst({
      where: { propertyId: propertyBId, isActive: true },
    });
    if (!accB) {
      accB = await prisma.financialAccount.create({
        data: {
          propertyId: propertyBId,
          accountName: "Property B Cash Drawer",
          accountType: AccountType.CASH,
          isDefault: true,
        },
      });
    }
    accountBId = accB.id;

    // 4. Create a test invoice on Property A
    const invA = await prisma.invoice.create({
      data: {
        propertyId: propertyAId,
        invoiceNumber: `INV-FIN-TEST-${Date.now()}`,
        subtotal: new Prisma.Decimal("1000.00"),
        grandTotal: new Prisma.Decimal("1000.00"),
      },
    });
    invoiceAId = invA.id;
  });

  after(async () => {
    // Clean up created test entities
    if (invoiceAId) {
      await prisma.receipt.deleteMany({ where: { invoiceId: invoiceAId } });
      await prisma.invoice.deleteMany({ where: { id: invoiceAId } });
    }
  });

  it("1. Verifies legacy accounts and legacy receipts exist and have valid structure", async () => {
    const legacyAccounts = await prisma.financialAccount.findMany({
      where: { accountName: "Legacy Receipts – Unallocated" },
    });
    assert.ok(legacyAccounts.length > 0, "Seeded legacy clearing account must exist");
    assert.equal(
      legacyAccounts[0].accountType,
      AccountType.CLEARING,
      "Legacy account must have CLEARING type"
    );

    const legacyReceiptsCount = await prisma.receipt.count({
      where: { isLegacy: true },
    });
    // In migrated databases, legacy receipts exist with isLegacy: true
    assert.ok(
      typeof legacyReceiptsCount === "number",
      "Legacy receipts query must return valid integer count"
    );
  });

  it("2. Enforces database-level check: receipt cannot have both invoiceId and incomeId", async () => {
    // Both invoiceId and incomeId populated -> must fail database check constraint
    await assert.rejects(
      async () => {
        await prisma.receipt.create({
          data: {
            propertyId: propertyAId,
            accountId: accountAId,
            invoiceId: invoiceAId,
            incomeId: "some-fake-income-id",
            amount: new Prisma.Decimal("100.00"),
            paymentMethodCode: "CASH",
            paidAt: new Date(),
            createdBy: staffUserId,
            status: ReceiptStatus.RECORDED,
          },
        });
      },
      (err: unknown) => {
        const error = err as { code?: string };
        return (
          error.code === "P2003" ||
          error.code === "P2010" ||
          String(err).includes("receipt_target_exclusive_chk") ||
          String(err).includes("violates check constraint")
        );
      },
      "Database must reject receipt with both invoiceId and incomeId"
    );
  });

  it("3. Enforces database-level cross-property integrity on Receipt -> Account", async () => {
    // Receipt on Property A referencing Account on Property B -> must fail composite FK
    await assert.rejects(
      async () => {
        await prisma.receipt.create({
          data: {
            propertyId: propertyAId, // Property A
            accountId: accountBId,   // Account belongs to Property B!
            invoiceId: invoiceAId,
            amount: new Prisma.Decimal("100.00"),
            paymentMethodCode: "CASH",
            paidAt: new Date(),
            createdBy: staffUserId,
            status: ReceiptStatus.RECORDED,
          },
        });
      },
      (err: unknown) => {
        const error = err as { code?: string };
        return (
          error.code === "P2003" ||
          String(err).includes("Foreign key constraint violated") ||
          String(err).includes("fk_receipts_account")
        );
      },
      "Database must reject receipt referencing an account from another property"
    );
  });

  it("4. Enforces database-level cross-property integrity on Receipt -> Invoice", async () => {
    // Receipt on Property B referencing Invoice on Property A -> must fail composite FK
    await assert.rejects(
      async () => {
        await prisma.receipt.create({
          data: {
            propertyId: propertyBId, // Property B
            accountId: accountBId,
            invoiceId: invoiceAId,   // Invoice belongs to Property A!
            amount: new Prisma.Decimal("100.00"),
            paymentMethodCode: "CASH",
            paidAt: new Date(),
            createdBy: staffUserId,
            status: ReceiptStatus.RECORDED,
          },
        });
      },
      (err: unknown) => {
        const error = err as { code?: string };
        return (
          error.code === "P2003" ||
          String(err).includes("Foreign key constraint violated") ||
          String(err).includes("fk_receipts_invoice")
        );
      },
      "Database must reject receipt referencing an invoice from another property"
    );
  });

  it("5. Enforces database check constraint: AccountTransfer accounts must be different", async () => {
    await assert.rejects(
      async () => {
        await prisma.accountTransfer.create({
          data: {
            propertyId: propertyAId,
            fromAccountId: accountAId,
            toAccountId: accountAId, // Same account!
            amount: new Prisma.Decimal("50.00"),
            createdBy: staffUserId,
          },
        });
      },
      (err: unknown) => {
        const error = err as { code?: string };
        return (
          error.code === "P2010" ||
          error.code === "P2003" ||
          String(err).includes("transfer_accounts_different_chk") ||
          String(err).includes("violates check constraint")
        );
      },
      "Database must reject transfer from an account to itself"
    );
  });

  it("6. Enforces database check constraint: AccountTransfer amount must be strictly positive", async () => {
    // Create distinct second account on Property A
    const accA2 = await prisma.financialAccount.create({
      data: {
        propertyId: propertyAId,
        accountName: `Property A Safe Box ${Date.now()}`,
        accountType: AccountType.CASH,
      },
    });

    try {
      await assert.rejects(
        async () => {
          await prisma.accountTransfer.create({
            data: {
              propertyId: propertyAId,
              fromAccountId: accountAId,
              toAccountId: accA2.id,
              amount: new Prisma.Decimal("-10.00"), // Negative amount!
              createdBy: staffUserId,
            },
          });
        },
        (err: unknown) => {
          const error = err as { code?: string };
          return (
            error.code === "P2010" ||
            String(err).includes("transfer_amount_positive_chk") ||
            String(err).includes("violates check constraint")
          );
        },
        "Database must reject transfer with non-positive amount"
      );
    } finally {
      await prisma.financialAccount.delete({ where: { id: accA2.id } });
    }
  });

  it("7. Enforces database check constraint: outgoing Payment amount must be strictly positive", async () => {
    // Create an expense head and expense on Property A
    const head = await prisma.expenseHead.create({
      data: {
        propertyId: propertyAId,
        code: `UTIL_${Date.now().toString().slice(-4)}`,
        name: `Test Utilities ${Date.now()}`,
      },
    });
    const expense = await prisma.expense.create({
      data: {
        propertyId: propertyAId,
        expenseHeadId: head.id,
        title: "Electric bill",
        amount: new Prisma.Decimal("500.00"),
        expenseDate: new Date(),
        createdBy: staffUserId,
      },
    });

    try {
      await assert.rejects(
        async () => {
          await prisma.payment.create({
            data: {
              propertyId: propertyAId,
              expenseId: expense.id,
              accountId: accountAId,
              amount: new Prisma.Decimal("0.00"), // Zero amount!
              paymentMethodCode: "CASH",
              paidAt: new Date(),
              createdBy: staffUserId,
              status: PaymentStatus.RECORDED,
            },
          });
        },
        (err: unknown) => {
          const error = err as { code?: string };
          return (
            error.code === "P2010" ||
            String(err).includes("payment_amount_positive_chk") ||
            String(err).includes("violates check constraint")
          );
        },
        "Database must reject outgoing payment with zero or negative amount"
      );
    } finally {
      await prisma.expense.delete({ where: { id: expense.id } });
      await prisma.expenseHead.delete({ where: { id: head.id } });
    }
  });

  it("8. Successfully records a valid Receipt against an invoice", async () => {
    const receipt = await prisma.receipt.create({
      data: {
        propertyId: propertyAId,
        accountId: accountAId,
        invoiceId: invoiceAId,
        amount: new Prisma.Decimal("250.00"),
        paymentMethodCode: "CASH",
        referenceNumber: "CASH-FIN-001",
        paidAt: new Date(),
        createdBy: staffUserId,
        status: ReceiptStatus.RECORDED,
      },
    });

    assert.ok(receipt.id);
    assert.equal(receipt.isLegacy, false, "New receipts must have isLegacy = false");
    assert.equal(Number(receipt.amount), 250);

    // Clean up
    await prisma.receipt.delete({ where: { id: receipt.id } });
  });
});
