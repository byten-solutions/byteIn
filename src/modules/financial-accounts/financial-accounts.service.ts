import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { sanitizePagination } from "@/lib/pagination";
import {
  AccountType,
  TransferStatus,
  type FinancialAccountDTO,
  type FinancialAccountWithBalanceDTO,
  type CreateFinancialAccountInput,
  type UpdateFinancialAccountInput,
  type CreateAccountTransferInput,
  type AccountTransferDTO,
  type AccountStatementDTO,
  type AccountStatementItemDTO,
} from "./financial-accounts.types";

interface RawAccountWithBalance {
  id: string;
  property_id: string;
  account_name: string;
  account_type: AccountType;
  opening_balance: string;
  opening_balance_date: string;
  is_default: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  total_receipts: string;
  total_payments: string;
  total_transfers_in: string;
  total_transfers_out: string;
  current_balance: string;
}

export class FinancialAccountService {
  /**
   * List all accounts for a property with live derived balances.
   * Balances strictly observe openingBalanceDate: transactions prior to openingBalanceDate are excluded.
   */
  static async getAccounts(
    propertyId: string,
    filters?: { accountType?: AccountType; isActive?: boolean }
  ): Promise<FinancialAccountWithBalanceDTO[]> {
    const rawAccounts = await prisma.$queryRawUnsafe<RawAccountWithBalance[]>(
      `
      SELECT 
        fa.id,
        fa.property_id,
        fa.account_name,
        fa.account_type,
        fa.opening_balance::text,
        fa.opening_balance_date::text,
        fa.is_default,
        fa.is_active,
        fa.created_at,
        fa.updated_at,
        COALESCE(r.total_receipts, 0)::text AS total_receipts,
        COALESCE(p.total_payments, 0)::text AS total_payments,
        COALESCE(ti.total_transfers_in, 0)::text AS total_transfers_in,
        COALESCE(to_out.total_transfers_out, 0)::text AS total_transfers_out,
        (fa.opening_balance + COALESCE(r.total_receipts, 0) - COALESCE(p.total_payments, 0) + COALESCE(ti.total_transfers_in, 0) - COALESCE(to_out.total_transfers_out, 0))::text AS current_balance
      FROM financial_accounts fa
      LEFT JOIN (
        SELECT r_inner.account_id, SUM(r_inner.amount) AS total_receipts
        FROM receipts r_inner
        JOIN financial_accounts fa_r ON fa_r.id = r_inner.account_id
        WHERE r_inner.property_id = $1 
          AND r_inner.status = 'RECORDED'
          AND r_inner.paid_at >= fa_r.opening_balance_date
        GROUP BY r_inner.account_id
      ) r ON r.account_id = fa.id
      LEFT JOIN (
        SELECT p_inner.account_id, SUM(p_inner.amount) AS total_payments
        FROM payments p_inner
        JOIN financial_accounts fa_p ON fa_p.id = p_inner.account_id
        WHERE p_inner.property_id = $1 
          AND p_inner.status = 'RECORDED'
          AND p_inner.paid_at >= fa_p.opening_balance_date
        GROUP BY p_inner.account_id
      ) p ON p.account_id = fa.id
      LEFT JOIN (
        SELECT ti_inner.to_account_id, SUM(ti_inner.amount) AS total_transfers_in
        FROM account_transfers ti_inner
        JOIN financial_accounts fa_ti ON fa_ti.id = ti_inner.to_account_id
        WHERE ti_inner.property_id = $1 
          AND ti_inner.status = 'COMPLETED'
          AND ti_inner.transfer_date >= fa_ti.opening_balance_date
        GROUP BY ti_inner.to_account_id
      ) ti ON ti.to_account_id = fa.id
      LEFT JOIN (
        SELECT to_inner.from_account_id, SUM(to_inner.amount) AS total_transfers_out
        FROM account_transfers to_inner
        JOIN financial_accounts fa_to ON fa_to.id = to_inner.from_account_id
        WHERE to_inner.property_id = $1 
          AND to_inner.status = 'COMPLETED'
          AND to_inner.transfer_date >= fa_to.opening_balance_date
        GROUP BY to_inner.from_account_id
      ) to_out ON to_out.from_account_id = fa.id
      WHERE fa.property_id = $1
        AND ($2::text IS NULL OR fa.account_type::text = $2)
        AND ($3::boolean IS NULL OR fa.is_active = $3)
      ORDER BY fa.is_default DESC, fa.account_name ASC;
      `,
      propertyId,
      filters?.accountType ?? null,
      filters?.isActive !== undefined ? filters.isActive : null
    );

    return rawAccounts.map((a) => ({
      id: a.id,
      propertyId: a.property_id,
      accountName: a.account_name,
      accountType: a.account_type,
      openingBalance: Number(a.opening_balance).toFixed(2),
      openingBalanceDate: a.opening_balance_date,
      isDefault: a.is_default,
      isActive: a.is_active,
      createdAt: a.created_at.toISOString(),
      updatedAt: a.updated_at.toISOString(),
      totalReceipts: Number(a.total_receipts).toFixed(2),
      totalPayments: Number(a.total_payments).toFixed(2),
      totalTransfersIn: Number(a.total_transfers_in).toFixed(2),
      totalTransfersOut: Number(a.total_transfers_out).toFixed(2),
      currentBalance: Number(a.current_balance).toFixed(2),
    }));
  }

