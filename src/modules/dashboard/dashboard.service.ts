import { prisma } from "@/lib/prisma";
import { Prisma, RoomStatus, ReservationStatus, ReceiptStatus } from "@prisma/client";
import { FinancialAccountService } from "@/modules/financial-accounts/financial-accounts.service";
import { HOTEL_TIMEZONE } from "@/config/hotel";
import { getHotelTodayDate, getHotelDateBoundaryUtc, addDaysToYmd } from "@/lib/date";
import { NotFoundError } from "@/lib/errors";

export * from "./dashboard.types";

export interface HotelDashboardStats {
  total: number;
  clean: number;
  dirty: number;
  occupied: number;
  maintenance: number;
  outOfService: number;
  confirmedReservations: number;
}

export interface AdminDashboardMetrics {
  totalRooms: number;
  occupiedRooms: number;
  occupancyRate: number;
  cleanRooms: number;
  dirtyRooms: number;
  maintenanceRooms: number;
  todayCollections: string;
  todayOutgoingPayments: string;
  liquidBalance: string;
  cashOnHand: string;
  bankBalance: string;
  outstandingReceivables: string;
  recordedExpensesThisMonth: string;
  pendingPayables: string;
}

export interface PlatformPropertyOverview {
  id: string;
  name: string;
  status: string;
  address: string | null;
  city: string | null;
  country: string | null;
  _count: {
    rooms: number;
    users: number;
    buildings: number;
  };
  cleanRooms: number;
  occupiedRooms: number;
}

export interface PlatformDashboardStats {
  properties: PlatformPropertyOverview[];
  totalRooms: number;
  activeHotels: number;
  totalUsers: number;
  totalConfirmedRes: number;
  totalRevenue: number; // Gross Platform Revenue (Invoiced + Realized Direct Income)
  platformCollections: number; // Actual cash/bank receipts realized across platform
}

export class DashboardService {
  /**
   * Retrieves dashboard statistics for a single hotel (or platform-wide if no propertyId).
   */
  static async getHotelStats(propertyId?: string): Promise<HotelDashboardStats> {
    const [roomGroups, confirmedRes] = await Promise.all([
      prisma.room.groupBy({
        by: ["status"],
        where: propertyId ? { propertyId } : undefined,
        _count: { _all: true },
      }),
      prisma.reservation.count({
        where: {
          status: ReservationStatus.CONFIRMED,
          ...(propertyId ? { propertyId } : {}),
        },
      }),
    ]);

    let clean = 0;
    let dirty = 0;
    let occupied = 0;
    let maintenance = 0;
    let outOfService = 0;
    let total = 0;

    for (const group of roomGroups) {
      const c = group._count._all;
      total += c;
      if (group.status === RoomStatus.VACANT_CLEAN) clean = c;
      else if (group.status === RoomStatus.VACANT_DIRTY) dirty = c;
      else if (group.status === RoomStatus.OCCUPIED) occupied = c;
      else if (group.status === RoomStatus.MAINTENANCE) maintenance = c;
      else if (group.status === RoomStatus.OUT_OF_SERVICE) outOfService = c;
    }

    return {
      total,
      clean,
      dirty,
      occupied,
      maintenance,
      outOfService,
      confirmedReservations: confirmedRes,
    };
  }

