import { InvoiceStatus, InvoiceItemType, PaymentStatus } from "@prisma/client";

export interface CreateInvoiceInput {
  reservationId: string;
  discountTotal?: number | string;
  discountReason?: string;
  taxTotal?: number | string;
  autoIssue?: boolean;
}

export interface AddInvoiceItemInput {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  itemType?: InvoiceItemType;
  reason?: string;
  reservationRoomId?: string;
}

export interface UpdateInvoiceItemInput {
  description?: string;
  quantity?: number | string;
  unitPrice?: number | string;
  itemType?: InvoiceItemType;
  reason?: string;
}

export interface VoidPaymentInput {
  reason: string;
}

export interface RecordPaymentInput {
  amount: number | string;
  paymentMethod: string;
  referenceNumber?: string | null;
  idempotencyKey?: string | null;
  paidAt?: string;
}

export interface InvoiceItemDTO {
  id: string;
  invoiceId: string;
  reservationRoomId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  itemType: InvoiceItemType;
  createdAt: string;
}

export interface PaymentDTO {
  id: string;
  invoiceId: string;
  amount: string;
  paymentMethod: string;
  referenceNumber: string | null;
  status: PaymentStatus;
  paidAt: string;
  createdBy: string;
  creatorName?: string;
  voidReason?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  createdAt: string;
}

export interface InvoiceDetailDTO {
  id: string;
  propertyId: string;
  invoiceNumber: string;
  reservationId: string;
  reservationNo: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  totalPaid: string;
  balanceDue: string;
  status: InvoiceStatus;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItemDTO[];
  payments: PaymentDTO[];
}

export interface InvoiceListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvoiceStatus;
  reservationId?: string;
  customerId?: string;
  propertyId?: string;
}

export interface InvoiceListResponse {
  invoices: InvoiceDetailDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    totalInvoiced: string;
    totalCollected: string;
    totalOutstanding: string;
  };
}

export interface PaymentReceiptDTO {
  receiptNumber: string;
  paymentId: string;
  invoiceNumber: string;
  reservationNo: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  amountPaid: string;
  paymentMethod: string;
  referenceNumber: string | null;
  paidAt: string;
  recordedByName: string;
  invoiceGrandTotal: string;
  invoiceTotalPaid: string;
  remainingBalance: string;
  invoiceStatus: InvoiceStatus;
}
