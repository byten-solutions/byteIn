import { ExpenseStatus, PaymentStatus } from "@prisma/client";

export interface ExpenseHeadDTO {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseHeadInput {
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateExpenseHeadInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface ExpensePaymentDTO {
  id: string;
  propertyId: string;
  expenseId: string;
  accountId: string;
  accountName: string;
  paymentMethodId: string | null;
  paymentMethodCode: string;
  amount: string;
  referenceNumber: string | null;
  idempotencyKey: string | null;
  status: PaymentStatus;
  paidAt: string;
  createdBy: string;
  creatorName?: string;
  voidReason: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  createdAt: string;
}

export interface ExpenseDTO {
  id: string;
  propertyId: string;
  expenseHeadId: string;
  categoryName: string;
  categoryCode: string;
  title: string;
  description: string | null;
  amount: string;
  paidAmount: string;
  outstandingAmount: string;
  vendorName: string | null;
  referenceNumber: string | null;
  expenseDate: string;
  status: ExpenseStatus;
  createdBy: string;
  creatorName?: string;
  voidReason: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseDetailDTO extends ExpenseDTO {
  payments: ExpensePaymentDTO[];
}

export interface CreateExpenseInput {
  expenseHeadId: string;
  title: string;
  description?: string;
  amount: number;
  vendorName?: string;
  referenceNumber?: string;
  expenseDate?: string; // YYYY-MM-DD or ISO
}

export interface UpdateExpenseInput {
  expenseHeadId?: string;
  title?: string;
  description?: string;
  amount?: number;
  vendorName?: string;
  referenceNumber?: string;
  expenseDate?: string;
}

export interface RecordExpensePaymentInput {
  accountId: string;
  paymentMethodId?: string;
  paymentMethodCode?: string;
  amount: number;
  referenceNumber?: string;
  idempotencyKey?: string;
  paidAt?: string;
}

export interface VoidExpensePaymentInput {
  voidReason: string;
}

export interface VoidExpenseInput {
  voidReason: string;
}

export interface ExpenseFilterParams {
  page?: number;
  limit?: number;
  status?: ExpenseStatus | "ALL";
  expenseHeadId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface ExpenseSummaryMetricsDTO {
  totalIncurred: string;
  totalPaid: string;
  totalOutstanding: string;
  expenseCount: number;
  paidCount: number;
  pendingCount: number;
  voidCount: number;
}
