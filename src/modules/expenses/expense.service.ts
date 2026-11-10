import { prisma } from "@/lib/prisma";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { ExpenseStatus, PaymentStatus, Prisma } from "@prisma/client";
import {
  ExpenseDTO,
  ExpenseDetailDTO,
  ExpensePaymentDTO,
  CreateExpenseInput,
  UpdateExpenseInput,
  RecordExpensePaymentInput,
  VoidExpensePaymentInput,
  VoidExpenseInput,
  ExpenseFilterParams,
  ExpenseSummaryMetricsDTO,
} from "./expenses.types";

export class ExpenseService {
  /**
   * Create a new expense record.
   */
  static async createExpense(
    propertyId: string,
    input: CreateExpenseInput,
    userId: string
  ): Promise<ExpenseDTO> {
    const head = await prisma.expenseHead.findFirst({
      where: { id: input.expenseHeadId, propertyId },
    });

    if (!head) {
      throw new BadRequestError("The specified expense category does not exist for this property.");
    }

    if (!head.isActive) {
      throw new BadRequestError("Cannot record expense against an inactive category.");
    }

    const amountDec = new Prisma.Decimal(input.amount.toFixed(2));
    if (amountDec.lessThanOrEqualTo(0)) {
      throw new BadRequestError("Expense amount must be strictly greater than zero.");
    }

    const expenseDateObj = input.expenseDate ? new Date(input.expenseDate) : new Date();

    const expense = await prisma.expense.create({
      data: {
        propertyId,
        expenseHeadId: head.id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        amount: amountDec,
        vendorName: input.vendorName?.trim() || null,
        referenceNumber: input.referenceNumber?.trim() || null,
        expenseDate: expenseDateObj,
        status: ExpenseStatus.PENDING,
        createdBy: userId,
      },
      include: {
        expenseHead: { select: { name: true, code: true } },
        creator: { select: { name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        entityType: "EXPENSE",
        entityId: expense.id,
        action: "CREATE_EXPENSE",
        newData: {
          propertyId,
          title: expense.title,
          amount: expense.amount.toString(),
          expenseDate: expense.expenseDate,
          expenseHeadId: expense.expenseHeadId,
          vendorName: expense.vendorName,
          status: expense.status,
        },
      },
    });

    return this.formatExpense(expense, new Prisma.Decimal(0));
  }

  /**
   * Update an existing expense record.
   * Safeguards:
   * - Cannot edit VOID expense.
   * - Amount cannot be reduced below already paid amount.
   */
  static async updateExpense(
    propertyId: string,
    expenseId: string,
    input: UpdateExpenseInput,
    userId: string
  ): Promise<ExpenseDTO> {
    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, propertyId },
      include: {
        payments: {
          where: { status: PaymentStatus.RECORDED },
          select: { amount: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("Expense record not found");
    }

    if (existing.status === ExpenseStatus.VOID) {
      throw new BadRequestError("Cannot update a voided expense record.");
    }

    const totalPaid = (existing.payments || []).reduce(
      (sum, p) => sum.add(p.amount),
      new Prisma.Decimal(0)
    );

    let newAmountDec: Prisma.Decimal | undefined = undefined;
    if (input.amount !== undefined) {
      newAmountDec = new Prisma.Decimal(input.amount.toFixed(2));
      if (newAmountDec.lessThanOrEqualTo(0)) {
        throw new BadRequestError("Expense amount must be strictly greater than zero.");
      }
      if (newAmountDec.lessThan(totalPaid)) {
        throw new BadRequestError(
          `Expense amount ($${newAmountDec.toFixed(2)}) cannot be less than the already paid amount ($${totalPaid.toFixed(2)}).`
        );
      }
    }

    // Verify category if changed
    if (input.expenseHeadId && input.expenseHeadId !== existing.expenseHeadId) {
      const head = await prisma.expenseHead.findFirst({
        where: { id: input.expenseHeadId, propertyId },
      });
      if (!head) {
        throw new BadRequestError("The specified expense category does not exist for this property.");
      }
      if (!head.isActive) {
        throw new BadRequestError("Cannot change to an inactive category.");
      }
    }

    // Recalculate status if amount changed
    let nextStatus = existing.status;
    if (newAmountDec !== undefined) {
      if (totalPaid.equals(0)) {
        nextStatus = ExpenseStatus.PENDING;
      } else if (totalPaid.greaterThanOrEqualTo(newAmountDec)) {
        nextStatus = ExpenseStatus.PAID;
      } else {
        nextStatus = ExpenseStatus.PARTIALLY_PAID;
      }
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        expenseHeadId: input.expenseHeadId !== undefined ? input.expenseHeadId : undefined,
        title: input.title !== undefined ? input.title.trim() : undefined,
        description: input.description !== undefined ? (input.description?.trim() || null) : undefined,
        amount: newAmountDec !== undefined ? newAmountDec : undefined,
        vendorName: input.vendorName !== undefined ? (input.vendorName?.trim() || null) : undefined,
        referenceNumber: input.referenceNumber !== undefined ? (input.referenceNumber?.trim() || null) : undefined,
        expenseDate: input.expenseDate ? new Date(input.expenseDate) : undefined,
        status: nextStatus,
      },
      include: {
        expenseHead: { select: { name: true, code: true } },
        creator: { select: { name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        entityType: "EXPENSE",
        entityId: updated.id,
        action: "UPDATE_EXPENSE",
        oldData: {
          title: existing.title,
          amount: existing.amount.toString(),
          status: existing.status,
          expenseHeadId: existing.expenseHeadId,
        },
        newData: {
          title: updated.title,
          amount: updated.amount.toString(),
          status: updated.status,
          expenseHeadId: updated.expenseHeadId,
        },
      },
    });

    return this.formatExpense(updated, totalPaid);
  }

  /**
   * Get an expense by ID with full payment history.
   */
  static async getExpenseById(
    propertyId: string,
    expenseId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<ExpenseDetailDTO> {
    const expense = await client.expense.findFirst({
      where: { id: expenseId, propertyId },
      include: {
        expenseHead: { select: { name: true, code: true } },
        creator: { select: { name: true } },
        payments: {
          include: {
            account: { select: { accountName: true } },
            creator: { select: { name: true } },
          },
          orderBy: { paidAt: "asc" },
        },
      },
    });

    if (!expense) {
      throw new NotFoundError("Expense record not found");
    }

    const totalPaid = expense.payments
      .filter((p) => p.status === PaymentStatus.RECORDED)
      .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

    const formattedBase = this.formatExpense(expense, totalPaid);

    const formattedPayments: ExpensePaymentDTO[] = expense.payments.map((p) => ({
      id: p.id,
      propertyId: p.propertyId,
      expenseId: p.expenseId,
      accountId: p.accountId,
      accountName: p.account.accountName,
      paymentMethodId: p.paymentMethodId,
      paymentMethodCode: p.paymentMethodCode,
      amount: p.amount.toFixed(2),
      referenceNumber: p.referenceNumber,
      idempotencyKey: p.idempotencyKey,
      status: p.status,
      paidAt: p.paidAt.toISOString(),
      createdBy: p.createdBy,
      creatorName: p.creator?.name,
      voidReason: p.voidReason,
      voidedAt: p.voidedAt ? p.voidedAt.toISOString() : null,
      voidedBy: p.voidedBy,
      createdAt: p.createdAt.toISOString(),
    }));

    return {
      ...formattedBase,
      payments: formattedPayments,
    };
  }

  /**
   * List and filter expenses for a property.
   */
  static async listExpenses(
    propertyId: string,
    params: ExpenseFilterParams
  ): Promise<{
    expenses: ExpenseDTO[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {
      propertyId,
      ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
      ...(params.expenseHeadId ? { expenseHeadId: params.expenseHeadId } : {}),
      ...(params.startDate || params.endDate
        ? {
            expenseDate: {
              ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
              ...(params.endDate ? { lte: new Date(params.endDate) } : {}),
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { title: { contains: params.search, mode: "insensitive" } },
              { vendorName: { contains: params.search, mode: "insensitive" } },
              { referenceNumber: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        include: {
          expenseHead: { select: { name: true, code: true } },
          creator: { select: { name: true } },
          payments: {
            where: { status: PaymentStatus.RECORDED },
            select: { amount: true },
          },
        },
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
    ]);

    const formattedExpenses = items.map((item) => {
      const totalPaid = item.payments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0)
      );
      return this.formatExpense(item, totalPaid);
    });

    return {
      expenses: formattedExpenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Disburse full or partial payment against an expense.
   * Concurrency & Invariants:
   * - Serializes expense disbursement via `FOR UPDATE` on `expenses`.
   * - Serializes account debit via `FOR UPDATE` on `financial_accounts`.
   * - Validates active status and property tenancy inside the transaction.
   * - Checks that payment amount does not exceed remaining outstanding balance.
   * - Supports exact HTTP idempotency replay: returns original payment on matching retry; rejects mismatched retry.
   */
  static async recordExpensePayment(
    propertyId: string,
    expenseId: string,
    input: RecordExpensePaymentInput,
    userId: string
  ): Promise<{
    payment: ExpensePaymentDTO;
    expense: ExpenseDetailDTO;
    idempotentReplay?: boolean;
  }> {
    return await prisma.$transaction(async (tx) => {
      // 1. Lock the expense row to prevent concurrent overpayments
      await tx.$executeRaw`SELECT id FROM expenses WHERE id = ${expenseId} FOR UPDATE`;

      // 2. Fetch the locked expense
      const expense = await tx.expense.findFirst({
        where: { id: expenseId, propertyId },
        include: {
          payments: {
            where: { status: PaymentStatus.RECORDED },
            select: { amount: true },
          },
        },
      });

      if (!expense) {
        throw new NotFoundError("Expense record not found");
      }

      if (expense.status === ExpenseStatus.VOID) {
        throw new BadRequestError("Cannot disburse payment against a voided expense record.");
      }

      const totalPaid = (expense.payments || []).reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0)
      );

      const remainingBalance = expense.amount.sub(totalPaid);
      if (remainingBalance.lessThanOrEqualTo(0)) {
        throw new BadRequestError("Expense is already fully paid.");
      }

      const paymentAmount = new Prisma.Decimal(input.amount.toFixed(2));
      if (paymentAmount.lessThanOrEqualTo(0)) {
        throw new BadRequestError("Payment amount must be strictly greater than zero.");
      }

      if (paymentAmount.greaterThan(remainingBalance)) {
        throw new BadRequestError(
          `Payment amount ($${paymentAmount.toFixed(2)}) cannot exceed remaining balance ($${remainingBalance.toFixed(2)}).`
        );
      }

      // 3. Lock the financial account row to serialize balance-reducing operations
      await tx.$executeRaw`SELECT id FROM financial_accounts WHERE id = ${input.accountId} FOR UPDATE`;

      // 4. Validate financial account inside transaction
      const account = await tx.financialAccount.findFirst({
        where: { id: input.accountId, propertyId },
      });

      if (!account) {
        throw new BadRequestError("The specified financial account does not exist for this property.");
      }

      if (!account.isActive) {
        throw new BadRequestError("Cannot pay from an inactive financial account.");
      }

      // 5. Validate payment method inside transaction
      let paymentMethodId = input.paymentMethodId;
      let paymentMethodCode = input.paymentMethodCode || "CASH";

      if (paymentMethodId) {
        const pm = await tx.paymentMethod.findFirst({
          where: { id: paymentMethodId, propertyId },
        });
        if (!pm) {
          throw new BadRequestError("The specified payment method does not exist for this property.");
        }
        if (!pm.isActive) {
          throw new BadRequestError("Cannot use an inactive payment method.");
        }
        paymentMethodCode = pm.code;
      } else if (input.paymentMethodCode) {
        const pm = await tx.paymentMethod.findFirst({
          where: { code: input.paymentMethodCode, propertyId },
        });
        if (pm) {
          if (!pm.isActive) {
            throw new BadRequestError("Cannot use an inactive payment method.");
          }
          paymentMethodId = pm.id;
        }
      }

      // 6. Idempotency Key Handling
      if (input.idempotencyKey) {
        const existingPayment = await tx.payment.findUnique({
          where: {
            propertyId_idempotencyKey: {
              propertyId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: {
            account: { select: { accountName: true } },
            creator: { select: { name: true } },
          },
        });

        if (existingPayment) {
          // Verify matching payment details
          const isMatchingRetry =
            existingPayment.expenseId === expenseId &&
            existingPayment.accountId === input.accountId &&
            existingPayment.amount.equals(paymentAmount);

          if (isMatchingRetry) {
            // Return existing payment and state without re-debiting
            const fullDetail = await this.getExpenseById(propertyId, expenseId, tx);
            const formattedExisting: ExpensePaymentDTO = {
              id: existingPayment.id,
              propertyId: existingPayment.propertyId,
              expenseId: existingPayment.expenseId,
              accountId: existingPayment.accountId,
              accountName: existingPayment.account.accountName,
              paymentMethodId: existingPayment.paymentMethodId,
              paymentMethodCode: existingPayment.paymentMethodCode,
              amount: existingPayment.amount.toFixed(2),
              referenceNumber: existingPayment.referenceNumber,
              idempotencyKey: existingPayment.idempotencyKey,
              status: existingPayment.status,
              paidAt: existingPayment.paidAt.toISOString(),
              createdBy: existingPayment.createdBy,
              creatorName: existingPayment.creator?.name,
              voidReason: existingPayment.voidReason,
              voidedAt: existingPayment.voidedAt ? existingPayment.voidedAt.toISOString() : null,
              voidedBy: existingPayment.voidedBy,
              createdAt: existingPayment.createdAt.toISOString(),
            };

            return {
              payment: formattedExisting,
              expense: fullDetail,
              idempotentReplay: true,
            };
          } else {
            throw new BadRequestError(
              "Idempotency key has already been used for a payment with different details."
            );
          }
        }
      }

      // 7. Create the Payment record
      const paidAtDate = input.paidAt ? new Date(input.paidAt) : new Date();

      const payment = await tx.payment.create({
        data: {
          propertyId,
          expenseId,
          accountId: account.id,
          paymentMethodId,
          paymentMethodCode,
          amount: paymentAmount,
          referenceNumber: input.referenceNumber?.trim() || null,
          idempotencyKey: input.idempotencyKey?.trim() || null,
          status: PaymentStatus.RECORDED,
          paidAt: paidAtDate,
          createdBy: userId,
        },
      });

      // 8. Recalculate expense status
      const newTotalPaid = totalPaid.add(paymentAmount);
      let nextStatus: ExpenseStatus = ExpenseStatus.PARTIALLY_PAID;
      if (newTotalPaid.greaterThanOrEqualTo(expense.amount)) {
        nextStatus = ExpenseStatus.PAID;
      }

      await tx.expense.update({
        where: { id: expenseId },
        data: { status: nextStatus },
      });

      // 9. Audit log
      await tx.auditLog.create({
        data: {
          userId,
          entityType: "PAYMENT",
          entityId: payment.id,
          action: "RECORD_EXPENSE_PAYMENT",
          newData: {
            propertyId,
            expenseId,
            accountId: account.id,
            paymentMethodCode,
            amount: payment.amount.toString(),
            idempotencyKey: payment.idempotencyKey,
            status: payment.status,
            paidAt: payment.paidAt,
          },
        },
      });

      const fullDetail = await this.getExpenseById(propertyId, expenseId, tx);

      const formattedPayment: ExpensePaymentDTO = {
        id: payment.id,
        propertyId: payment.propertyId,
        expenseId: payment.expenseId,
        accountId: payment.accountId,
        accountName: account.accountName,
        paymentMethodId: payment.paymentMethodId,
        paymentMethodCode: payment.paymentMethodCode,
        amount: payment.amount.toFixed(2),
        referenceNumber: payment.referenceNumber,
        idempotencyKey: payment.idempotencyKey,
        status: payment.status,
        paidAt: payment.paidAt.toISOString(),
        createdBy: payment.createdBy,
        voidReason: null,
        voidedAt: null,
        voidedBy: null,
        createdAt: payment.createdAt.toISOString(),
      };

      return {
        payment: formattedPayment,
        expense: fullDetail,
      };
    });
  }

  /**
   * Void an individual outgoing payment.
   * Concurrency & Invariants:
   * - Serializes via `FOR UPDATE` on `expenses` and `financial_accounts`.
   * - Marks payment `VOIDED` with mandatory `voidReason`.
   * - Reverses financial account balance deduction immediately.
   * - Recalculates expense status dynamically (e.g. PAID -> PARTIALLY_PAID or PENDING).
   */
  static async voidExpensePayment(
    propertyId: string,
    expenseId: string,
    paymentId: string,
    input: VoidExpensePaymentInput,
    userId: string
  ): Promise<ExpenseDetailDTO> {
    return await prisma.$transaction(async (tx) => {
      // 1. Lock expense row
      await tx.$executeRaw`SELECT id FROM expenses WHERE id = ${expenseId} FOR UPDATE`;

      const expense = await tx.expense.findFirst({
        where: { id: expenseId, propertyId },
      });

      if (!expense) {
        throw new NotFoundError("Expense record not found");
      }

      const payment = await tx.payment.findFirst({
        where: { id: paymentId, expenseId, propertyId },
      });

      if (!payment) {
        throw new NotFoundError("Payment record not found for this expense");
      }

      if (payment.status === PaymentStatus.VOIDED) {
        throw new BadRequestError("This payment record has already been voided.");
      }

      // 2. Lock financial account row (funds are being returned to the account)
      await tx.$executeRaw`SELECT id FROM financial_accounts WHERE id = ${payment.accountId} FOR UPDATE`;

      // 3. Mark payment as VOIDED
      const voidedAt = new Date();
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.VOIDED,
          voidReason: input.voidReason.trim(),
          voidedAt,
          voidedBy: userId,
        },
      });

      // 4. Recalculate remaining active payments
      const remainingPayments = await tx.payment.findMany({
        where: {
          expenseId,
          propertyId,
          status: PaymentStatus.RECORDED,
        },
        select: { amount: true },
      });

      const remainingPaid = remainingPayments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0)
      );

      let nextStatus: ExpenseStatus = ExpenseStatus.PENDING;
      if (remainingPaid.greaterThanOrEqualTo(expense.amount)) {
        nextStatus = ExpenseStatus.PAID;
      } else if (remainingPaid.greaterThan(0)) {
        nextStatus = ExpenseStatus.PARTIALLY_PAID;
      }

      await tx.expense.update({
        where: { id: expenseId },
        data: { status: nextStatus },
      });

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          userId,
          entityType: "PAYMENT",
          entityId: payment.id,
          action: "VOID_EXPENSE_PAYMENT",
          oldData: { status: PaymentStatus.RECORDED },
          newData: {
            status: PaymentStatus.VOIDED,
            voidReason: input.voidReason.trim(),
            voidedAt,
            voidedBy: userId,
          },
        },
      });

      return await this.getExpenseById(propertyId, expenseId, tx);
    });
  }

