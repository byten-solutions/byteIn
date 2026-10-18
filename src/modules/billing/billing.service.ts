import crypto from "crypto";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  InvoiceStatus,
  InvoiceItemType,
  PaymentStatus,
  RoleName,
  Prisma,
} from "@prisma/client";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { getHotelTodayDate } from "@/lib/date";
import {
  CreateInvoiceInput,
  AddInvoiceItemInput,
  UpdateInvoiceItemInput,
  RecordPaymentInput,
  InvoiceDetailDTO,
  InvoiceListQuery,
  InvoiceListResponse,
  PaymentReceiptDTO,
} from "./billing.types";

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: {
    reservation: {
      include: {
        customer: true;
      };
    };
    items: true;
    payments: {
      include: {
        creator: {
          select: { name: true; role: true };
        };
      };
    };
  };
}>;

export class BillingService {
  /**
   * Generates a unique, collision-resistant human-readable invoice number.
   * Format: INV-YYYYMMDD-XXXX (e.g. INV-20261011-A89F)
   */
  public static generateInvoiceNumber(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const randomHex = crypto.randomBytes(2).toString("hex").toUpperCase();
    return `INV-${yyyy}${mm}${dd}-${randomHex}`;
  }

  /**
   * Invalidation helper for billing summary and invoice counts.
   */
  public static invalidateBillingCache(): void {
    try {
      revalidateTag("billing-summary", "max");
      revalidateTag("invoice-count", "max");
      revalidateTag("daily-operations", "max");
    } catch {
      // Ignore outside Next.js request context (e.g. tests or worker tasks)
    }
  }

  /**
   * Computes table-wide billing summary (totalInvoiced, totalCollected, totalOutstanding)
   * in a single SQL query, cached with tag 'billing-summary'.
   */
  public static async getBillingSummary(propertyId?: string): Promise<{
    totalInvoiced: string;
    totalCollected: string;
    totalOutstanding: string;
  }> {
    const fetchSummary = async () => {
      let rows: Array<{ totalInvoiced: string | null; totalCollected: string | null }>;
      if (propertyId) {
        rows = await prisma.$queryRaw<
          Array<{ totalInvoiced: string | null; totalCollected: string | null }>
        >`
          SELECT
            COALESCE((
              SELECT SUM(inv.grand_total)
              FROM invoices inv
              JOIN reservations r ON inv.reservation_id = r.id
              JOIN reservation_rooms rr ON rr.reservation_id = r.id
              JOIN rooms rm ON rr.room_id = rm.id
              WHERE inv.status != 'VOID' AND rm.property_id = ${propertyId}
            ), 0)::text AS "totalInvoiced",
            COALESCE((
              SELECT SUM(p.amount)
              FROM payments p
              JOIN invoices inv ON p.invoice_id = inv.id
              JOIN reservations r ON inv.reservation_id = r.id
              JOIN reservation_rooms rr ON rr.reservation_id = r.id
              JOIN rooms rm ON rr.room_id = rm.id
              WHERE p.status = 'RECORDED' AND inv.status != 'VOID' AND rm.property_id = ${propertyId}
            ), 0)::text AS "totalCollected"
        `;
      } else {
        rows = await prisma.$queryRaw<
          Array<{ totalInvoiced: string | null; totalCollected: string | null }>
        >`
          SELECT
            COALESCE((SELECT SUM(grand_total) FROM invoices WHERE status != 'VOID'), 0)::text AS "totalInvoiced",
            COALESCE((SELECT SUM(p.amount) FROM payments p JOIN invoices inv ON p.invoice_id = inv.id WHERE p.status = 'RECORDED' AND inv.status != 'VOID'), 0)::text AS "totalCollected"
        `;
      }

      const totalInvoicedDec = new Prisma.Decimal(rows[0]?.totalInvoiced || "0");
      const totalCollectedDec = new Prisma.Decimal(rows[0]?.totalCollected || "0");
      const totalOutstandingDec = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        totalInvoicedDec.sub(totalCollectedDec)
      );

      return {
        totalInvoiced: totalInvoicedDec.toFixed(2),
        totalCollected: totalCollectedDec.toFixed(2),
        totalOutstanding: totalOutstandingDec.toFixed(2),
      };
    };

    if (propertyId) {
      return fetchSummary();
    }