  /**
   * Retrieves curated operational and financial metrics for hotel administration.
   * Enforces strict distinction between recognized revenue, actual receipts,
   * recorded expenses, and actual outgoing payments.
   */
  static async getAdminDashboardMetrics(propertyId: string): Promise<AdminDashboardMetrics> {
    const todayStr = getHotelTodayDate();
    const monthStartStr = `${todayStr.slice(0, 7)}-01`;

    const [roomStats, accounts, activityRows, receivablesRows, expensesRows] = await Promise.all([
      this.getHotelStats(propertyId),
      FinancialAccountService.getAccounts(propertyId, { isActive: true }),
      prisma.$queryRaw<Array<{ today_collections: string; today_payments: string }>>`
        SELECT
          COALESCE((
            SELECT SUM(amount)
            FROM receipts
            WHERE property_id = ${propertyId}
              AND status = 'RECORDED'
              AND paid_at >= ((${todayStr} || ' 00:00:00')::timestamp AT TIME ZONE ${HOTEL_TIMEZONE} AT TIME ZONE 'UTC')
              AND paid_at < ((to_char(${todayStr}::date + 1, 'YYYY-MM-DD') || ' 00:00:00')::timestamp AT TIME ZONE ${HOTEL_TIMEZONE} AT TIME ZONE 'UTC')
          ), 0)::text as today_collections,
          COALESCE((
            SELECT SUM(amount)
            FROM payments
            WHERE property_id = ${propertyId}
              AND status = 'RECORDED'
              AND paid_at AT TIME ZONE 'UTC' >= ((${todayStr} || ' 00:00:00')::timestamp AT TIME ZONE ${HOTEL_TIMEZONE} AT TIME ZONE 'UTC')
              AND paid_at AT TIME ZONE 'UTC' < ((to_char(${todayStr}::date + 1, 'YYYY-MM-DD') || ' 00:00:00')::timestamp AT TIME ZONE ${HOTEL_TIMEZONE} AT TIME ZONE 'UTC')
          ), 0)::text as today_payments;
      `,
      prisma.$queryRaw<Array<{ total_receivables: string }>>`
        WITH unpaid_inv AS (
          SELECT
            (i.grand_total - COALESCE(p.paid, 0)) AS balance_due
          FROM invoices i
          LEFT JOIN LATERAL (
            SELECT SUM(amount) AS paid 
            FROM receipts 
            WHERE invoice_id = i.id
              AND status = 'RECORDED'
          ) p ON true
          WHERE i.property_id = ${propertyId}
            AND i.status <> 'VOID'
        )
        SELECT COALESCE(SUM(balance_due) FILTER (WHERE balance_due > 0), 0)::text AS total_receivables
        FROM unpaid_inv;
      `,
      prisma.$queryRaw<Array<{ recorded_expenses_this_month: string; pending_payables: string }>>`
        SELECT
          COALESCE((
            SELECT SUM(e.amount)
            FROM expenses e
            WHERE e.property_id = ${propertyId}
              AND e.status <> 'VOID'
              AND e.expense_date AT TIME ZONE 'UTC' >= ((${monthStartStr} || ' 00:00:00')::timestamp AT TIME ZONE ${HOTEL_TIMEZONE} AT TIME ZONE 'UTC')
              AND e.expense_date AT TIME ZONE 'UTC' < ((to_char(${todayStr}::date + 1, 'YYYY-MM-DD') || ' 00:00:00')::timestamp AT TIME ZONE ${HOTEL_TIMEZONE} AT TIME ZONE 'UTC')
          ), 0)::text as recorded_expenses_this_month,
          COALESCE((
            SELECT SUM(e.amount - COALESCE(p.paid, 0))
            FROM expenses e
            LEFT JOIN LATERAL (
              SELECT SUM(amount) as paid
              FROM payments
              WHERE expense_id = e.id
                AND status = 'RECORDED'
            ) p ON true
            WHERE e.property_id = ${propertyId}
              AND e.status IN ('PENDING', 'PARTIALLY_PAID')
          ), 0)::text as pending_payables;
      `,
    ]);

    let cashDec = new Prisma.Decimal(0);
    let bankDec = new Prisma.Decimal(0);

    // Eligible active liquid accounts strictly include CASH and BANK types
    for (const acc of accounts) {
      const b = new Prisma.Decimal(acc.currentBalance || 0);
      if (acc.accountType === "CASH") {
        cashDec = cashDec.add(b);
      } else if (acc.accountType === "BANK") {
        bankDec = bankDec.add(b);
      }
    }
    const liquidDec = cashDec.add(bankDec);

    const totalRooms = roomStats.total;
    const occupiedRooms = roomStats.occupied;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    return {
      totalRooms,
      occupiedRooms,
      occupancyRate,
      cleanRooms: roomStats.clean,
      dirtyRooms: roomStats.dirty,
      maintenanceRooms: roomStats.maintenance + roomStats.outOfService,
      todayCollections: new Prisma.Decimal(activityRows[0]?.today_collections || 0).toFixed(2),
      todayOutgoingPayments: new Prisma.Decimal(activityRows[0]?.today_payments || 0).toFixed(2),
      liquidBalance: liquidDec.toFixed(2),
      cashOnHand: cashDec.toFixed(2),
      bankBalance: bankDec.toFixed(2),
      outstandingReceivables: new Prisma.Decimal(receivablesRows[0]?.total_receivables || 0).toFixed(2),
      recordedExpensesThisMonth: new Prisma.Decimal(expensesRows[0]?.recorded_expenses_this_month || 0).toFixed(2),
      pendingPayables: new Prisma.Decimal(expensesRows[0]?.pending_payables || 0).toFixed(2),
    };
  }

