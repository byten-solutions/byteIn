import { prisma } from "@/lib/prisma";
import { RoleName } from "@prisma/client";
import { AuthService } from "@/modules/auth/auth.service";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import {
  CreateUserInput,
  UpdateUserInput,
  SafeUserDTO,
} from "./user.types";
import { createUserSchema, updateUserSchema } from "./user.validation";

export class UserService {
  /**
   * Transforms a Prisma user entity into a SafeUserDTO without exposing sensitive hashes.
   */
  private static toDTO(user: {
    id: string;
    name: string;
    email: string;
    roleId: string;
    role: { name: RoleName };
    status: string;
    mustChangePassword: boolean;
    tokenVersion: number;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): SafeUserDTO {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      role: user.role.name,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Lists all users in the system ordered by creation date ascending.
   */
  static async listUsers(): Promise<SafeUserDTO[]> {
    const users = await prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: "asc" },
    });
    return users.map((u) => this.toDTO(u));
  }

  /**
   * Retrieves a single user by ID.
   */
  static async getUserById(id: string): Promise<SafeUserDTO> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return this.toDTO(user);
  }

  /**
   * Creates a new staff user account with validation, password hashing, and audit logging.
   */
  static async createUser(
    input: CreateUserInput,
    adminUserId: string
  ): Promise<SafeUserDTO> {
    const validated = createUserSchema.parse(input);

    const existing = await prisma.user.findUnique({
      where: { email: validated.email },
    });
    if (existing) {
      throw new ConflictError(`A user with email '${validated.email}' already exists.`);
    }

    const role = await prisma.role.findUnique({
      where: { id: validated.roleId },
    });
    if (!role) {
      throw new BadRequestError(`Role with ID '${validated.roleId}' does not exist.`);
    }

    const passwordHash = await AuthService.hashPassword(validated.password);

    const user = await prisma.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        passwordHash,
        roleId: validated.roleId,
        status: validated.status || "ACTIVE",
        mustChangePassword: validated.mustChangePassword ?? false,
        tokenVersion: 1,
      },
      include: { role: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        entityType: "User",
        entityId: user.id,
        action: "USER_CREATED",
        newData: {
          name: user.name,
          email: user.email,
          role: user.role.name,
          status: user.status,
          mustChangePassword: user.mustChangePassword,
        },
      },
    });

    return this.toDTO(user);
  }

  /**
   * Updates an existing user with strict safeguards:
   * - Block self-disable (admin cannot disable own account)
   * - Block self-demote (admin cannot demote own account from ADMIN)
   * - Block demoting or disabling the last active Administrator
   */
  static async updateUser(
    targetUserId: string,
    input: UpdateUserInput,
    adminUserId: string
  ): Promise<SafeUserDTO> {
    const validated = updateUserSchema.parse(input);

    return prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        include: { role: true },
      });

      if (!targetUser) {
        throw new NotFoundError("User not found");
      }

      // 1. Invariant: Block self-disable
      if (targetUserId === adminUserId && validated.status && validated.status !== "ACTIVE") {
        throw new BadRequestError("Administrators cannot disable their own account.");
      }

      // 2. Invariant: Block self-demote
      if (targetUserId === adminUserId && validated.roleId && validated.roleId !== targetUser.roleId) {
        const newRole = await tx.role.findUnique({ where: { id: validated.roleId } });
        if (!newRole) {
          throw new BadRequestError(`Role with ID '${validated.roleId}' does not exist.`);
        }
        if (targetUser.role.name === RoleName.ADMIN && newRole.name !== RoleName.ADMIN) {
          throw new BadRequestError("Administrators cannot demote their own account from the ADMIN role.");
        }
      }

      // 3. Invariant: Block removing/demoting the last active administrator
      const isTargetActiveAdmin =
        targetUser.role.name === RoleName.ADMIN && targetUser.status === "ACTIVE";

      if (isTargetActiveAdmin) {
        const willBeDisabled = validated.status === "DISABLED";
        let willBeDemoted = false;
        if (validated.roleId && validated.roleId !== targetUser.roleId) {
          const newRole = await tx.role.findUnique({ where: { id: validated.roleId } });
          if (newRole && newRole.name !== RoleName.ADMIN) {
            willBeDemoted = true;
          }
        }

        if (willBeDisabled || willBeDemoted) {
          const activeAdminCount = await tx.user.count({
            where: {
              status: "ACTIVE",
              role: { name: RoleName.ADMIN },
            },
          });
          if (activeAdminCount <= 1) {
            throw new BadRequestError(
              "Cannot demote or disable the last active Administrator in the system."
            );
          }
        }
      }

      // Email uniqueness check if changed
      if (validated.email && validated.email !== targetUser.email) {
        const existing = await tx.user.findUnique({ where: { email: validated.email } });
        if (existing) {
          throw new ConflictError(`A user with email '${validated.email}' already exists.`);
        }
      }

      const updateData: Record<string, unknown> = {};
      if (validated.name !== undefined) updateData.name = validated.name;
      if (validated.email !== undefined) updateData.email = validated.email;
      if (validated.roleId !== undefined) updateData.roleId = validated.roleId;
      if (validated.status !== undefined) updateData.status = validated.status;
      if (validated.mustChangePassword !== undefined) {
        updateData.mustChangePassword = validated.mustChangePassword;
      }
      if (validated.password) {
        updateData.passwordHash = await AuthService.hashPassword(validated.password);
        updateData.tokenVersion = { increment: 1 };
      }

      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: updateData,
        include: { role: true },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          entityType: "User",
          entityId: updated.id,
          action: "USER_UPDATED",
          oldData: {
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role.name,
            status: targetUser.status,
            mustChangePassword: targetUser.mustChangePassword,
          },
          newData: {
            name: updated.name,
            email: updated.email,
            role: updated.role.name,
            status: updated.status,
            mustChangePassword: updated.mustChangePassword,
          },
        },
      });

      return this.toDTO(updated);
    });
  }

  /**
   * Deletes a user with safeguards:
   * - Block self-delete
   * - Block deleting the last active Administrator
   */
  static async deleteUser(targetUserId: string, adminUserId: string): Promise<void> {
    if (targetUserId === adminUserId) {
      throw new BadRequestError("Administrators cannot delete their own account.");
    }

    return prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        include: { role: true },
      });

      if (!targetUser) {
        throw new NotFoundError("User not found");
      }

      if (targetUser.role.name === RoleName.ADMIN && targetUser.status === "ACTIVE") {
        const activeAdminCount = await tx.user.count({
          where: {
            status: "ACTIVE",
            role: { name: RoleName.ADMIN },
          },
        });
        if (activeAdminCount <= 1) {
          throw new BadRequestError(
            "Cannot delete the last active Administrator in the system."
          );
        }
      }

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          entityType: "User",
          entityId: targetUserId,
          action: "USER_DELETED",
          oldData: {
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role.name,
            status: targetUser.status,
          },
        },
      });

      // Clear non-critical audit log references to allow clean deletion
      await tx.auditLog.deleteMany({ where: { userId: targetUserId } });
      await tx.user.delete({ where: { id: targetUserId } });
    });
  }
}
