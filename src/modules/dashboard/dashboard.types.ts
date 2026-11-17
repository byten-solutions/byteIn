import { z } from "zod";

export type FinancialTimelineEventType =
  | "RECEIPT"
  | "PAYMENT"
  | "TRANSFER"
  | "RECEIPT_REVERSAL"
  | "PAYMENT_REVERSAL";

export interface FinancialTimelineEvent {
  id: string;
  originalId: string;
  eventType: FinancialTimelineEventType;
  direction: "IN" | "OUT" | "TRANSFER";
  amount: string;
  timestamp: string; // ISO string for timestamps or YYYY-MM-DD for date-only
  isDateOnly?: boolean;
  title: string;
  description?: string;
  accountName: string;
  accountType?: string;
  counterAccountName?: string;
  paymentMethodCode?: string;
  paymentMethodName?: string;
  referenceNumber?: string;
  isVoidedOrReversal?: boolean;
  voidReason?: string;
  invoiceId?: string;
  incomeId?: string;
  expenseId?: string;
  transferId?: string;
  targetUrl?: string;
}

export interface FinancialActivitySummary {
  moneyIn: string; // Recorded receipts in period - receipt reversals in period
  moneyOut: string; // Recorded payments in period - payment reversals in period
  netMovement: string; // moneyIn - moneyOut (unclamped, can be negative)
  transfersTotal: string; // Completed account transfers in period
  totalReceiptsCount: number;
  totalPaymentsCount: number;
  totalTransfersCount: number;
  totalReversalsCount: number;
}

export interface FinancialActivityDTO {
  startDate: string;
  endDate: string;
  propertyId: string;
  propertyName: string;
  summary: FinancialActivitySummary;
  timeline: FinancialTimelineEvent[];
  totalEventsCount: number;
  hasMore: boolean;
}

export const financialActivityQuerySchema = z.object({
  propertyId: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "StartDate must be in YYYY-MM-DD format")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "EndDate must be in YYYY-MM-DD format")
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type FinancialActivityQuery = z.infer<typeof financialActivityQuerySchema>;