  /**
   * Retrieves aggregated platform statistics for Super Admin.
   * Avoids loading room records into memory by grouping by (propertyId, status).
   * Clearly distinguishes Gross Platform Revenue (Invoiced + Realized Direct Income)
   * from Actual Platform Collections (Realized receipts).
   */
  static async getPlatformStats(): Promise<PlatformDashboardStats> {
    const [
      rawProperties,
      roomGroups,
      totalUsers,
      totalConfirmedRes,
      invoiceAgg,
      directIncomeReceiptsAgg,
      allReceiptsAgg,
    ] = await Promise.all([
      prisma.property.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          address: true,
          city: true,
          country: true,
          _count: {
            select: {
              rooms: true,
              users: true,
              buildings: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.room.groupBy({
        by: ["propertyId", "status"],
        _count: { _all: true },
      }),
      prisma.user.count({
        where: { status: "ACTIVE" },
      }),
      prisma.reservation.count({
        where: { status: ReservationStatus.CONFIRMED },
      }),
      prisma.invoice.aggregate({
        where: { status: { not: "VOID" } },
        _sum: { grandTotal: true },
      }),
      prisma.receipt.aggregate({
        where: { status: ReceiptStatus.RECORDED, incomeId: { not: null } },
        _sum: { amount: true },
      }),
      prisma.receipt.aggregate({
        where: { status: ReceiptStatus.RECORDED },
        _sum: { amount: true },
      }),
    ]);

    const propertyRoomCounts = new Map<string, { clean: number; occupied: number }>();
    for (const rg of roomGroups) {
      const existing = propertyRoomCounts.get(rg.propertyId) || { clean: 0, occupied: 0 };
      if (rg.status === RoomStatus.VACANT_CLEAN) {
        existing.clean += rg._count._all;
      } else if (rg.status === RoomStatus.OCCUPIED) {
        existing.occupied += rg._count._all;
      }
      propertyRoomCounts.set(rg.propertyId, existing);
    }

    const properties: PlatformPropertyOverview[] = rawProperties.map((p) => {
      const counts = propertyRoomCounts.get(p.id) || { clean: 0, occupied: 0 };
      return {
        ...p,
        cleanRooms: counts.clean,
        occupiedRooms: counts.occupied,
      };
    });

    const totalRooms = properties.reduce((acc, p) => acc + p._count.rooms, 0);
    const activeHotels = properties.filter((p) => p.status === "ACTIVE").length;

    // Gross Platform Revenue = Invoiced Revenue on non-void invoices + Realized Direct Income
    const invoicedRevenue = invoiceAgg._sum.grandTotal ? new Prisma.Decimal(invoiceAgg._sum.grandTotal) : new Prisma.Decimal(0);
    const realizedDirectIncome = directIncomeReceiptsAgg._sum.amount ? new Prisma.Decimal(directIncomeReceiptsAgg._sum.amount) : new Prisma.Decimal(0);
    const totalRevenue = invoicedRevenue.add(realizedDirectIncome).toNumber();

    // Actual Platform Collections = All realized receipts
    const platformCollections = allReceiptsAgg._sum.amount ? Number(allReceiptsAgg._sum.amount) : 0;

    return {
      properties,
      totalRooms,
      activeHotels,
      totalUsers,
      totalConfirmedRes,
      totalRevenue,
      platformCollections,
    };
  }

  /**
   * Retrieves chronological financial activity timeline and period aggregates for hotel administration.
   *
   * Invariants:
   * 1. Money In = Receipts paid in period - Receipt reversals in period.
   * 2. Money Out = Payments paid in period - Payment reversals in period.
   * 3. Net Movement = Money In - Money Out (unclamped).
   * 4. Internal transfers are neutral and excluded from Money In, Money Out, and Net Movement.
   * 5. Historical voids: A voided receipt or payment appears on its original paidAt, followed by a separate reversal event on its voidedAt.
   * 6. AccountTransfer.transferDate is @db.Date; marked as isDateOnly without invented times.
   * 7. Summary aggregates are calculated over the FULL period, never truncated by preview limit.
   */
  static async getFinancialActivity(
    propertyId: string,
    options?: {
      date?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<import("./dashboard.types").FinancialActivityDTO> {
    const today = getHotelTodayDate();
    const startDate = options?.startDate || options?.date || today;
    const endDate = options?.endDate || options?.date || today;
    const limit = options?.limit ?? 25;

    const startUtc = getHotelDateBoundaryUtc(startDate);
    const endUtc = getHotelDateBoundaryUtc(addDaysToYmd(endDate, 1));

    // transferDate is @db.Date, mapped by Prisma to UTC midnight
    const transferStart = new Date(`${startDate}T00:00:00.000Z`);
    const transferEnd = new Date(`${endDate}T00:00:00.000Z`);

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true },
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    const [paidReceipts, voidedReceipts, paidPayments, voidedPayments, completedTransfers] =
      await Promise.all([
        // 1. Receipts paid in period (both RECORDED and VOIDED)
        prisma.receipt.findMany({
          where: {
            propertyId,
            paidAt: { gte: startUtc, lt: endUtc },
          },
          include: {
            account: { select: { accountName: true, accountType: true } },
            paymentMethod: { select: { name: true, code: true } },
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                customerName: true,
                customer: { select: { firstName: true, lastName: true } },
              },
            },
            income: {
              select: {
                id: true,
                title: true,
                description: true,
                incomeHead: { select: { name: true } },
              },
            },
          },
        }),
        // 2. Receipt reversals voided in period
        prisma.receipt.findMany({
          where: {
            propertyId,
            status: "VOIDED",
            voidedAt: { gte: startUtc, lt: endUtc },
          },
          include: {
            account: { select: { accountName: true, accountType: true } },
            paymentMethod: { select: { name: true, code: true } },
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                customerName: true,
                customer: { select: { firstName: true, lastName: true } },
              },
            },
            income: {
              select: {
                id: true,
                title: true,
                description: true,
                incomeHead: { select: { name: true } },
              },
            },
          },
        }),
        // 3. Payments paid in period (both RECORDED and VOIDED)
        prisma.payment.findMany({
          where: {
            propertyId,
            paidAt: { gte: startUtc, lt: endUtc },
          },
          include: {
            account: { select: { accountName: true, accountType: true } },
            paymentMethod: { select: { name: true, code: true } },
            expense: {
              select: {
                id: true,
                vendorName: true,
                description: true,
                expenseHead: { select: { name: true } },
              },
            },
          },
        }),
        // 4. Payment reversals voided in period
        prisma.payment.findMany({
          where: {
            propertyId,
            status: "VOIDED",
            voidedAt: { gte: startUtc, lt: endUtc },
          },
          include: {
            account: { select: { accountName: true, accountType: true } },
            paymentMethod: { select: { name: true, code: true } },
            expense: {
              select: {
                id: true,
                vendorName: true,
                description: true,
                expenseHead: { select: { name: true } },
              },
            },
          },
        }),
        // 5. Account transfers completed in period
        prisma.accountTransfer.findMany({
          where: {
            propertyId,
            status: "COMPLETED",
            transferDate: { gte: transferStart, lte: transferEnd },
          },
          include: {
            fromAccount: { select: { accountName: true, accountType: true } },
            toAccount: { select: { accountName: true, accountType: true } },
          },
        }),
      ]);

