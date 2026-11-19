import type { IncomeStatus, ReceiptStatus } from "@prisma/client";

/**
 * Standard property-specific default income heads to seed per hotel.
 * Hall and banquet rental revenue is explicitly omitted as it belongs to service invoices.
 */
export const DEFAULT_INCOME_HEADS = [
  {
    code: "COMMISSION",
    name: "Travel Desk & Tour Commissions",
    description: "Commissions received from travel desks, tour operators, and taxi partnerships",
  },
  {
    code: "SCRAP_ASSET_SALE",
    name: "Scrap & Asset Disposal",
    description: "Direct proceeds from scrap, discarded linen, old assets, and paper sales",
  },
  {
    code: "FOREX_COMMISSION",
    name: "Currency Exchange Commission",
    description: "Service charges and markup received from guest foreign currency exchange",
  },
  {
    code: "INTEREST",
    name: "Bank Interest Received",
    description: "Periodic interest credited by financial institutions into operating bank accounts",
  },
  {
    code: "OTHER_DIRECT_INCOME",
    name: "Miscellaneous Direct Income",
    description: "Sundry non-invoice collections, parking space rentals, and lost item recovery fees",
  },
] as const;

// ----------------------------------------------------------------------------
// Income Heads (Categories)
// ----------------------------------------------------------------------------

export interface IncomeHeadDTO {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  incomeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIncomeHeadInput {
  propertyId?: string;
  name: string;
  code: string;
  description?: string | null;
}

export interface UpdateIncomeHeadInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface IncomeHeadFilterParams {
  isActive?: boolean;
}

// ----------------------------------------------------------------------------
// Direct Incomes & Receipts
// ----------------------------------------------------------------------------

export interface IncomeReceiptDTO {
  id: string;
  propertyId: string;
  incomeId: string;
  accountId: string;
  accountName: string;
  paymentMethodId: string | null;
  paymentMethodCode: string;
  amount: string;
  referenceNumber: string | null;
  status: ReceiptStatus;
  paidAt: string;
  createdBy: string;
  createdByName?: string;
  voidReason: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidedByName?: string;
  createdAt: string;
}

export interface IncomeDTO {
  id: string;
  propertyId: string;
  incomeHeadId: string;
  incomeHeadName: string;
  incomeHeadCode: string;
  title: string;
  description: string | null;
  expectedAmount: string;
  receivedAmount: string;
  outstandingAmount: string;
  incomeDate: string;
  status: IncomeStatus;
  createdBy: string;
  createdByName?: string;
  receiptCount: number;
  voidReason: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeDetailDTO extends IncomeDTO {
  receipts: IncomeReceiptDTO[];
}

export interface CreateIncomeInput {
  propertyId?: string;
  incomeHeadId: string;
  title: string;
  expectedAmount: number;
  incomeDate?: string;
  description?: string | null;
}

export interface UpdateIncomeInput {
  incomeHeadId?: string;
  title?: string;
  expectedAmount?: number;
  incomeDate?: string;
  description?: string | null;
}

export interface RecordIncomeReceiptInput {
  amount: number;
  accountId: string;
  paymentMethod: string;
  paymentMethodId?: string | null;
  referenceNumber?: string | null;
  paidAt?: string;
  idempotencyKey?: string | null;
}

export interface VoidIncomeInput {
  voidReason: string;
}

export interface VoidIncomeReceiptInput {
  voidReason: string;
}

export interface IncomeFilterParams {
  startDate?: string;
  endDate?: string;
  incomeHeadId?: string;
  status?: IncomeStatus | "ALL";
  search?: string;
  page?: number;
  limit?: number;
}
