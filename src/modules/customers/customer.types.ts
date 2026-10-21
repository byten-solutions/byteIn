export interface CreateCustomerInput {
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  address?: string | null;
  idProofType?: string | null;
  idProofNumber?: string | null;
  remarks?: string | null;
  registeredPropertyId?: string | null;
}

export interface UpdateCustomerInput {
  firstName?: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  address?: string | null;
  idProofType?: string | null;
  idProofNumber?: string | null;
  remarks?: string | null;
}

export type CustomerFilterTab = "ALL" | "IN_HOUSE" | "UPCOMING" | "REPEAT";

export interface CustomerFilterOptions {
  propertyId?: string;
  search?: string;
  tab?: CustomerFilterTab;
  page?: number;
  limit?: number;
}
