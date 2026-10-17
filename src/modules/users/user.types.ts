import { RoleName } from "@prisma/client";

export interface SafeUserDTO {
  id: string;
  name: string;
  email: string;
  roleId: string;
  role: RoleName;
  status: string;
  mustChangePassword: boolean;
  tokenVersion: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  roleId: string;
  status?: string;
  mustChangePassword?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  roleId?: string;
  status?: string;
  mustChangePassword?: boolean;
}
