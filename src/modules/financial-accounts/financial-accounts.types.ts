import { AccountType, TransferStatus } from "@prisma/client";

export { AccountType, TransferStatus };

export interface FinancialAccountDTO {
  id: string;
  propertyId: string;
  accountName: string;
  accountType: AccountType;
  openingBalance: string;
  openingBalanceDate: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialAccountWithBalanceDTO extends FinancialAccountDTO {
  totalReceipts: string;
  totalPayments: string;
  totalTransfersIn: string;
  totalTransfersOut: string;
  currentBalance: string;
}

export interface CreateFinancialAccountInput {
  accountName: string;
  accountType?: AccountType;
  openingBalance?: number | string;
  openingBalanceDate?: string;
  isDefault?: boolean;
}

export interface UpdateFinancialAccountInput {
  accountName?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export type StatementEntryType =
  | "OPENING_BALANCE"
  | "RECEIPT"
  | "PAYMENT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

export interface AccountStatementItemDTO {
  id: string;
  date: string;
  type: StatementEntryType;
  referenceNumber: string | null;
  description: string;
  debit: string | null;   // Money out (Payments, Transfer Out)
  credit: string | null;  // Money in (Receipts, Transfer In, Opening)
  runningBalance: string;
}

export interface AccountStatementDTO {
  account: FinancialAccountDTO;
  startDate: string;
  endDate: string;
  openingBalanceOnStartDate: string;
  closingBalance: string;
  items: AccountStatementItemDTO[];
}

export interface CreateAccountTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number | string;
  transferDate?: string;
  description?: string;
  referenceNumber?: string;
}

export interface AccountTransferDTO {
  id: string;
  propertyId: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: string;
  transferDate: string;
  description: string | null;
  referenceNumber: string | null;
  status: TransferStatus;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}