    const events: import("./dashboard.types").FinancialTimelineEvent[] = [];
    const propertyParam = propertyId ? `&propertyId=${encodeURIComponent(propertyId)}` : "";

    // Map original receipts (both RECORDED and historically VOIDED)
    for (const r of paidReceipts) {
      const custName = r.invoice?.customer
        ? `${r.invoice.customer.firstName} ${r.invoice.customer.lastName || ""}`.trim()
        : r.invoice?.customerName;
      const desc = r.invoice
        ? (custName ? `${r.invoice.invoiceNumber} • ${custName}` : r.invoice.invoiceNumber)
        : (r.income?.description || r.income?.title || undefined);

      const title = r.invoice
        ? "Guest Payment"
        : (r.income?.incomeHead?.name || "Direct Income");

      const invoiceId = r.invoiceId || r.invoice?.id || undefined;
      const incomeId = r.incomeId || r.income?.id || undefined;

      let targetUrl: string | undefined;
      if (invoiceId) {
        targetUrl = `/billing/${encodeURIComponent(invoiceId)}`;
      } else if (incomeId) {
        targetUrl = `/finance?tab=income&incomeId=${encodeURIComponent(incomeId)}${propertyParam}`;
      }

      events.push({
        id: r.id,
        originalId: r.id,
        eventType: "RECEIPT",
        direction: "IN",
        amount: r.amount.toFixed(2),
        timestamp: r.paidAt.toISOString(),
        isDateOnly: false,
        title,
        description: desc,
        accountName: r.account.accountName,
        accountType: r.account.accountType,
        paymentMethodCode: r.paymentMethodCode,
        paymentMethodName: r.paymentMethod?.name || r.paymentMethodCode,
        referenceNumber: r.referenceNumber || undefined,
        isVoidedOrReversal: r.status === "VOIDED",
        voidReason: r.voidReason || undefined,
        invoiceId,
        incomeId,
        targetUrl,
      });
    }

