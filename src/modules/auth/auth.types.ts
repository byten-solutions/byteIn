import { RoleName } from "@prisma/client";

export { RoleName };

export interface SessionPayload {
  sub: string; // User ID
  email: string;
  name: string;
  role: RoleName;
  iat?: number;
  exp?: number;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: SafeUser;
  token: string;
}