    try {
      const cached = unstable_cache(fetchSummary, ["billing-summary"], {
        tags: ["billing-summary"],
        revalidate: 3600,
      });
      return await cached();
    } catch {
      return fetchSummary();
    }
  }

  /**
   * Cached count for unfiltered invoice list queries.
   */
  public static async getUnfilteredInvoiceCount(): Promise<number> {
    const fetchCount = () => prisma.invoice.count();
    try {
      const cached = unstable_cache(fetchCount, ["invoice-unfiltered-count"], {
        tags: ["invoice-count"],
        revalidate: 60,
      });
      return await cached();
    } catch {
      return fetchCount();
    }
  }

  /**
   * Calculates night count between arrivalDate and departureDate (inclusive arrival, exclusive departure).
   */
  private static calculateNights(arrival: Date, departure: Date): number {
    const arr = new Date(arrival);
    const dep = new Date(departure);
    arr.setHours(0, 0, 0, 0);
    dep.setHours(0, 0, 0, 0);
    const diffTime = dep.getTime() - arr.getTime();
    const nights = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, nights);
  }

  /**
   * Formats a raw Prisma Invoice record into an InvoiceDetailDTO with calculated monetary balances.
   */
  private static formatInvoiceDetail(invoice: InvoiceWithRelations): InvoiceDetailDTO {
    const validPayments = (invoice.payments || []).filter(
      (p) => p.status === PaymentStatus.RECORDED
    );
    const totalPaidDec = validPayments.reduce(
      (sum: Prisma.Decimal, p) => sum.add(p.amount),
      new Prisma.Decimal(0)
    );
    const grandTotalDec = new Prisma.Decimal(invoice.grandTotal);
    const balanceDueDec = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      grandTotalDec.sub(totalPaidDec)
    );

    const customerName = invoice.reservation?.customer
      ? `${invoice.reservation.customer.firstName} ${invoice.reservation.customer.lastName || ""}`.trim()
      : "Guest";

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      reservationId: invoice.reservationId,
      reservationNo: invoice.reservation?.reservationNo || "",
      customerId: invoice.reservation?.customerId || "",
      customerName,
      customerEmail: invoice.reservation?.customer?.email || null,
      customerPhone: invoice.reservation?.customer?.phone || null,
      subtotal: new Prisma.Decimal(invoice.subtotal).toFixed(2),
      discountTotal: new Prisma.Decimal(invoice.discountTotal).toFixed(2),
      taxTotal: new Prisma.Decimal(invoice.taxTotal).toFixed(2),
      grandTotal: grandTotalDec.toFixed(2),
      totalPaid: totalPaidDec.toFixed(2),
      balanceDue: balanceDueDec.toFixed(2),
      status: invoice.status,
      issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : null,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      items: (invoice.items || []).map((item) => ({
        id: item.id,
        invoiceId: item.invoiceId,
        reservationRoomId: item.reservationRoomId,
        description: item.description,
        quantity: new Prisma.Decimal(item.quantity).toFixed(2),
        unitPrice: new Prisma.Decimal(item.unitPrice).toFixed(2),
        lineTotal: new Prisma.Decimal(item.lineTotal).toFixed(2),
        itemType: item.itemType,
        createdAt: item.createdAt.toISOString(),
      })),
      payments: (invoice.payments || []).map((payment) => ({
        id: payment.id,
        invoiceId: payment.invoiceId,
        amount: new Prisma.Decimal(payment.amount).toFixed(2),
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber,
        status: payment.status,
        paidAt: payment.paidAt.toISOString(),
        createdBy: payment.createdBy,
        creatorName: payment.creator
          ? `${payment.creator.name} (${payment.creator.role})`
          : undefined,
        createdAt: payment.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Creates an itemized invoice for a reservation, automatically snapshotting room charges
   * for each room allocation based on bookedNightlyRate and stay nights.
   */
  static async createInvoiceForReservation(
    input: CreateInvoiceInput,
    staffUserId: string,
    propertyId?: string
  ): Promise<InvoiceDetailDTO> {
    const invoice = await prisma.$transaction(async (tx) => {
      // 1. Fetch reservation and verify existence
      const reservation = await tx.reservation.findUnique({
        where: { id: input.reservationId },
        include: {
          customer: true,
          rooms: {
            include: {
              room: true,
              roomCategory: true,
            },
          },
          invoices: {
            where: {
              status: { not: InvoiceStatus.VOID },
            },
          },
        },
      });

      if (!reservation) {
        throw new Error("Reservation not found");
      }

      if (propertyId) {
        const belongsToProperty = reservation.rooms.every(
          (r) => r.room.propertyId === propertyId
        );
        if (!belongsToProperty) {
          throw new ForbiddenError("Cannot create invoice for another hotel's reservation");
        }
      }

      // 2. In V1, one active invoice per reservation is permitted
      if (reservation.invoices.length > 0) {
        throw new Error(
          `An active invoice (${reservation.invoices[0].invoiceNumber}) already exists for this reservation`
        );
      }

      if (reservation.rooms.length === 0) {
        throw new Error(
          "Reservation has no room allocations to generate an invoice for"
        );
      }

      // 3. Generate itemized room charges
      let subtotal = new Prisma.Decimal(0);
      const itemsToCreate: Array<{
        reservationRoomId: string;
        description: string;
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        itemType: InvoiceItemType;
      }> = [];

      for (const alloc of reservation.rooms) {
        const effectiveDep = alloc.actualCheckoutDate ?? alloc.departureDate;
        const nights = this.calculateNights(
          alloc.arrivalDate,
          effectiveDep
        );
        const unitPrice = new Prisma.Decimal(alloc.bookedNightlyRate);
        const lineTotal = unitPrice.mul(nights);
        subtotal = subtotal.add(lineTotal);

        const arrStr = alloc.arrivalDate.toISOString().split("T")[0];
        const depStr = effectiveDep.toISOString().split("T")[0];
        const desc = `Room ${alloc.room.roomNo} (${alloc.roomCategory.name}) — ${nights} night${nights === 1 ? "" : "s"} (${arrStr} to ${depStr})`;

        itemsToCreate.push({
          reservationRoomId: alloc.id,
          description: desc,
          quantity: new Prisma.Decimal(nights),
          unitPrice,
          lineTotal,
          itemType: InvoiceItemType.ROOM_CHARGE,
        });
      }

      const discountTotal = new Prisma.Decimal(input.discountTotal || 0);
      const taxTotal = new Prisma.Decimal(input.taxTotal || 0);
      const grandTotal = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        subtotal.sub(discountTotal).add(taxTotal)
      );

      if (discountTotal.greaterThan(0)) {
        if (!input.discountReason || input.discountReason.trim().length < 3) {
          throw new BadRequestError(
            "A discount reason of at least 3 characters is required when applying a discount"
          );
        }
      }

      const now = new Date();
      const status = input.autoIssue
        ? InvoiceStatus.ISSUED
        : InvoiceStatus.DRAFT;
      const invoiceNumber = this.generateInvoiceNumber();

      // 4. Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          reservationId: reservation.id,
          invoiceNumber,
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          status,
          issuedAt: input.autoIssue ? now : null,
          items: {
            create: itemsToCreate,
          },
        },
        include: {
          reservation: {
            include: {
              customer: true,
            },
          },
          items: true,
          payments: {
            include: {
              creator: {
                select: { name: true, role: true },
              },
            },
          },
        },
      });

      // 5. Record Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          entityType: "Invoice",
          entityId: invoice.id,
          action: "INVOICE_CREATED",
          newData: {
            invoiceNumber: invoice.invoiceNumber,
            reservationId: reservation.id,
            grandTotal: invoice.grandTotal.toString(),
            status: invoice.status,
            itemCount: itemsToCreate.length,
          },
        },
      });

      if (discountTotal.greaterThan(0)) {
        await tx.auditLog.create({
          data: {
            userId: staffUserId,
            entityType: "Invoice",
            entityId: invoice.id,
            action: "DISCOUNT_APPLIED",
            newData: {
              invoiceNumber: invoice.invoiceNumber,
              discountTotal: discountTotal.toString(),
              reason: input.discountReason!.trim(),
            },
          },
        });
      }

      return this.formatInvoiceDetail(invoice);
    });
    this.invalidateBillingCache();
    return invoice;
  }

  /**
   * Retrieves single invoice by ID with computed payment balances.
   */
  static async getInvoiceById(
    invoiceId: string,
    propertyId?: string
  ): Promise<InvoiceDetailDTO> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        reservation: {
          include: {
            customer: true,
            rooms: {
              include: {
                room: true,
              },
            },
          },
        },
        items: {
          orderBy: { createdAt: "asc" },
        },
        payments: {
          include: {
            creator: {
              select: { name: true, role: true },
            },
          },
          orderBy: { paidAt: "asc" },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError("Invoice not found");
    }

    if (propertyId) {
      const hasRooms =
        invoice.reservation?.rooms && invoice.reservation.rooms.length > 0;
      if (hasRooms) {
        const belongsToProperty = invoice.reservation!.rooms.some(
          (r) => r.room.propertyId === propertyId
        );
        if (!belongsToProperty) {
          throw new NotFoundError("Invoice not found");
        }
      }
    }

    return this.formatInvoiceDetail(invoice);
  }

  /**
   * Retrieves single invoice by reservation ID.
   */
  static async getInvoiceByReservationId(
    reservationId: string
  ): Promise<InvoiceDetailDTO | null> {
    const invoice = await prisma.invoice.findFirst({
      where: {
        reservationId,
        status: { not: InvoiceStatus.VOID },
      },
      include: {
        reservation: {
          include: {
            customer: true,
          },
        },
        items: {
          orderBy: { createdAt: "asc" },
        },
        payments: {
          include: {
            creator: {
              select: { name: true, role: true },
            },
          },
          orderBy: { paidAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!invoice) {
      return null;
    }

    return this.formatInvoiceDetail(invoice);
  }

  /**
   * Lists invoices with pagination, filtering, search, and aggregate metrics.
   */
  static async getInvoices(
    query: InvoiceListQuery = {}
  ): Promise<InvoiceListResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.reservationId) {
      where.reservationId = query.reservationId;
    }
    const reservationWhere: Prisma.ReservationWhereInput = {};
    if (query.customerId) {
      reservationWhere.customerId = query.customerId;
    }
    if (query.propertyId) {
      reservationWhere.rooms = {
        some: {
          room: {
            propertyId: query.propertyId,
          },
        },
      };
    }
    if (Object.keys(reservationWhere).length > 0) {
      where.reservation = reservationWhere;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { invoiceNumber: { contains: term, mode: "insensitive" } },
        {
          reservation: {
            reservationNo: { contains: term, mode: "insensitive" },
          },
        },
        {
          reservation: {
            customer: {
              OR: [
                { firstName: { contains: term, mode: "insensitive" } },
                { lastName: { contains: term, mode: "insensitive" } },
                { phone: { contains: term, mode: "insensitive" } },
                { email: { contains: term, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const hasFilter = Boolean(
      query.status ||
      (query.search && query.search.trim() !== "") ||
      query.reservationId ||
      query.customerId ||
      query.propertyId
    );

    const [total, records, summary] = await Promise.all([
      hasFilter ? prisma.invoice.count({ where }) : this.getUnfilteredInvoiceCount(),
      prisma.invoice.findMany({
        where,
        include: {
          reservation: {
            include: { customer: true },
          },
          items: true,
          payments: {
            include: {
              creator: { select: { name: true, role: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.getBillingSummary(query.propertyId),
    ]);

    return {
      invoices: records.map((inv) => this.formatInvoiceDetail(inv)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      summary,
    };
  }

  /**
   * Adds an extra charge line item (minibar, laundry, room service, etc.) to an existing invoice
   * and atomically recalculates totals and status.
   */
  static async addInvoiceItem(
    invoiceId: string,
    input: AddInvoiceItemInput,
    staffUserId: string
  ): Promise<InvoiceDetailDTO> {
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // 0. Acquire row lock on invoice
      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`;

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          items: true,
          payments: true,
        },
      });

      if (!invoice) {
        throw new NotFoundError("Invoice not found");
      }

      if (invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestError("Cannot add items to a voided invoice");
      }

      if (input.itemType === InvoiceItemType.DISCOUNT) {
        if (!input.reason || input.reason.trim().length < 3) {
          throw new BadRequestError(
            "A reason of at least 3 characters is required when adding a discount line item"
          );
        }
      }

      const quantity = new Prisma.Decimal(input.quantity);
      const unitPrice = new Prisma.Decimal(input.unitPrice);
      const lineTotal = quantity.mul(unitPrice);

      // Create line item
      await tx.invoiceItem.create({
        data: {
          invoiceId,
          reservationRoomId: input.reservationRoomId || null,
          description: input.description.trim(),
          quantity,
          unitPrice,
          lineTotal,
          itemType: input.itemType || InvoiceItemType.EXTRA_CHARGE,
        },
      });

      // Recalculate invoice totals
      const allItems = await tx.invoiceItem.findMany({
        where: { invoiceId },
      });

      const newSubtotal = allItems.reduce(
        (sum, item) => sum.add(item.lineTotal),
        new Prisma.Decimal(0)
      );

      const newGrandTotal = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        newSubtotal.sub(invoice.discountTotal).add(invoice.taxTotal)
      );

      // Recalculate status against existing recorded payments
      const totalPaid = (invoice.payments || [])
        .filter((p) => p.status === PaymentStatus.RECORDED)
        .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

      let newStatus = invoice.status;
      if (invoice.status !== InvoiceStatus.DRAFT) {
        if (totalPaid.greaterThanOrEqualTo(newGrandTotal)) {
          newStatus = InvoiceStatus.PAID;
        } else if (totalPaid.greaterThan(0)) {
          newStatus = InvoiceStatus.PARTIALLY_PAID;
        } else {
          newStatus = InvoiceStatus.ISSUED;
        }
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          subtotal: newSubtotal,
          grandTotal: newGrandTotal,
          status: newStatus,
        },
        include: {
          reservation: { include: { customer: true } },
          items: true,
          payments: {
            include: { creator: { select: { name: true, role: true } } },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          entityType: "Invoice",
          entityId: invoiceId,
          action: "INVOICE_ITEM_ADDED",
          newData: {
            description: input.description,
            lineTotal: lineTotal.toString(),
            newGrandTotal: newGrandTotal.toString(),
          },
        },
      });

      if (input.itemType === InvoiceItemType.DISCOUNT) {
        await tx.auditLog.create({
          data: {
            userId: staffUserId,
            entityType: "Invoice",
            entityId: invoiceId,
            action: "DISCOUNT_APPLIED",
            newData: {
              invoiceNumber: updatedInvoice.invoiceNumber,
              description: input.description,
              discountAmount: lineTotal.toString(),
              reason: input.reason!.trim(),
            },
          },
        });
      }

      return this.formatInvoiceDetail(updatedInvoice);
    });
    this.invalidateBillingCache();
    return updatedInvoice;
  }

  /**
   * Updates an existing invoice item.
   * Strictly blocked if any payments have been recorded on the invoice.
   */
  static async updateInvoiceItem(
    invoiceId: string,
    itemId: string,
    input: UpdateInvoiceItemInput,
    staffUserId: string
  ): Promise<InvoiceDetailDTO> {
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`;

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, payments: true },
      });

      if (!invoice) {
        throw new NotFoundError("Invoice not found");
      }

      if (invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestError("Cannot edit items on a voided invoice");
      }

      const hasPayments = (invoice.payments || []).some(
        (p) => p.status === PaymentStatus.RECORDED
      );
      if (hasPayments) {
        throw new BadRequestError(
          "Cannot edit invoice items once payments have been recorded. To adjust balance, apply a concession/discount or post an adjustment item."
        );
      }

      const item = invoice.items.find((i) => i.id === itemId);
      if (!item) {
        throw new NotFoundError("Invoice item not found");
      }

      const itemType = input.itemType ?? item.itemType;
      if (itemType === InvoiceItemType.DISCOUNT) {
        if (!input.reason || input.reason.trim().length < 3) {
          throw new BadRequestError(
            "A reason of at least 3 characters is required when editing to a discount line item"
          );
        }
      }

      const quantity = input.quantity !== undefined ? new Prisma.Decimal(input.quantity) : item.quantity;
      const unitPrice = input.unitPrice !== undefined ? new Prisma.Decimal(input.unitPrice) : item.unitPrice;
      const lineTotal = quantity.mul(unitPrice);

      const oldData = {
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        lineTotal: item.lineTotal.toString(),
        itemType: item.itemType,
      };

      await tx.invoiceItem.update({
        where: { id: itemId },
        data: {
          description: input.description ?? item.description,
          quantity,
          unitPrice,
          lineTotal,
          itemType,
        },
      });

      const allItems = await tx.invoiceItem.findMany({
        where: { invoiceId },
      });

      const newSubtotal = allItems.reduce(
        (sum, it) => sum.add(it.lineTotal),
        new Prisma.Decimal(0)
      );

      const newGrandTotal = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        newSubtotal.sub(invoice.discountTotal).add(invoice.taxTotal)
      );

      const totalPaid = (invoice.payments || [])
        .filter((p) => p.status === PaymentStatus.RECORDED)
        .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

      let newStatus = invoice.status;
      if (invoice.status !== InvoiceStatus.DRAFT) {
        if (totalPaid.greaterThanOrEqualTo(newGrandTotal)) {
          newStatus = InvoiceStatus.PAID;
        } else if (totalPaid.greaterThan(0)) {
          newStatus = InvoiceStatus.PARTIALLY_PAID;
        } else {
          newStatus = InvoiceStatus.ISSUED;
        }
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          subtotal: newSubtotal,
          grandTotal: newGrandTotal,
          status: newStatus,
        },
        include: {
          reservation: { include: { customer: true } },
          items: true,
          payments: {
            include: { creator: { select: { name: true, role: true } } },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          entityType: "Invoice",
          entityId: invoiceId,
          action: "INVOICE_ITEM_UPDATED",
          oldData,
          newData: {
            description: input.description ?? item.description,
            quantity: quantity.toString(),
            unitPrice: unitPrice.toString(),
            lineTotal: lineTotal.toString(),
            itemType,
            reason: input.reason?.trim() || null,
          },
        },
      });

      return this.formatInvoiceDetail(updatedInvoice);
    });
    this.invalidateBillingCache();
    return updatedInvoice;
  }

  /**
   * Removes an invoice item and recalculates totals and status.
   */
  static async removeInvoiceItem(
    invoiceId: string,
    itemId: string,
    staffUserId: string
  ): Promise<InvoiceDetailDTO> {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`;

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, payments: true },
      });

      if (!invoice) {
        throw new NotFoundError("Invoice not found");
      }

      if (invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestError("Cannot remove items from a voided invoice");
      }

      const hasPayments = (invoice.payments || []).some(
        (p) => p.status === PaymentStatus.RECORDED
      );
      if (hasPayments) {
        throw new BadRequestError(
          "Cannot delete invoice items once payments have been recorded. Add an adjustment or credit item instead."
        );
      }

      const item = invoice.items.find((i) => i.id === itemId);
      if (!item) {
        throw new NotFoundError("Invoice item not found");
      }

      await tx.invoiceItem.delete({
        where: { id: itemId },
      });

      const remainingItems = await tx.invoiceItem.findMany({
        where: { invoiceId },
      });

      const newSubtotal = remainingItems.reduce(
        (sum, it) => sum.add(it.lineTotal),
        new Prisma.Decimal(0)
      );

      const newGrandTotal = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        newSubtotal.sub(invoice.discountTotal).add(invoice.taxTotal)
      );

      const totalPaid = (invoice.payments || [])
        .filter((p) => p.status === PaymentStatus.RECORDED)
        .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

      let newStatus = invoice.status;
      if (invoice.status !== InvoiceStatus.DRAFT) {
        if (totalPaid.greaterThanOrEqualTo(newGrandTotal)) {
          newStatus = InvoiceStatus.PAID;
        } else if (totalPaid.greaterThan(0)) {
          newStatus = InvoiceStatus.PARTIALLY_PAID;
        } else {
          newStatus = InvoiceStatus.ISSUED;
        }
      }

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          subtotal: newSubtotal,
          grandTotal: newGrandTotal,
          status: newStatus,
        },
        include: {
          reservation: { include: { customer: true } },
          items: true,
          payments: {
            include: { creator: { select: { name: true, role: true } } },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          entityType: "Invoice",
          entityId: invoiceId,
          action: "INVOICE_ITEM_REMOVED",
          oldData: {
            itemId,
            description: item.description,
            lineTotal: item.lineTotal.toString(),
          },
          newData: {
            newGrandTotal: newGrandTotal.toString(),
          },
        },
      });

      return this.formatInvoiceDetail(updated);
    });
    this.invalidateBillingCache();
    return updated;
  }

  /**
   * Transitions a DRAFT invoice to ISSUED.
   */
  static async issueInvoice(
    invoiceId: string,
    staffUserId: string
  ): Promise<InvoiceDetailDTO> {
    const updated = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new Error(`Invoice is already in ${invoice.status} status`);
      }

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.ISSUED,
          issuedAt: new Date(),
        },
        include: {
          reservation: { include: { customer: true } },
          items: true,
          payments: {
            include: { creator: { select: { name: true, role: true } } },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          entityType: "Invoice",
          entityId: invoiceId,
          action: "INVOICE_ISSUED",
          newData: {
            status: InvoiceStatus.ISSUED,
            issuedAt: updated.issuedAt?.toISOString(),
          },
        },
      });

      return this.formatInvoiceDetail(updated);
    });
    this.invalidateBillingCache();
    return updated;
  }

  /**
   * Atomically records a payment against an invoice with row-level locking.
   * Enforces positive amount, prevents overpayment exceeding grand total,
   * updates invoice status (PARTIALLY_PAID / PAID), and writes audit trail.
   */
  static async recordPayment(
    invoiceId: string,
    input: RecordPaymentInput,
    staffUserId: string,
    propertyId?: string
  ): Promise<{
    invoice: InvoiceDetailDTO;
    receipt: PaymentReceiptDTO;
  }> {
    const result = await prisma.$transaction(async (tx) => {
      // 0. Acquire row-level lock on invoice to serialize concurrent payments
      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`;

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          reservation: {
            include: {
              customer: true,
              rooms: { include: { room: true } },
            },
          },
          items: true,
          payments: {
            include: { creator: { select: { name: true, role: true } } },
          },
        },
      });

      if (!invoice) {
        throw new NotFoundError("Invoice not found");
      }

      if (propertyId) {
        const hasRooms =
          invoice.reservation?.rooms && invoice.reservation.rooms.length > 0;
        if (hasRooms) {
          const belongsToProperty = invoice.reservation!.rooms.some(
            (r) => r.room.propertyId === propertyId
          );
          if (!belongsToProperty) {
            throw new NotFoundError("Invoice not found");
          }
        }
      }

      if (invoice.status === InvoiceStatus.VOID) {
        throw new Error("Cannot record payment against a voided invoice");
      }

      const paymentAmount = new Prisma.Decimal(input.amount);
      if (paymentAmount.lessThanOrEqualTo(0)) {
        throw new Error("Payment amount must be greater than zero");
      }

      const grandTotal = new Prisma.Decimal(invoice.grandTotal);
      const existingPaid = (invoice.payments || [])
        .filter((p) => p.status === PaymentStatus.RECORDED)
        .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

      const remainingBalance = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        grandTotal.sub(existingPaid)
      );

      if (remainingBalance.equals(0)) {
        throw new Error("Invoice is already fully paid");
      }

      if (paymentAmount.greaterThan(remainingBalance)) {
        throw new Error(
          `Payment amount ($${paymentAmount.toFixed(2)}) exceeds remaining balance of $${remainingBalance.toFixed(2)}`
        );
      }

      // Check Idempotency Key (ADV-BIL-04)
      if (input.idempotencyKey) {
        const existingPayment = await tx.payment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            creator: { select: { name: true, role: true } },
            invoice: {
              include: {
                reservation: { include: { customer: true } },
                items: true,
                payments: {
                  include: { creator: { select: { name: true, role: true } } },
                },
              },
            },
          },
        });

        if (existingPayment) {
          const formattedInvoice = this.formatInvoiceDetail(existingPayment.invoice);
          const customer = existingPayment.invoice.reservation?.customer;
          const customerName = customer
            ? `${customer.firstName} ${customer.lastName || ""}`.trim()
            : "Guest";

          const receipt: PaymentReceiptDTO = {
            receiptNumber: `REC-${existingPayment.id.slice(-8).toUpperCase()}`,
            paymentId: existingPayment.id,
            invoiceNumber: existingPayment.invoice.invoiceNumber,
            reservationNo: existingPayment.invoice.reservation?.reservationNo || "",
            customerName,
            customerEmail: customer?.email || null,
            customerPhone: customer?.phone || null,
            amountPaid: existingPayment.amount.toString(),
            paymentMethod: existingPayment.paymentMethod,
            referenceNumber: existingPayment.referenceNumber,
            paidAt: existingPayment.paidAt.toISOString(),
            recordedByName: existingPayment.creator
              ? `${existingPayment.creator.name} (${existingPayment.creator.role?.name || "Staff"})`
              : "Staff",
            invoiceGrandTotal: formattedInvoice.grandTotal,
            invoiceTotalPaid: formattedInvoice.totalPaid,
            remainingBalance: formattedInvoice.balanceDue,
            invoiceStatus: formattedInvoice.status,
          };

          return {
            invoice: formattedInvoice,
            receipt,
          };
        }
      }

      const now = input.paidAt ? new Date(input.paidAt) : new Date();

      // 1. Create Payment record
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: paymentAmount,
          paymentMethod: input.paymentMethod.toUpperCase().trim(),
          referenceNumber: input.referenceNumber?.trim() || null,
          idempotencyKey: input.idempotencyKey?.trim() || null,
          status: PaymentStatus.RECORDED,
          paidAt: now,
          createdBy: staffUserId,
        },
        include: {
          creator: { select: { name: true, role: true } },
        },
      });

      // 2. Compute new status
      const newTotalPaid = existingPaid.add(paymentAmount);
      const newRemainingBalance = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        grandTotal.sub(newTotalPaid)
      );

      let newStatus: InvoiceStatus;
      if (newTotalPaid.greaterThanOrEqualTo(grandTotal)) {
        newStatus = InvoiceStatus.PAID;
      } else {
        newStatus = InvoiceStatus.PARTIALLY_PAID;
      }

      // If invoice was DRAFT, auto-issue it upon receiving payment
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: newStatus,
          issuedAt: invoice.issuedAt || now,
        },
        include: {
          reservation: { include: { customer: true } },
          items: true,
          payments: {
            include: { creator: { select: { name: true, role: true } } },
          },
        },
      });

      // 3. Write Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          entityType: "Payment",
          entityId: payment.id,
          action: "PAYMENT_RECORDED",
          newData: {
            invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            amount: paymentAmount.toString(),
            paymentMethod: payment.paymentMethod,
            newInvoiceStatus: newStatus,
            newTotalPaid: newTotalPaid.toString(),
            remainingBalance: newRemainingBalance.toString(),
          },
        },
      });

      const formattedInvoice = this.formatInvoiceDetail(updatedInvoice);
      const customer = invoice.reservation?.customer;
      const customerName = customer
        ? `${customer.firstName} ${customer.lastName || ""}`.trim()
        : "Guest";

      const receipt: PaymentReceiptDTO = {
        receiptNumber: `REC-${payment.id.slice(-8).toUpperCase()}`,
        paymentId: payment.id,
        invoiceNumber: invoice.invoiceNumber,
        reservationNo: invoice.reservation?.reservationNo || "",
        customerName,
        customerEmail: customer?.email || null,
        customerPhone: customer?.phone || null,
        amountPaid: paymentAmount.toFixed(2),
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber,
        paidAt: payment.paidAt.toISOString(),
        recordedByName: payment.creator
          ? `${payment.creator.name} (${payment.creator.role})`
          : "Staff",
        invoiceGrandTotal: grandTotal.toFixed(2),
        invoiceTotalPaid: newTotalPaid.toFixed(2),
        remainingBalance: newRemainingBalance.toFixed(2),
        invoiceStatus: newStatus,
      };

      return {
        invoice: formattedInvoice,
        receipt,
      };
    });
    this.invalidateBillingCache();
    return result;
  }

  /**
   * Voids a recorded payment, recalculates invoice balance, and updates status.
   */
  static async voidPayment(
    invoiceIdOrPaymentId: string,
    paymentIdOrStaffUserId: string,
    staffUserIdParam?: string,
    reasonParam?: string,
    propertyIdParam?: string
  ): Promise<InvoiceDetailDTO> {
    const isMultiArgs = typeof staffUserIdParam === "string";
    const invoiceId = isMultiArgs ? invoiceIdOrPaymentId : null;
    const paymentId = isMultiArgs ? paymentIdOrStaffUserId : invoiceIdOrPaymentId;
    const staffUserId = isMultiArgs ? staffUserIdParam : paymentIdOrStaffUserId;
    const voidReason = (reasonParam || "Payment voided by operator").trim();
    const propertyId = propertyIdParam;

    if (voidReason.length < 3) {
      throw new BadRequestError("Void reason must be at least 3 characters");
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          invoice: {
            include: {
              reservation: {
                include: {
                  rooms: { include: { room: true } },
                },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundError("Payment not found");
      }

      if (propertyId) {
        const hasRooms =
          payment.invoice?.reservation?.rooms &&
          payment.invoice.reservation.rooms.length > 0;
        if (hasRooms) {
          const belongsToProperty = payment.invoice!.reservation!.rooms.some(
            (r) => r.room.propertyId === propertyId
          );
          if (!belongsToProperty) {
            throw new NotFoundError("Payment not found");
          }
        }
      }

      if (invoiceId && payment.invoiceId !== invoiceId) {
        throw new BadRequestError("Payment does not belong to the specified invoice");
      }

      if (payment.status === PaymentStatus.VOIDED) {
        throw new BadRequestError("Payment is already voided");
      }

      // Invariant: Receptionists can only void same-business-day payments. Older payments require ADMIN or SUPER_ADMIN.
      const hotelToday = getHotelTodayDate();
      const paymentDate = getHotelTodayDate(payment.paidAt);
      if (hotelToday !== paymentDate) {
        const caller = await tx.user.findUnique({
          where: { id: staffUserId },
          include: { role: true },
        });
        if (
          caller?.role.name !== RoleName.ADMIN &&
          caller?.role.name !== RoleName.SUPER_ADMIN
        ) {
          throw new ForbiddenError(
            "Receptionists can only void same-business-day payments. Voiding older payments requires Administrator privileges."
          );
        }
      }

      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${payment.invoiceId} FOR UPDATE`;

      const now = new Date();
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.VOIDED,
          voidReason,
          voidedAt: now,
          voidedBy: staffUserId,
        },
      });

      const remainingPayments = await tx.payment.findMany({
        where: {
          invoiceId: payment.invoiceId,
          status: PaymentStatus.RECORDED,
        },
      });

      const newTotalPaid = remainingPayments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0)
      );

      const grandTotal = new Prisma.Decimal(payment.invoice.grandTotal);

      let newStatus: InvoiceStatus;
      if (newTotalPaid.greaterThanOrEqualTo(grandTotal)) {
        newStatus = InvoiceStatus.PAID;
      } else if (newTotalPaid.greaterThan(0)) {
        newStatus = InvoiceStatus.PARTIALLY_PAID;
      } else {
        newStatus = InvoiceStatus.ISSUED;
      }

      const updated = await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: newStatus },
        include: {
          reservation: { include: { customer: true } },
          items: true,
          payments: {
            include: { creator: { select: { name: true, role: true } } },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          entityType: "Payment",
          entityId: paymentId,
          action: "PAYMENT_VOIDED",
          oldData: {
            amount: payment.amount.toString(),
            status: PaymentStatus.RECORDED,
          },
          newData: {
            status: PaymentStatus.VOIDED,
            voidReason,
            voidedAt: now.toISOString(),
            voidedBy: staffUserId,
            newInvoiceStatus: newStatus,
            newTotalPaid: newTotalPaid.toString(),
          },
        },
      });

      return this.formatInvoiceDetail(updated);
    });
    this.invalidateBillingCache();
    return result;
  }
}
