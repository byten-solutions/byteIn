import { RoleName } from "@prisma/client";

export interface SafePropertySummary {
  id: string;
  name: string;
  status: string;
}

export interface SafeUserDTO {
  id: string;
  name: string;
  email: string;
  roleId: string;
  role: RoleName;
  propertyId: string | null;
  property?: SafePropertySummary | null;
  status: string;
  mustChangePassword: boolean;
  tokenVersion: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserFilterOptions {
  propertyId?: string;
  role?: RoleName;
  status?: string;
  search?: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  roleId: string;
  propertyId?: string | null;
  status?: string;
  mustChangePassword?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  roleId?: string;
  propertyId?: string | null;
  status?: string;
  mustChangePassword?: boolean;
}
