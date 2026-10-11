import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  InvoiceStatus,
  InvoiceItemType,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import {
  CreateInvoiceInput,
  AddInvoiceItemInput,
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
  private static generateInvoiceNumber(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const randomHex = crypto.randomBytes(2).toString("hex").toUpperCase();
    return `INV-${yyyy}${mm}${dd}-${randomHex}`;
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
    staffUserId: string
  ): Promise<InvoiceDetailDTO> {
    return prisma.$transaction(async (tx) => {
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
        const nights = this.calculateNights(
          alloc.arrivalDate,
          alloc.departureDate
        );
        const unitPrice = new Prisma.Decimal(alloc.bookedNightlyRate);
        const lineTotal = unitPrice.mul(nights);
        subtotal = subtotal.add(lineTotal);

        const arrStr = alloc.arrivalDate.toISOString().split("T")[0];
        const depStr = alloc.departureDate.toISOString().split("T")[0];
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

      return this.formatInvoiceDetail(invoice);
    });
  }

  /**
   * Retrieves single invoice by ID with computed payment balances.
   */
  static async getInvoiceById(invoiceId: string): Promise<InvoiceDetailDTO> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
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
    });

    if (!invoice) {
      throw new Error("Invoice not found");
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
    if (query.customerId) {
      where.reservation = { customerId: query.customerId };
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

    const [total, records, aggregateInvoices, aggregatePayments] =
      await Promise.all([
        prisma.invoice.count({ where }),
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
        prisma.invoice.aggregate({
          where: { status: { not: InvoiceStatus.VOID } },
          _sum: { grandTotal: true },
        }),
        prisma.payment.aggregate({
          where: {
            status: PaymentStatus.RECORDED,
            invoice: { status: { not: InvoiceStatus.VOID } },
          },
          _sum: { amount: true },
        }),
      ]);

    const totalInvoiced = aggregateInvoices._sum.grandTotal || new Prisma.Decimal(0);
    const totalCollected = aggregatePayments._sum.amount || new Prisma.Decimal(0);
    const totalOutstanding = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      totalInvoiced.sub(totalCollected)
    );

    return {
      invoices: records.map((inv) => this.formatInvoiceDetail(inv)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalInvoiced: totalInvoiced.toFixed(2),
        totalCollected: totalCollected.toFixed(2),
        totalOutstanding: totalOutstanding.toFixed(2),
      },
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
    return prisma.$transaction(async (tx) => {
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
        throw new Error("Invoice not found");
      }

      if (invoice.status === InvoiceStatus.VOID) {
        throw new Error("Cannot add items to a voided invoice");
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

      return this.formatInvoiceDetail(updatedInvoice);
    });
  }

  /**
   * Removes an invoice item and recalculates totals and status.
   */
  static async removeInvoiceItem(
    invoiceId: string,
    itemId: string,
    staffUserId: string
  ): Promise<InvoiceDetailDTO> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`;

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, payments: true },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      if (invoice.status === InvoiceStatus.VOID) {
        throw new Error("Cannot remove items from a voided invoice");
      }

      const item = invoice.items.find((i) => i.id === itemId);
      if (!item) {
        throw new Error("Invoice item not found");
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
  }

  /**
   * Transitions a DRAFT invoice to ISSUED.
   */
  static async issueInvoice(
    invoiceId: string,
    staffUserId: string
  ): Promise<InvoiceDetailDTO> {
    return prisma.$transaction(async (tx) => {
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
  }

  /**
   * Atomically records a payment against an invoice with row-level locking.
   * Enforces positive amount, prevents overpayment exceeding grand total,
   * updates invoice status (PARTIALLY_PAID / PAID), and writes audit trail.
   */
  static async recordPayment(
    invoiceId: string,
    input: RecordPaymentInput,
    staffUserId: string
  ): Promise<{
    invoice: InvoiceDetailDTO;
    receipt: PaymentReceiptDTO;
  }> {
    return prisma.$transaction(async (tx) => {
      // 0. Acquire row-level lock on invoice to serialize concurrent payments
      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`;

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          reservation: {
            include: { customer: true },
          },
          items: true,
          payments: {
            include: { creator: { select: { name: true, role: true } } },
          },
        },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
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

      const now = input.paidAt ? new Date(input.paidAt) : new Date();

      // 1. Create Payment record
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: paymentAmount,
          paymentMethod: input.paymentMethod.toUpperCase().trim(),
          referenceNumber: input.referenceNumber?.trim() || null,
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
  }

  /**
   * Voids a recorded payment, recalculates invoice balance, and updates status.
   */
  static async voidPayment(
    paymentId: string,
    staffUserId: string
  ): Promise<InvoiceDetailDTO> {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { invoice: true },
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status === PaymentStatus.VOIDED) {
        throw new Error("Payment is already voided");
      }

      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${payment.invoiceId} FOR UPDATE`;

      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.VOIDED },
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
            newInvoiceStatus: newStatus,
            newTotalPaid: newTotalPaid.toString(),
          },
        },
      });

      return this.formatInvoiceDetail(updated);
    });
  }
}
