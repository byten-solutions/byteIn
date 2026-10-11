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

export interface CustomerFilterOptions {
  search?: string;
  page?: number;
  limit?: number;
}