  /**
   * Get an account by ID with its live derived balance breakdown.
   */
  static async getAccountById(
    propertyId: string,
    accountId: string
  ): Promise<FinancialAccountWithBalanceDTO> {
    const accounts = await this.getAccounts(propertyId);
    const found = accounts.find((a) => a.id === accountId);
    if (!found) {
      throw new NotFoundError(`Financial account with ID '${accountId}' not found.`);
    }
    return found;
  }

  /**
   * Create a new financial account.
   * Atomically manages default flag: if new account isDefault=true, resets previous defaults.
   */
  static async createAccount(
    propertyId: string,
    input: CreateFinancialAccountInput,
    userId: string
  ): Promise<FinancialAccountDTO> {
    const trimmedName = input.accountName.trim();

    // Check duplicate name on property
    const existingName = await prisma.financialAccount.findUnique({
      where: {
        propertyId_accountName: {
          propertyId,
          accountName: trimmedName,
        },
      },
    });
    if (existingName) {
      throw new ConflictError(
        `An account named '${trimmedName}' already exists for this property.`
      );
    }

    const openingBalance = new Prisma.Decimal(input.openingBalance ?? 0);
    const openingBalanceDate = input.openingBalanceDate
      ? new Date(input.openingBalanceDate)
      : new Date();

    return prisma.$transaction(async (tx) => {
      // Check if property has any accounts yet
      const existingCount = await tx.financialAccount.count({
        where: { propertyId },
      });

      // If this is the first account, it should automatically be default unless explicitly false
      const shouldBeDefault = input.isDefault ?? existingCount === 0;

      if (shouldBeDefault) {
        // Reset any existing defaults on this property
        await tx.financialAccount.updateMany({
          where: { propertyId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const account = await tx.financialAccount.create({
        data: {
          propertyId,
          accountName: trimmedName,
          accountType: input.accountType ?? AccountType.CASH,
          openingBalance,
          openingBalanceDate,
          isDefault: shouldBeDefault,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: "FINANCIAL_ACCOUNT",
          entityId: account.id,
          action: "CREATE_ACCOUNT",
          newData: {
            propertyId,
            accountName: account.accountName,
            accountType: account.accountType,
            openingBalance: account.openingBalance.toString(),
            openingBalanceDate: account.openingBalanceDate,
            isDefault: account.isDefault,
          },
        },
      });

      return {
        id: account.id,
        propertyId: account.propertyId,
        accountName: account.accountName,
        accountType: account.accountType,
        openingBalance: account.openingBalance.toFixed(2),
        openingBalanceDate: account.openingBalanceDate.toISOString().slice(0, 10),
        isDefault: account.isDefault,
        isActive: account.isActive,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Update an existing financial account.
   * Enforces lifecycle invariants:
   * - Cannot rename or deactivate the Legacy Receipts clearing account.
   * - Property must retain at least one active account.
   * - A default account cannot be deactivated without setting another active account as default first.
   * - Setting isDefault=true atomically clears other defaults on the property.
   */
  static async updateAccount(
    propertyId: string,
    accountId: string,
    input: UpdateFinancialAccountInput,
    userId: string
  ): Promise<FinancialAccountDTO> {
    const existing = await prisma.financialAccount.findFirst({
      where: { id: accountId, propertyId },
    });
    if (!existing) {
      throw new NotFoundError(`Financial account with ID '${accountId}' not found.`);
    }

    // Protection for legacy clearing account
    if (existing.accountName === "Legacy Receipts – Unallocated") {
      if (
        (input.accountName && input.accountName.trim() !== existing.accountName) ||
        input.isActive === false
      ) {
        throw new BadRequestError(
          "The 'Legacy Receipts – Unallocated' clearing account cannot be renamed or deactivated."
        );
      }
    }

    let trimmedName = existing.accountName;
    if (input.accountName && input.accountName.trim() !== existing.accountName) {
      trimmedName = input.accountName.trim();
      const duplicate = await prisma.financialAccount.findUnique({
        where: {
          propertyId_accountName: {
            propertyId,
            accountName: trimmedName,
          },
        },
      });
      if (duplicate && duplicate.id !== accountId) {
        throw new ConflictError(
          `An account named '${trimmedName}' already exists for this property.`
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      // Lifecycle check 1: Deactivating the default account
      if (input.isActive === false && (existing.isDefault || input.isDefault === true)) {
        throw new BadRequestError(
          "Cannot deactivate the default account. Assign another active account as default before deactivating this one."
        );
      }

      // Lifecycle check 2: Minimum one active account
      if (input.isActive === false && existing.isActive) {
        const activeCount = await tx.financialAccount.count({
          where: { propertyId, isActive: true },
        });
        if (activeCount <= 1) {
          throw new BadRequestError(
            "A property must retain at least one active financial account."
          );
        }
      }

      // Lifecycle check 3: Setting isDefault=true
      if (input.isDefault === true) {
        if (input.isActive === false || (!existing.isActive && input.isActive !== true)) {
          throw new BadRequestError("Cannot set an inactive account as default.");
        }
        await tx.financialAccount.updateMany({
          where: { propertyId, isDefault: true, id: { not: accountId } },
          data: { isDefault: false },
        });
      }

      const updated = await tx.financialAccount.update({
        where: { id: accountId },
        data: {
          ...(input.accountName && { accountName: trimmedName }),
          ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: "FINANCIAL_ACCOUNT",
          entityId: accountId,
          action: "UPDATE_ACCOUNT",
          oldData: {
            accountName: existing.accountName,
            isDefault: existing.isDefault,
            isActive: existing.isActive,
          },
          newData: {
            accountName: updated.accountName,
            isDefault: updated.isDefault,
            isActive: updated.isActive,
          },
        },
      });

      return {
        id: updated.id,
        propertyId: updated.propertyId,
        accountName: updated.accountName,
        accountType: updated.accountType,
        openingBalance: updated.openingBalance.toFixed(2),
        openingBalanceDate: updated.openingBalanceDate.toISOString().slice(0, 10),
        isDefault: updated.isDefault,
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Delete a financial account.
   * Throws friendly domain error if account contains transaction history or is the default account.
   */
  static async deleteAccount(
    propertyId: string,
    accountId: string,
    userId: string
  ): Promise<{ success: true; message: string }> {
    const existing = await prisma.financialAccount.findFirst({
      where: { id: accountId, propertyId },
      include: {
        _count: {
          select: {
            receipts: true,
            payments: true,
            transfersFrom: true,
            transfersTo: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError(`Financial account with ID '${accountId}' not found.`);
    }

    if (existing.accountName === "Legacy Receipts – Unallocated") {
      throw new BadRequestError("The legacy clearing account cannot be deleted.");
    }

    const totalTx =
      existing._count.receipts +
      existing._count.payments +
      existing._count.transfersFrom +
      existing._count.transfersTo;

    if (totalTx > 0) {
      throw new BadRequestError(
        `Cannot delete account '${existing.accountName}' because it has ${totalTx} recorded transaction(s). Deactivate the account instead.`
      );
    }

    if (existing.isDefault) {
      throw new BadRequestError(
        "Cannot delete the default account. Assign another active account as default first."
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.financialAccount.delete({
        where: { id: accountId },
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: "FINANCIAL_ACCOUNT",
          entityId: accountId,
          action: "DELETE_ACCOUNT",
          oldData: {
            accountName: existing.accountName,
            accountType: existing.accountType,
          },
        },
      });
    });

    return { success: true, message: `Account '${existing.accountName}' successfully deleted.` };
  }

  /**
   * Get an itemized statement ledger for an account.
   * Strictly observes openingBalanceDate: any transaction prior to openingBalanceDate is excluded.
   */
  static async getAccountStatement(
    propertyId: string,
    accountId: string,
    query?: { startDate?: string; endDate?: string; limit?: number }
  ): Promise<AccountStatementDTO> {
    const account = await this.getAccountById(propertyId, accountId);

    const openDateStr = account.openingBalanceDate;
    const requestedStart = query?.startDate || openDateStr;
    const effectiveStart = requestedStart < openDateStr ? openDateStr : requestedStart;
    const effectiveEnd = query?.endDate || new Date().toISOString().slice(0, 10);
    const limit = query?.limit || 100;

    const startDateObj = new Date(effectiveStart);
    const endDateObj = new Date(`${effectiveEnd}T23:59:59.999Z`);
    const openDateObj = new Date(openDateStr);

    // 1. Calculate opening balance as of effectiveStart
    let openingOnStart = new Prisma.Decimal(account.openingBalance);

    if (effectiveStart > openDateStr) {
      // Add transactions between openDate and effectiveStart
      const preStartReceipts = await prisma.receipt.aggregate({
        where: {
          propertyId,
          accountId,
          status: "RECORDED",
          paidAt: { gte: openDateObj, lt: startDateObj },
        },
        _sum: { amount: true },
      });
      const preStartPayments = await prisma.payment.aggregate({
        where: {
          propertyId,
          accountId,
          status: "RECORDED",
          paidAt: { gte: openDateObj, lt: startDateObj },
        },
        _sum: { amount: true },
      });
      const preStartTransIn = await prisma.accountTransfer.aggregate({
        where: {
          propertyId,
          toAccountId: accountId,
          status: "COMPLETED",
          transferDate: { gte: openDateObj, lt: startDateObj },
        },
        _sum: { amount: true },
      });
      const preStartTransOut = await prisma.accountTransfer.aggregate({
        where: {
          propertyId,
          fromAccountId: accountId,
          status: "COMPLETED",
          transferDate: { gte: openDateObj, lt: startDateObj },
        },
        _sum: { amount: true },
      });

      openingOnStart = openingOnStart
        .add(preStartReceipts._sum.amount || 0)
        .sub(preStartPayments._sum.amount || 0)
        .add(preStartTransIn._sum.amount || 0)
        .sub(preStartTransOut._sum.amount || 0);
    }

    // 2. Fetch receipts, payments, and transfers in statement window
    const [receipts, payments, transfersIn, transfersOut] = await Promise.all([
      prisma.receipt.findMany({
        where: {
          propertyId,
          accountId,
          status: "RECORDED",
          paidAt: { gte: startDateObj, lte: endDateObj },
        },
        orderBy: { paidAt: "asc" },
        take: limit,
      }),
      prisma.payment.findMany({
        where: {
          propertyId,
          accountId,
          status: "RECORDED",
          paidAt: { gte: startDateObj, lte: endDateObj },
        },
        include: { expense: { select: { title: true } } },
        orderBy: { paidAt: "asc" },
        take: limit,
      }),
      prisma.accountTransfer.findMany({
        where: {
          propertyId,
          toAccountId: accountId,
          status: "COMPLETED",
          transferDate: { gte: startDateObj, lte: endDateObj },
        },
        include: { fromAccount: { select: { accountName: true } } },
        orderBy: { transferDate: "asc" },
        take: limit,
      }),
      prisma.accountTransfer.findMany({
        where: {
          propertyId,
          fromAccountId: accountId,
          status: "COMPLETED",
          transferDate: { gte: startDateObj, lte: endDateObj },
        },
        include: { toAccount: { select: { accountName: true } } },
        orderBy: { transferDate: "asc" },
        take: limit,
      }),
    ]);

    // 3. Merge and sort statement entries chronologically
    interface RawTimelineItem {
      id: string;
      date: Date;
      type: AccountStatementItemDTO["type"];
      referenceNumber: string | null;
      description: string;
      amount: Prisma.Decimal;
      isDebit: boolean;
    }

    const rawTimeline: RawTimelineItem[] = [];

    for (const r of receipts) {
      rawTimeline.push({
        id: r.id,
        date: r.paidAt,
        type: "RECEIPT",
        referenceNumber: r.referenceNumber,
        description: r.invoiceId ? "Invoice Payment" : "Direct Income",
        amount: r.amount,
        isDebit: false,
      });
    }

    for (const p of payments) {
      rawTimeline.push({
        id: p.id,
        date: p.paidAt,
        type: "PAYMENT",
        referenceNumber: p.referenceNumber,
        description: p.expense?.title || "Expense Disbursement",
        amount: p.amount,
        isDebit: true,
      });
    }

    for (const ti of transfersIn) {
      rawTimeline.push({
        id: ti.id,
        date: ti.transferDate,
        type: "TRANSFER_IN",
        referenceNumber: ti.referenceNumber,
        description: `Transfer in from ${ti.fromAccount.accountName}${ti.description ? `: ${ti.description}` : ""}`,
        amount: ti.amount,
        isDebit: false,
      });
    }

    for (const to of transfersOut) {
      rawTimeline.push({
        id: to.id,
        date: to.transferDate,
        type: "TRANSFER_OUT",
        referenceNumber: to.referenceNumber,
        description: `Transfer out to ${to.toAccount.accountName}${to.description ? `: ${to.description}` : ""}`,
        amount: to.amount,
        isDebit: true,
      });
    }

    rawTimeline.sort((a, b) => a.date.getTime() - b.date.getTime());

    // 4. Compute running balance
    let running = openingOnStart;
    const items: AccountStatementItemDTO[] = [];

    for (const item of rawTimeline) {
      if (item.isDebit) {
        running = running.sub(item.amount);
      } else {
        running = running.add(item.amount);
      }

      items.push({
        id: item.id,
        date: item.date.toISOString(),
        type: item.type,
        referenceNumber: item.referenceNumber,
        description: item.description,
        debit: item.isDebit ? item.amount.toFixed(2) : null,
        credit: !item.isDebit ? item.amount.toFixed(2) : null,
        runningBalance: running.toFixed(2),
      });
    }

    return {
      account,
      startDate: effectiveStart,
      endDate: effectiveEnd,
      openingBalanceOnStartDate: openingOnStart.toFixed(2),
      closingBalance: running.toFixed(2),
      items,
    };
  }

  /**
   * Calculate the live derived balance of a financial account inside a locked transaction.
   * Strictly respects openingBalanceDate, recorded receipts, outgoing payments, and completed transfers.
   */
  static async getLockedAccountBalance(
    propertyId: string,
    accountId: string,
    tx: Prisma.TransactionClient
  ): Promise<Prisma.Decimal> {
    const balanceRes = await tx.$queryRawUnsafe<{ current_balance: string }[]>(
      `
      SELECT (
        fa.opening_balance +
        COALESCE((
          SELECT SUM(r.amount) 
          FROM receipts r 
          WHERE r.account_id = fa.id 
            AND r.property_id = fa.property_id 
            AND r.status = 'RECORDED' 
            AND r.paid_at >= fa.opening_balance_date
        ), 0) -
        COALESCE((
          SELECT SUM(p.amount) 
          FROM payments p 
          WHERE p.account_id = fa.id 
            AND p.property_id = fa.property_id 
            AND p.status = 'RECORDED' 
            AND p.paid_at >= fa.opening_balance_date
        ), 0) +
        COALESCE((
          SELECT SUM(ti.amount) 
          FROM account_transfers ti 
          WHERE ti.to_account_id = fa.id 
            AND ti.property_id = fa.property_id 
            AND ti.status = 'COMPLETED' 
            AND ti.transfer_date >= fa.opening_balance_date
        ), 0) -
        COALESCE((
          SELECT SUM(to_out.amount) 
          FROM account_transfers to_out 
          WHERE to_out.from_account_id = fa.id 
            AND to_out.property_id = fa.property_id 
            AND to_out.status = 'COMPLETED' 
            AND to_out.transfer_date >= fa.opening_balance_date
        ), 0)
      )::text AS current_balance
      FROM financial_accounts fa
      WHERE fa.id = $1 AND fa.property_id = $2;
      `,
      accountId,
      propertyId
    );

    return new Prisma.Decimal(balanceRes[0]?.current_balance || "0");
  }

  /**
   * Execute an atomic liquidity transfer between two accounts on the same property.
   * Concurrency Safe:
   * - Locks source and destination accounts with SELECT FOR UPDATE.
   * - Verifies live available balance inside the transaction to prevent concurrent overspending.
   * - Verifies both accounts are active and belong to propertyId.
   */
  static async createTransfer(
    propertyId: string,
    input: CreateAccountTransferInput,
    userId: string
  ): Promise<AccountTransferDTO> {
    if (input.fromAccountId === input.toAccountId) {
      throw new BadRequestError("Source and destination accounts must be different.");
    }

    const transferAmount = new Prisma.Decimal(input.amount);
    if (transferAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestError("Transfer amount must be strictly greater than zero.");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Acquire row-level locks on both accounts to serialize concurrent transfers
      const lockedAccounts = await tx.$queryRawUnsafe<
        { id: string; property_id: string; is_active: boolean; account_type: AccountType; account_name: string }[]
      >(
        `
        SELECT id, property_id, is_active, account_type, account_name 
        FROM financial_accounts 
        WHERE id IN ($1, $2) AND property_id = $3
        FOR UPDATE;
        `,
        input.fromAccountId,
        input.toAccountId,
        propertyId
      );

      if (lockedAccounts.length < 2) {
        throw new NotFoundError(
          "One or both accounts were not found or belong to another hotel."
        );
      }

      const fromAccount = lockedAccounts.find((a) => a.id === input.fromAccountId)!;
      const toAccount = lockedAccounts.find((a) => a.id === input.toAccountId)!;

      if (!fromAccount.is_active || !toAccount.is_active) {
        throw new BadRequestError("Transfers can only be executed between active accounts.");
      }

      if (fromAccount.account_type === "CLEARING" || toAccount.account_type === "CLEARING") {
        throw new BadRequestError("Transfers involving clearing accounts are not permitted.");
      }

      // 2. Compute live derived balance of source account inside the lock
      const availableBalance = await this.getLockedAccountBalance(propertyId, input.fromAccountId, tx);
      if (availableBalance.lessThan(transferAmount)) {
        throw new BadRequestError(
          `Insufficient funds in '${fromAccount.account_name}'. Available: ₹${availableBalance.toFixed(2)}, Requested: ₹${transferAmount.toFixed(2)}.`
        );
      }

      // 3. Create the transfer record
      const transferDate = input.transferDate ? new Date(input.transferDate) : new Date();

      const transfer = await tx.accountTransfer.create({
        data: {
          propertyId,
          fromAccountId: input.fromAccountId,
          toAccountId: input.toAccountId,
          amount: transferAmount,
          transferDate,
          description: input.description?.trim() || null,
          referenceNumber: input.referenceNumber?.trim() || null,
          status: TransferStatus.COMPLETED,
          createdBy: userId,
        },
        include: {
          fromAccount: { select: { accountName: true } },
          toAccount: { select: { accountName: true } },
          creator: { select: { name: true } },
        },
      });

      // 4. Record audit log
      await tx.auditLog.create({
        data: {
          userId,
          entityType: "ACCOUNT_TRANSFER",
          entityId: transfer.id,
          action: "EXECUTE_TRANSFER",
          newData: {
            propertyId,
            fromAccountId: input.fromAccountId,
            toAccountId: input.toAccountId,
            amount: transfer.amount.toString(),
            transferDate: transfer.transferDate,
            referenceNumber: transfer.referenceNumber,
          },
        },
      });

      return {
        id: transfer.id,
        propertyId: transfer.propertyId,
        fromAccountId: transfer.fromAccountId,
        fromAccountName: transfer.fromAccount.accountName,
        toAccountId: transfer.toAccountId,
        toAccountName: transfer.toAccount.accountName,
        amount: transfer.amount.toFixed(2),
        transferDate: transfer.transferDate.toISOString().slice(0, 10),
        description: transfer.description,
        referenceNumber: transfer.referenceNumber,
        status: transfer.status,
        createdBy: transfer.createdBy,
        createdByName: transfer.creator.name,
        createdAt: transfer.createdAt.toISOString(),
      };
    });
  }

  /**
   * List past account transfers with pagination and date range filters.
   */
  static async getTransfers(
    propertyId: string,
    query?: {
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ transfers: AccountTransferDTO[]; total: number; page: number; limit: number }> {
    const { page, limit, skip } = sanitizePagination(query?.page, query?.limit);

    const where: Prisma.AccountTransferWhereInput = {
      propertyId,
      ...(query?.startDate && {
        transferDate: { gte: new Date(query.startDate) },
      }),
      ...(query?.endDate && {
        transferDate: {
          ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
          lte: new Date(`${query.endDate}T23:59:59.999Z`),
        },
      }),
    };

    const [transfers, total] = await Promise.all([
      prisma.accountTransfer.findMany({
        where,
        include: {
          fromAccount: { select: { accountName: true } },
          toAccount: { select: { accountName: true } },
          creator: { select: { name: true } },
        },
        orderBy: { transferDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.accountTransfer.count({ where }),
    ]);

    return {
      transfers: transfers.map((t) => ({
        id: t.id,
        propertyId: t.propertyId,
        fromAccountId: t.fromAccountId,
        fromAccountName: t.fromAccount.accountName,
        toAccountId: t.toAccountId,
        toAccountName: t.toAccount.accountName,
        amount: t.amount.toFixed(2),
        transferDate: t.transferDate.toISOString().slice(0, 10),
        description: t.description,
        referenceNumber: t.referenceNumber,
        status: t.status,
        createdBy: t.createdBy,
        createdByName: t.creator.name,
        createdAt: t.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }
}