    // Map receipt reversals on voidedAt
    for (const r of voidedReceipts) {
      const custName = r.invoice?.customer
        ? `${r.invoice.customer.firstName} ${r.invoice.customer.lastName || ""}`.trim()
        : r.invoice?.customerName;
      const targetDesc = r.invoice
        ? (custName ? `${r.invoice.invoiceNumber} • ${custName}` : r.invoice.invoiceNumber)
        : (r.income?.description || r.income?.title || undefined);

      const invoiceId = r.invoiceId || r.invoice?.id || undefined;
      const incomeId = r.incomeId || r.income?.id || undefined;

      let targetUrl: string | undefined;
      if (invoiceId) {
        targetUrl = `/billing/${encodeURIComponent(invoiceId)}`;
      } else if (incomeId) {
        targetUrl = `/finance?tab=income&incomeId=${encodeURIComponent(incomeId)}${propertyParam}`;
      }

      events.push({
        id: `rev-rcpt-${r.id}`,
        originalId: r.id,
        eventType: "RECEIPT_REVERSAL",
        direction: "OUT",
        amount: r.amount.toFixed(2),
        timestamp: (r.voidedAt ?? r.paidAt).toISOString(),
        isDateOnly: false,
        title: `Void Reversal: ${r.invoice ? "Guest Payment" : (r.income?.incomeHead?.name || "Direct Income")}`,
        description: r.voidReason
          ? `Reason: ${r.voidReason}${targetDesc ? ` (${targetDesc})` : ""}`
          : targetDesc,
        accountName: r.account.accountName,
        accountType: r.account.accountType,
        paymentMethodCode: r.paymentMethodCode,
        paymentMethodName: r.paymentMethod?.name || r.paymentMethodCode,
        referenceNumber: r.referenceNumber || undefined,
        isVoidedOrReversal: true,
        voidReason: r.voidReason || undefined,
        invoiceId,
        incomeId,
        targetUrl,
      });
    }

    // Map original payments (both RECORDED and historically VOIDED)
    for (const p of paidPayments) {
      const headName = p.expense?.expenseHead?.name || "Expense Payment";
      const desc = p.expense?.vendorName
        ? `${p.expense.vendorName}${p.expense.description ? ` • ${p.expense.description}` : ""}`
        : (p.expense?.description || undefined);

      const expenseId = p.expenseId || p.expense?.id || undefined;
      const targetUrl = expenseId
        ? `/finance?tab=expenses&expenseId=${encodeURIComponent(expenseId)}${propertyParam}`
        : undefined;

      events.push({
        id: p.id,
        originalId: p.id,
        eventType: "PAYMENT",
        direction: "OUT",
        amount: p.amount.toFixed(2),
        timestamp: p.paidAt.toISOString(),
        isDateOnly: false,
        title: headName,
        description: desc,
        accountName: p.account.accountName,
        accountType: p.account.accountType,
        paymentMethodCode: p.paymentMethodCode,
        paymentMethodName: p.paymentMethod?.name || p.paymentMethodCode,
        referenceNumber: p.referenceNumber || undefined,
        isVoidedOrReversal: p.status === "VOIDED",
        voidReason: p.voidReason || undefined,
        expenseId,
        targetUrl,
      });
    }

