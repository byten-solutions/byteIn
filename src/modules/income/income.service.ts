import { prisma } from "@/lib/prisma";
import { Prisma, IncomeStatus, ReceiptStatus } from "@prisma/client";
import { NotFoundError, BadRequestError } from "@/lib/errors";
import type {
  IncomeDTO,
  IncomeDetailDTO,
  IncomeReceiptDTO,
  CreateIncomeInput,
  UpdateIncomeInput,
  VoidIncomeInput,
  RecordIncomeReceiptInput,
  VoidIncomeReceiptInput,
  IncomeFilterParams,
} from "./income.types";

export class IncomeService {
  /**
   * Helper to format an income entity into an IncomeDTO with derived financials.
   */
  private static formatIncome(
    income: {
      id: string;
      propertyId: string;
      incomeHeadId: string;
      title: string;
      description: string | null;
      expectedAmount: Prisma.Decimal | string | number;
      incomeDate: Date;
      status: IncomeStatus;
      createdBy: string;
      voidReason?: string | null;
      voidedAt?: Date | null;
      voidedBy?: string | null;
      createdAt: Date;
      updatedAt: Date;
      incomeHead?: { name: string; code: string };
      creator?: { name: string | null } | null;
      voider?: { name: string | null } | null;
      receipts?: Array<{ amount: Prisma.Decimal | string | number }>;
      _count?: { receipts: number };
    },
    totalReceivedOverride?: Prisma.Decimal
  ): IncomeDTO {
    const expectedDec = new Prisma.Decimal(income.expectedAmount);

    let receivedDec = new Prisma.Decimal(0);
    if (totalReceivedOverride !== undefined) {
      receivedDec = totalReceivedOverride;
    } else if (income.receipts && income.receipts.length > 0) {
      receivedDec = income.receipts.reduce(
        (sum, r) => sum.add(new Prisma.Decimal(r.amount)),
        new Prisma.Decimal(0)
      );
    }

    const outstandingDec = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      expectedDec.sub(receivedDec)
    );

    const incomeDateStr = income.incomeDate instanceof Date
      ? income.incomeDate.toISOString().slice(0, 10)
      : String(income.incomeDate).slice(0, 10);