  /**
   * Void an expense record.
   * Concurrency & Invariants:
   * - Controlled two-stage voiding: strictly rejects voiding if active payments exist.
   * - Requires mandatory `voidReason`.
   */
  static async voidExpense(
    propertyId: string,
    expenseId: string,
    input: VoidExpenseInput,
    userId: string
  ): Promise<ExpenseDetailDTO> {
    return await prisma.$transaction(async (tx) => {
      // 1. Lock expense row
      await tx.$executeRaw`SELECT id FROM expenses WHERE id = ${expenseId} FOR UPDATE`;

      const expense = await tx.expense.findFirst({
        where: { id: expenseId, propertyId },
      });

      if (!expense) {
        throw new NotFoundError("Expense record not found");
      }

      if (expense.status === ExpenseStatus.VOID) {
        throw new BadRequestError("This expense record has already been voided.");
      }

      // 2. Reject if any active payments exist
      const activePaymentsCount = await tx.payment.count({
        where: {
          expenseId,
          propertyId,
          status: PaymentStatus.RECORDED,
        },
      });

      if (activePaymentsCount > 0) {
        throw new BadRequestError(
          "Cannot void expense with active payments. Please void each outgoing payment individually first to reverse the account balance."
        );
      }

      // 3. Mark expense as VOID
      const voidedAt = new Date();
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: ExpenseStatus.VOID,
          voidReason: input.voidReason.trim(),
          voidedAt,
          voidedBy: userId,
        },
      });

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          userId,
          entityType: "EXPENSE",
          entityId: expense.id,
          action: "VOID_EXPENSE",
          oldData: { status: expense.status },
          newData: {
            status: ExpenseStatus.VOID,
            voidReason: input.voidReason.trim(),
            voidedAt,
            voidedBy: userId,
          },
        },
      });

      return await this.getExpenseById(propertyId, expenseId, tx);
    });
  }

  /**
   * Get summary metrics for the expense tab cards.
   */
  static async getExpenseSummaryMetrics(
    propertyId: string,
    params: Omit<ExpenseFilterParams, "page" | "limit">
  ): Promise<ExpenseSummaryMetricsDTO> {
    const where: Prisma.ExpenseWhereInput = {
      propertyId,
      ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
      ...(params.expenseHeadId ? { expenseHeadId: params.expenseHeadId } : {}),
      ...(params.startDate || params.endDate
        ? {
            expenseDate: {
              ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
              ...(params.endDate ? { lte: new Date(params.endDate) } : {}),
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { title: { contains: params.search, mode: "insensitive" } },
              { vendorName: { contains: params.search, mode: "insensitive" } },
              { referenceNumber: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const expenses = await prisma.expense.findMany({
      where,
      select: {
        id: true,
        amount: true,
        status: true,
        payments: {
          where: { status: PaymentStatus.RECORDED },
          select: { amount: true },
        },
      },
    });

    let totalIncurred = new Prisma.Decimal(0);
    let totalPaid = new Prisma.Decimal(0);
    let totalOutstanding = new Prisma.Decimal(0);

    let paidCount = 0;
    let pendingCount = 0;
    let voidCount = 0;

    for (const exp of expenses) {
      if (exp.status === ExpenseStatus.VOID) {
        voidCount++;
        continue; // VOID expenses do not contribute to financial totals
      }

      totalIncurred = totalIncurred.add(exp.amount);

      const paidForExp = exp.payments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0)
      );

      totalPaid = totalPaid.add(paidForExp);

      const outstandingForExp = Prisma.Decimal.max(0, exp.amount.sub(paidForExp));
      totalOutstanding = totalOutstanding.add(outstandingForExp);

      if (exp.status === ExpenseStatus.PAID) {
        paidCount++;
      } else {
        pendingCount++;
      }
    }

    return {
      totalIncurred: totalIncurred.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2),
      expenseCount: expenses.length,
      paidCount,
      pendingCount,
      voidCount,
    };
  }

  private static formatExpense(
    expense: {
      id: string;
      propertyId: string;
      expenseHeadId: string;
      title: string;
      description: string | null;
      amount: Prisma.Decimal;
      vendorName: string | null;
      referenceNumber: string | null;
      expenseDate: Date;
      status: ExpenseStatus;
      createdBy: string;
      voidReason: string | null;
      voidedAt: Date | null;
      voidedBy: string | null;
      createdAt: Date;
      updatedAt: Date;
      expenseHead?: { name: string; code: string };
      creator?: { name: string } | null;
    },
    totalPaid: Prisma.Decimal
  ): ExpenseDTO {
    const outstanding = Prisma.Decimal.max(0, expense.amount.sub(totalPaid));

    return {
      id: expense.id,
      propertyId: expense.propertyId,
      expenseHeadId: expense.expenseHeadId,
      categoryName: expense.expenseHead?.name || "Unknown",
      categoryCode: expense.expenseHead?.code || "UNKNOWN",
      title: expense.title,
      description: expense.description,
      amount: expense.amount.toFixed(2),
      paidAmount: totalPaid.toFixed(2),
      outstandingAmount: outstanding.toFixed(2),
      vendorName: expense.vendorName,
      referenceNumber: expense.referenceNumber,
      expenseDate: expense.expenseDate.toISOString().split("T")[0],
      status: expense.status,
      createdBy: expense.createdBy,
      creatorName: expense.creator?.name,
      voidReason: expense.voidReason,
      voidedAt: expense.voidedAt ? expense.voidedAt.toISOString() : null,
      voidedBy: expense.voidedBy,
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
    };
  }
}