    // Map payment reversals on voidedAt
    for (const p of voidedPayments) {
      const headName = p.expense?.expenseHead?.name || "Expense Payment";
      const desc = p.expense?.vendorName || p.expense?.description || undefined;

      const expenseId = p.expenseId || p.expense?.id || undefined;
      const targetUrl = expenseId
        ? `/finance?tab=expenses&expenseId=${encodeURIComponent(expenseId)}${propertyParam}`
        : undefined;

      events.push({
        id: `rev-pmt-${p.id}`,
        originalId: p.id,
        eventType: "PAYMENT_REVERSAL",
        direction: "IN",
        amount: p.amount.toFixed(2),
        timestamp: (p.voidedAt ?? p.paidAt).toISOString(),
        isDateOnly: false,
        title: `Void Reversal: ${headName}`,
        description: p.voidReason
          ? `Reason: ${p.voidReason}${desc ? ` (${desc})` : ""}`
          : desc,
        accountName: p.account.accountName,
        accountType: p.account.accountType,
        paymentMethodCode: p.paymentMethodCode,
        paymentMethodName: p.paymentMethod?.name || p.paymentMethodCode,
        referenceNumber: p.referenceNumber || undefined,
        isVoidedOrReversal: true,
        voidReason: p.voidReason || undefined,
        expenseId,
        targetUrl,
      });
    }

    // Map account transfers on transferDate (date-only)
    for (const t of completedTransfers) {
      const transferId = t.id || undefined;
      const targetUrl = transferId
        ? `/finance?tab=transfers&transferId=${encodeURIComponent(transferId)}${propertyParam}`
        : undefined;

      events.push({
        id: t.id,
        originalId: t.id,
        eventType: "TRANSFER",
        direction: "TRANSFER",
        amount: t.amount.toFixed(2),
        timestamp: t.transferDate.toISOString().slice(0, 10),
        isDateOnly: true,
        title: "Internal Transfer",
        description: t.description || `${t.fromAccount.accountName} → ${t.toAccount.accountName}`,
        accountName: t.fromAccount.accountName,
        accountType: t.fromAccount.accountType,
        counterAccountName: t.toAccount.accountName,
        referenceNumber: t.referenceNumber || undefined,
        isVoidedOrReversal: false,
        transferId,
        targetUrl,
      });
    }

    // Calculate full-period summary aggregates without truncating
    let grossReceipts = new Prisma.Decimal(0);
    for (const r of paidReceipts) {
      grossReceipts = grossReceipts.add(r.amount);
    }

    let receiptReversals = new Prisma.Decimal(0);
    for (const r of voidedReceipts) {
      receiptReversals = receiptReversals.add(r.amount);
    }

    let grossPayments = new Prisma.Decimal(0);
    for (const p of paidPayments) {
      grossPayments = grossPayments.add(p.amount);
    }

    let paymentReversals = new Prisma.Decimal(0);
    for (const p of voidedPayments) {
      paymentReversals = paymentReversals.add(p.amount);
    }

    let transfersTotal = new Prisma.Decimal(0);
    for (const t of completedTransfers) {
      transfersTotal = transfersTotal.add(t.amount);
    }

    const moneyIn = grossReceipts.sub(receiptReversals);
    const moneyOut = grossPayments.sub(paymentReversals);
    const netMovement = moneyIn.sub(moneyOut);

    // Sort timeline chronologically descending (newest first)
    // with deterministic tie-breaking by id
    events.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return b.id.localeCompare(a.id);
    });

    const totalEventsCount = events.length;
    const timeline = events.slice(0, limit);
    const hasMore = totalEventsCount > limit;

    return {
      startDate,
      endDate,
      propertyId,
      propertyName: property.name,
      summary: {
        moneyIn: moneyIn.toFixed(2),
        moneyOut: moneyOut.toFixed(2),
        netMovement: netMovement.toFixed(2),
        transfersTotal: transfersTotal.toFixed(2),
        totalReceiptsCount: paidReceipts.length,
        totalPaymentsCount: paidPayments.length,
        totalTransfersCount: completedTransfers.length,
        totalReversalsCount: voidedReceipts.length + voidedPayments.length,
      },
      timeline,
      totalEventsCount,
      hasMore,
    };
  }
}