    return {
      id: income.id,
      propertyId: income.propertyId,
      incomeHeadId: income.incomeHeadId,
      incomeHeadName: income.incomeHead?.name || "Direct Income",
      incomeHeadCode: income.incomeHead?.code || "INCOME",
      title: income.title,
      description: income.description,
      expectedAmount: expectedDec.toFixed(2),
      receivedAmount: receivedDec.toFixed(2),
      outstandingAmount: outstandingDec.toFixed(2),
      incomeDate: incomeDateStr,
      status: income.status,
      createdBy: income.createdBy,
      createdByName: income.creator?.name || undefined,
      receiptCount: income._count?.receipts ?? (income.receipts?.length || 0),
      voidReason: income.voidReason || null,
      voidedAt: income.voidedAt ? income.voidedAt.toISOString() : null,
      voidedBy: income.voidedBy || null,
      voidedByName: income.voider?.name || undefined,
      createdAt: income.createdAt.toISOString(),
      updatedAt: income.updatedAt.toISOString(),
    };
  }

  /**
   * List direct incomes for a property with filters, pagination, and derived amounts.
   */
  static async getIncomes(
    propertyId: string,
    filters?: IncomeFilterParams
  ): Promise<{ incomes: IncomeDTO[]; total: number; page: number; limit: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.IncomeWhereInput = {
      propertyId,
      ...(filters?.incomeHeadId ? { incomeHeadId: filters.incomeHeadId } : {}),
      ...(filters?.status && filters.status !== "ALL"
        ? { status: filters.status as IncomeStatus }
        : {}),
      ...(filters?.search
        ? {
            title: {
              contains: filters.search.trim(),
              mode: "insensitive",
            },
          }
        : {}),
    };

    if (filters?.startDate || filters?.endDate) {
      where.incomeDate = {
        ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
        ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
      };
    }

    const [total, records] = await Promise.all([
      prisma.income.count({ where }),
      prisma.income.findMany({
        where,
        include: {
          incomeHead: { select: { name: true, code: true } },
          creator: { select: { name: true } },
          voider: { select: { name: true } },
          receipts: {
            where: { status: ReceiptStatus.RECORDED },
            select: { amount: true },
          },
          _count: {
            select: { receipts: true },
          },
        },
        orderBy: { incomeDate: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const incomes = records.map((r) => this.formatIncome(r));

    return {
      incomes,
      total,
      page,
      limit,
    };
  }

  /**
   * Get direct income details including chronological itemized receipts.
   */
  static async getIncomeById(
    propertyId: string,
    incomeId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<IncomeDetailDTO> {
    const income = await client.income.findFirst({
      where: { id: incomeId, propertyId },
      include: {
        incomeHead: { select: { name: true, code: true } },
        creator: { select: { name: true } },
        voider: { select: { name: true } },
        _count: { select: { receipts: true } },
        receipts: {
          include: {
            account: { select: { accountName: true } },
            paymentMethod: { select: { name: true, code: true } },
            creator: { select: { name: true } },
            voider: { select: { name: true } },
          },
          orderBy: { paidAt: "desc" },
        },
      },
    });

    if (!income) {
      throw new NotFoundError("Income record not found");
    }

    const activeReceipts = income.receipts.filter(
      (r) => r.status === ReceiptStatus.RECORDED
    );
    const totalReceived = activeReceipts.reduce(
      (sum, r) => sum.add(r.amount),
      new Prisma.Decimal(0)
    );

    const baseDto = this.formatIncome(income, totalReceived);

    const formattedReceipts: IncomeReceiptDTO[] = income.receipts.map((r) => ({
      id: r.id,
      propertyId: r.propertyId,
      incomeId: income.id,
      accountId: r.accountId,
      accountName: r.account.accountName,
      paymentMethodId: r.paymentMethodId,
      paymentMethodCode: r.paymentMethodCode,
      amount: new Prisma.Decimal(r.amount).toFixed(2),
      referenceNumber: r.referenceNumber,
      status: r.status,
      paidAt: r.paidAt.toISOString(),
      createdBy: r.createdBy,
      createdByName: r.creator?.name || undefined,
      voidReason: r.voidReason,
      voidedAt: r.voidedAt ? r.voidedAt.toISOString() : null,
      voidedBy: r.voidedBy,
      voidedByName: r.voider?.name || undefined,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      ...baseDto,
      receipts: formattedReceipts,
    };
  }

  /**
   * Create a new direct income record with initial status PENDING.
   */
  static async createIncome(
    propertyId: string,
    input: CreateIncomeInput,
    userId: string
  ): Promise<IncomeDTO> {
    // 1. Verify category exists, belongs to same property, and is active
    const head = await prisma.incomeHead.findFirst({
      where: { id: input.incomeHeadId, propertyId },
    });

    if (!head) {
      throw new BadRequestError("The specified income category does not exist for this property.");
    }

    if (!head.isActive) {
      throw new BadRequestError("Cannot record income against an inactive category.");
    }

    const expectedAmountDec = new Prisma.Decimal(input.expectedAmount.toFixed(2));
    if (expectedAmountDec.lessThanOrEqualTo(0)) {
      throw new BadRequestError("Expected amount must be strictly greater than zero.");
    }

    const incomeDateObj = input.incomeDate ? new Date(input.incomeDate) : new Date();

    const income = await prisma.income.create({
      data: {
        propertyId,
        incomeHeadId: head.id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        expectedAmount: expectedAmountDec,
        incomeDate: incomeDateObj,
        status: IncomeStatus.PENDING,
        createdBy: userId,
      },
      include: {
        incomeHead: { select: { name: true, code: true } },
        creator: { select: { name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        entityType: "INCOME",
        entityId: income.id,
        action: "CREATE_INCOME",
        newData: {
          propertyId,
          title: income.title,
          expectedAmount: income.expectedAmount.toString(),
          incomeDate: income.incomeDate,
          incomeHeadId: income.incomeHeadId,
          status: income.status,
        },
      },
    });

    return this.formatIncome(income, new Prisma.Decimal(0));
  }

  /**
   * Update an existing direct income record.
   * Safeguards:
   * - Cannot edit VOID income.
   * - Expected amount cannot be reduced below already collected amount.
   */
  static async updateIncome(
    propertyId: string,
    incomeId: string,
    input: UpdateIncomeInput,
    userId: string
  ): Promise<IncomeDTO> {
    const existing = await prisma.income.findFirst({
      where: { id: incomeId, propertyId },
      include: {
        receipts: {
          where: { status: ReceiptStatus.RECORDED },
          select: { amount: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("Income record not found");
    }

    if (existing.status === IncomeStatus.VOID) {
      throw new BadRequestError("Cannot update a voided income record.");
    }

    const totalCollected = (existing.receipts || []).reduce(
      (sum, r) => sum.add(r.amount),
      new Prisma.Decimal(0)
    );

    let newExpectedDec: Prisma.Decimal | undefined = undefined;
    if (input.expectedAmount !== undefined) {
      newExpectedDec = new Prisma.Decimal(input.expectedAmount.toFixed(2));
      if (newExpectedDec.lessThanOrEqualTo(0)) {
        throw new BadRequestError("Expected amount must be strictly greater than zero.");
      }
      if (newExpectedDec.lessThan(totalCollected)) {
        throw new BadRequestError(
          `Expected amount ($${newExpectedDec.toFixed(2)}) cannot be less than the already collected amount ($${totalCollected.toFixed(2)}).`
        );
      }
    }

    // Verify category if updated
    if (input.incomeHeadId && input.incomeHeadId !== existing.incomeHeadId) {
      const head = await prisma.incomeHead.findFirst({
        where: { id: input.incomeHeadId, propertyId },
      });
      if (!head) {
        throw new BadRequestError("The specified income category does not exist for this property.");
      }
      if (!head.isActive) {
        throw new BadRequestError("Cannot change to an inactive category.");
      }
    }

    // Recalculate status if expected amount changed
    let nextStatus = existing.status;
    if (newExpectedDec !== undefined) {
      if (totalCollected.equals(0)) {
        nextStatus = IncomeStatus.PENDING;
      } else if (totalCollected.greaterThanOrEqualTo(newExpectedDec)) {
        nextStatus = IncomeStatus.RECEIVED;
      } else {
        nextStatus = IncomeStatus.PARTIALLY_RECEIVED;
      }
    }

    const updated = await prisma.income.update({
      where: { id: incomeId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.incomeHeadId ? { incomeHeadId: input.incomeHeadId } : {}),
        ...(newExpectedDec !== undefined ? { expectedAmount: newExpectedDec } : {}),
        ...(input.incomeDate ? { incomeDate: new Date(input.incomeDate) } : {}),
        status: nextStatus,
      },
      include: {
        incomeHead: { select: { name: true, code: true } },
        creator: { select: { name: true } },
        voider: { select: { name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        entityType: "INCOME",
        entityId: incomeId,
        action: "UPDATE_INCOME",
        oldData: {
          title: existing.title,
          expectedAmount: existing.expectedAmount.toString(),
          status: existing.status,
        },
        newData: {
          title: updated.title,
          expectedAmount: updated.expectedAmount.toString(),
          status: updated.status,
        },
      },
    });

    return this.formatIncome(updated, totalCollected);
  }

  /**
   * Void a direct income record.
   * Safeguard: Cannot void an income while active recorded receipts exist.
   */
  static async voidIncome(
    propertyId: string,
    incomeId: string,
    input: VoidIncomeInput,
    userId: string
  ): Promise<IncomeDTO> {
    const reason = input.voidReason.trim();
    if (reason.length < 3) {
      throw new BadRequestError("Void reason must be at least 3 characters");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Acquire row lock on income
      await tx.$queryRaw`SELECT "id" FROM "incomes" WHERE "id" = ${incomeId} FOR UPDATE`;

      const income = await tx.income.findFirst({
        where: { id: incomeId, propertyId },
        include: {
          receipts: {
            where: { status: ReceiptStatus.RECORDED },
            select: { id: true, amount: true },
          },
        },
      });

      if (!income) {
        throw new NotFoundError("Income record not found");
      }

      if (income.status === IncomeStatus.VOID) {
        throw new BadRequestError("Income record is already voided.");
      }

      // Safeguard: Reject voiding if active receipts exist
      if (income.receipts && income.receipts.length > 0) {
        throw new BadRequestError(
          `Cannot void income record with active collections (${income.receipts.length} active receipt(s) totaling $${income.receipts
            .reduce((sum, r) => sum.add(r.amount), new Prisma.Decimal(0))
            .toFixed(2)}). Please void all individual receipts first to reverse financial account balances.`
        );
      }

      const now = new Date();
      const updated = await tx.income.update({
        where: { id: incomeId },
        data: {
          status: IncomeStatus.VOID,
          voidReason: reason,
          voidedAt: now,
          voidedBy: userId,
        },
        include: {
          incomeHead: { select: { name: true, code: true } },
          creator: { select: { name: true } },
          voider: { select: { name: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: "INCOME",
          entityId: incomeId,
          action: "VOID_INCOME",
          oldData: {
            status: income.status,
          },
          newData: {
            status: IncomeStatus.VOID,
            voidReason: reason,
            voidedAt: now,
            voidedBy: userId,
          },
        },
      });

      return this.formatIncome(updated, new Prisma.Decimal(0));
    });
  }

  /**
   * Record a full or partial collection receipt against a direct income.
   * Atomic operations:
   * - Row lock on income to serialize concurrent payments.
   * - Re-validates remaining balance.
   * - Validates active destination account and active payment method.
   * - Inserts Receipt with incomeId (and invoiceId = null).
   * - Updates Income.status transactionally to PARTIALLY_RECEIVED or RECEIVED.
   */
  static async recordIncomeReceipt(
    propertyId: string,
    incomeId: string,
    input: RecordIncomeReceiptInput,
    userId: string
  ): Promise<{ income: IncomeDetailDTO; receipt: IncomeReceiptDTO }> {
    const paymentAmount = new Prisma.Decimal(input.amount.toFixed(2));
    if (paymentAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestError("Collection amount must be strictly greater than zero.");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Acquire row lock on income
      await tx.$queryRaw`SELECT "id" FROM "incomes" WHERE "id" = ${incomeId} FOR UPDATE`;

      const income = await tx.income.findFirst({
        where: { id: incomeId, propertyId },
        include: {
          receipts: {
            where: { status: ReceiptStatus.RECORDED },
            select: { amount: true },
          },
        },
      });

      if (!income) {
        throw new NotFoundError("Income record not found");
      }

      if (income.status === IncomeStatus.VOID) {
        throw new BadRequestError("Cannot record collection against a voided income record.");
      }

      const expectedDec = new Prisma.Decimal(income.expectedAmount);
      const existingPaid = (income.receipts || []).reduce(
        (sum, r) => sum.add(r.amount),
        new Prisma.Decimal(0)
      );

      const remainingBalance = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        expectedDec.sub(existingPaid)
      );

      if (remainingBalance.equals(0)) {
        throw new BadRequestError("Income is already fully collected.");
      }

      if (paymentAmount.greaterThan(remainingBalance)) {
        throw new BadRequestError(
          `Collection amount ($${paymentAmount.toFixed(2)}) exceeds remaining outstanding balance of $${remainingBalance.toFixed(2)}`
        );
      }

      // Check idempotency if provided
      if (input.idempotencyKey) {
        const race = await tx.receipt.findUnique({
          where: { idempotencyKey: input.idempotencyKey.trim() },
        });
        if (race) {
          throw new BadRequestError("Duplicate collection submission detected via idempotency key.");
        }
      }

      // 2. Validate target financial account
      const targetAccountId = input.accountId.trim();
      const account = await tx.financialAccount.findFirst({
        where: { id: targetAccountId, propertyId },
        select: { id: true, accountName: true, isActive: true },
      });

      if (!account) {
        throw new BadRequestError(
          "The specified financial account does not exist or belongs to another property."
        );
      }
      if (!account.isActive) {
        throw new BadRequestError("The specified financial account is inactive.");
      }

      // 3. Resolve and validate payment method
      const methodCode = input.paymentMethod.toUpperCase().trim();
      let targetMethodId = input.paymentMethodId?.trim() || null;

      if (targetMethodId) {
        const pm = await tx.paymentMethod.findFirst({
          where: { id: targetMethodId, propertyId },
          select: { id: true, isActive: true, code: true },
        });
        if (!pm) {
          throw new BadRequestError(
            "The specified payment method does not exist or belongs to another property."
          );
        }
        if (!pm.isActive) {
          throw new BadRequestError("The specified payment method is inactive.");
        }
      } else {
        const matchedMethod = await tx.paymentMethod.findFirst({
          where: { propertyId, code: methodCode, isActive: true },
          select: { id: true },
        });
        if (matchedMethod) {
          targetMethodId = matchedMethod.id;
        }
      }

      const now = input.paidAt ? new Date(input.paidAt) : new Date();

      // 4. Create Receipt record strictly linked to incomeId
      const receipt = await tx.receipt.create({
        data: {
          incomeId,
          invoiceId: null, // Strictly enforcing chk_receipts_source_exclusivity
          propertyId,
          amount: paymentAmount,
          accountId: targetAccountId,
          paymentMethodId: targetMethodId || null,
          paymentMethodCode: methodCode,
          referenceNumber: input.referenceNumber?.trim() || null,
          idempotencyKey: input.idempotencyKey?.trim() || null,
          status: ReceiptStatus.RECORDED,
          paidAt: now,
          createdBy: userId,
          isLegacy: false,
        },
      });

      // 5. Compute and update income status transactionally
      const newTotalPaid = existingPaid.add(paymentAmount);
      const newStatus = newTotalPaid.greaterThanOrEqualTo(expectedDec)
        ? IncomeStatus.RECEIVED
        : IncomeStatus.PARTIALLY_RECEIVED;

      await tx.income.update({
        where: { id: incomeId },
        data: {
          status: newStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: "RECEIPT",
          entityId: receipt.id,
          action: "RECORD_INCOME_RECEIPT",
          newData: {
            incomeId,
            propertyId,
            amount: receipt.amount.toString(),
            accountId: receipt.accountId,
            paymentMethodCode: receipt.paymentMethodCode,
            status: receipt.status,
            incomeNewStatus: newStatus,
          },
        },
      });

      // Format response
      const updatedIncomeDetail = await this.getIncomeById(propertyId, incomeId, tx);

      const createdReceiptDto: IncomeReceiptDTO = {
        id: receipt.id,
        propertyId: receipt.propertyId,
        incomeId,
        accountId: receipt.accountId,
        accountName: account.accountName,
        paymentMethodId: receipt.paymentMethodId,
        paymentMethodCode: receipt.paymentMethodCode,
        amount: receipt.amount.toFixed(2),
        referenceNumber: receipt.referenceNumber,
        status: receipt.status,
        paidAt: receipt.paidAt.toISOString(),
        createdBy: receipt.createdBy,
        voidReason: null,
        voidedAt: null,
        voidedBy: null,
        createdAt: receipt.createdAt.toISOString(),
      };

      return {
        income: updatedIncomeDetail,
        receipt: createdReceiptDto,
      };
    });
  }

  /**
   * Void a direct income receipt.
   * Atomic operations:
   * - Row lock on income.
   * - Sets receipt status to VOIDED with mandatory reason.
   * - Automatically reverses financial account balance contribution.
   * - Recalculates remaining active receipts and updates Income.status (RECEIVED -> PARTIALLY_RECEIVED -> PENDING).
   */
  static async voidIncomeReceipt(
    propertyId: string,
    incomeId: string,
    receiptId: string,
    input: VoidIncomeReceiptInput,
    userId: string
  ): Promise<IncomeDetailDTO> {
    const reason = input.voidReason.trim();
    if (reason.length < 3) {
      throw new BadRequestError("Void reason must be at least 3 characters");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Acquire row lock on income
      await tx.$queryRaw`SELECT "id" FROM "incomes" WHERE "id" = ${incomeId} FOR UPDATE`;

      const receipt = await tx.receipt.findFirst({
        where: { id: receiptId, incomeId, propertyId },
      });

      if (!receipt) {
        throw new NotFoundError("Receipt not found for this income record.");
      }

      if (receipt.status === ReceiptStatus.VOIDED) {
        throw new BadRequestError("Receipt is already voided.");
      }

      const now = new Date();

      // 2. Void receipt
      await tx.receipt.update({
        where: { id: receiptId },
        data: {
          status: ReceiptStatus.VOIDED,
          voidReason: reason,
          voidedAt: now,
          voidedBy: userId,
        },
      });

      // 3. Recalculate remaining non-voided receipts on the income
      const activeReceiptsAgg = await tx.receipt.aggregate({
        where: {
          incomeId,
          propertyId,
          status: ReceiptStatus.RECORDED,
        },
        _sum: { amount: true },
      });

      const totalRemaining = activeReceiptsAgg._sum.amount || new Prisma.Decimal(0);

      const income = await tx.income.findUniqueOrThrow({
        where: { id: incomeId },
      });

      let nextStatus: IncomeStatus;
      if (totalRemaining.equals(0)) {
        nextStatus = IncomeStatus.PENDING;
      } else if (totalRemaining.greaterThanOrEqualTo(income.expectedAmount)) {
        nextStatus = IncomeStatus.RECEIVED;
      } else {
        nextStatus = IncomeStatus.PARTIALLY_RECEIVED;
      }

      await tx.income.update({
        where: { id: incomeId },
        data: {
          status: nextStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: "RECEIPT",
          entityId: receiptId,
          action: "VOID_INCOME_RECEIPT",
          oldData: {
            status: receipt.status,
            incomePreviousStatus: income.status,
          },
          newData: {
            status: ReceiptStatus.VOIDED,
            voidReason: reason,
            voidedAt: now,
            voidedBy: userId,
            incomeNewStatus: nextStatus,
          },
        },
      });

      return this.getIncomeById(propertyId, incomeId, tx);
    });
  }
}
