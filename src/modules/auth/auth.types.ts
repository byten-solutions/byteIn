import { RoleName } from "@prisma/client";

export { RoleName };

export interface SafePropertySummary {
  id: string;
  name: string;
  status: string;
}

export interface SessionPayload {
  sub: string; // User ID
  email: string;
  name: string;
  role: RoleName;
  propertyId?: string | null;
  property?: SafePropertySummary | null;
  tokenVersion?: number;
  mustChangePassword?: boolean;
  iat?: number;
  exp?: number;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  propertyId?: string | null;
  property?: SafePropertySummary | null;
  status: string;
  mustChangePassword?: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthResult {
  user: SafeUser;
  token: string;
}
