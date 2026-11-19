import { AccountType } from "@prisma/client";

export interface PaymentMethodDTO {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  defaultAccountId: string | null;
  defaultAccountName?: string | null;
  defaultAccountType?: AccountType | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentMethodInput {
  name: string;
  code: string;
  defaultAccountId?: string | null;
  isActive?: boolean;
}

export interface UpdatePaymentMethodInput {
  name?: string;
  defaultAccountId?: string | null;
  isActive?: boolean;
}
