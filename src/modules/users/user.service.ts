import { prisma } from "@/lib/prisma";
import { RoleName, Prisma } from "@prisma/client";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { AuthService } from "@/modules/auth/auth.service";
import type { SessionPayload } from "@/modules/auth/auth.types";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import {
  CreateUserInput,
  UpdateUserInput,
  SafeUserDTO,
  UserFilterOptions,
} from "./user.types";
import { createUserSchema, updateUserSchema } from "./user.validation";

export class UserService {
  /**
   * Resolves the calling actor session if passed as an ID string.
   */
  private static async resolveActorSession(
    actor: SessionPayload | string
  ): Promise<SessionPayload> {
    if (typeof actor !== "string") {
      return actor;
    }
    const user = await prisma.user.findUnique({
      where: { id: actor },
      include: {
        role: true,
        property: {
          select: { id: true, name: true, status: true },
        },
      },
    });
    if (!user) {
      throw new NotFoundError("Actor user not found");
    }
    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name as RoleName,
      propertyId: user.propertyId,
      property: user.property,
      tokenVersion: user.tokenVersion,
    };
  }

  /**
   * Transforms a Prisma user entity into a SafeUserDTO without exposing sensitive hashes.
   */
  private static toDTO(user: {
    id: string;
    name: string;
    email: string;
    roleId: string;
    role: { name: RoleName };
    propertyId?: string | null;
    property?: { id: string; name: string; status: string } | null;
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
      propertyId: user.propertyId || null,
      property: user.property
        ? {
            id: user.property.id,
            name: user.property.name,
            status: user.property.status,
          }
        : null,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Lists users based on actor role and filters:
   * - SUPER_ADMIN: Can view users across all hotels and filter by propertyId, role, status.
   * - ADMIN (Hotel Admin): Scoped strictly to their assigned hotel. Cannot view Super Admins.
   */
  static async listUsers(
    actorSession?: SessionPayload,
    filters?: UserFilterOptions
  ): Promise<SafeUserDTO[]> {
    const where: Record<string, unknown> = {};

    if (actorSession) {
      if (actorSession.role === RoleName.ADMIN) {
        if (actorSession.propertyId) {
          where.propertyId = actorSession.propertyId;
        }
        where.role = { name: { not: RoleName.SUPER_ADMIN } };
      } else if (actorSession.role === RoleName.SUPER_ADMIN) {
        if (filters?.propertyId) {
          where.propertyId = filters.propertyId === "GLOBAL" ? null : filters.propertyId;
        }
        if (filters?.role) {
          where.role = { name: filters.role };
        }
      } else {
        throw new ForbiddenError("Insufficient permissions to list users.");
      }
    } else {
      if (filters?.propertyId) {
        where.propertyId = filters.propertyId;
      }
      if (filters?.role) {
        where.role = { name: filters.role };
      }
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        role: true,
        property: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: [{ role: { name: "asc" } }, { createdAt: "asc" }],
    });

    return users.map((u) => this.toDTO(u));
  }

  /**
   * Lists users with pagination and total count.
   */
  static async listUsersPage(
    actorSession?: SessionPayload,
    filters?: UserFilterOptions
  ): Promise<{
    users: SafeUserDTO[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, filters?.page || 1);
    const limit = Math.min(100, Math.max(1, filters?.limit || DEFAULT_PAGE_SIZE));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (actorSession) {
      if (actorSession.role === RoleName.ADMIN) {
        if (actorSession.propertyId) {
          where.propertyId = actorSession.propertyId;
        }
        where.role = { name: { not: RoleName.SUPER_ADMIN } };
      } else if (actorSession.role === RoleName.SUPER_ADMIN) {
        if (filters?.propertyId) {
          where.propertyId = filters.propertyId === "GLOBAL" ? null : filters.propertyId;
        }
        if (filters?.role) {
          where.role = { name: filters.role };
        }
      } else {
        throw new ForbiddenError("Insufficient permissions to list users.");
      }
    } else {
      if (filters?.propertyId) {
        where.propertyId = filters.propertyId;
      }
      if (filters?.role) {
        where.role = { name: filters.role };
      }
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          role: true,
          property: {
            select: { id: true, name: true, status: true },
          },
        },
        orderBy: [{ role: { name: "asc" } }, { createdAt: "asc" }],
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => this.toDTO(u)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves a single user by ID with hotel scope validation.
   */
  static async getUserById(
    id: string,
    actorSession?: SessionPayload
  ): Promise<SafeUserDTO> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        property: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (actorSession) {
      if (actorSession.role === RoleName.ADMIN) {
        if (
          user.role.name === RoleName.SUPER_ADMIN ||
          (actorSession.propertyId &&
            user.propertyId &&
            user.propertyId !== actorSession.propertyId)
        ) {
          throw new NotFoundError("User not found");
        }
      } else if (actorSession.role !== RoleName.SUPER_ADMIN) {
        throw new ForbiddenError("Insufficient permissions to view user details.");
      }
    }

    return this.toDTO(user);
  }

  /**
   * Creates a new staff user account with validation, password hashing, and audit logging:
   * - SUPER_ADMIN: Can create SUPER_ADMIN (propertyId = null), ADMIN, or RECEPTIONIST.
   * - ADMIN: Can ONLY create RECEPTIONIST accounts for their assigned hotel.
   */
  static async createUser(
    input: CreateUserInput,
    actorParam: SessionPayload | string
  ): Promise<SafeUserDTO> {
    const actorSession = await this.resolveActorSession(actorParam);
    const validated = createUserSchema.parse(input);

    const existing = await prisma.user.findUnique({
      where: { email: validated.email },
    });
    if (existing) {
      throw new ConflictError(`A user with email '${validated.email}' already exists.`);
    }

    const targetRole = await prisma.role.findUnique({
      where: { id: validated.roleId },
    });
    if (!targetRole) {
      throw new BadRequestError(`Role with ID '${validated.roleId}' does not exist.`);
    }

    let assignedPropertyId: string | null = null;

    if (actorSession.role === RoleName.ADMIN) {
      if (targetRole.name === RoleName.SUPER_ADMIN) {
        throw new ForbiddenError("Hotel Administrators cannot create Super Admins.");
      }
      if (targetRole.name !== RoleName.RECEPTIONIST) {
        throw new ForbiddenError(
          "Hotel Administrators can only create Receptionist accounts for their hotel."
        );
      }
      if (
        validated.propertyId &&
        actorSession.propertyId &&
        validated.propertyId !== actorSession.propertyId
      ) {
        throw new ForbiddenError("Cannot create staff for another property.");
      }
      assignedPropertyId = actorSession.propertyId || null;
    } else if (actorSession.role === RoleName.SUPER_ADMIN) {
      if (targetRole.name === RoleName.SUPER_ADMIN) {
        assignedPropertyId = null;
      } else {
        assignedPropertyId = validated.propertyId || null;
      }
    } else {
      throw new ForbiddenError("Insufficient permissions to create users.");
    }

    if (assignedPropertyId) {
      const prop = await prisma.property.findUnique({ where: { id: assignedPropertyId } });
      if (!prop) {
        throw new BadRequestError("The assigned hotel does not exist.");
      }
    }

    const passwordHash = await AuthService.hashPassword(validated.password);

    const user = await prisma.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        passwordHash,
        roleId: validated.roleId,
        propertyId: assignedPropertyId,
        status: validated.status || "ACTIVE",
        mustChangePassword: validated.mustChangePassword ?? false,
        tokenVersion: 1,
      },
      include: {
        role: true,
        property: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: actorSession.sub,
        entityType: "User",
        entityId: user.id,
        action: "USER_CREATED",
        newData: {
          name: user.name,
          email: user.email,
          role: user.role.name,
          propertyId: user.propertyId,
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
   * - Block self-demote (admin cannot demote own account from ADMIN/SUPER_ADMIN)
   * - Block demoting or disabling the last active Administrator/Super Admin
   * - Hotel Admin can only update staff within their hotel
   */
  static async updateUser(
    targetUserId: string,
    input: UpdateUserInput,
    actorParam: SessionPayload | string
  ): Promise<SafeUserDTO> {
    const actorSession = await this.resolveActorSession(actorParam);
    const validated = updateUserSchema.parse(input);

    return prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        include: { role: true },
      });

      if (!targetUser) {
        throw new NotFoundError("User not found");
      }

      // Check actor boundaries
      if (actorSession.role === RoleName.ADMIN) {
        if (
          targetUser.role.name === RoleName.SUPER_ADMIN ||
          (actorSession.propertyId &&
            targetUser.propertyId &&
            targetUser.propertyId !== actorSession.propertyId)
        ) {
          throw new NotFoundError("User not found");
        }
        if (
          validated.propertyId !== undefined &&
          validated.propertyId !== targetUser.propertyId
        ) {
          throw new ForbiddenError(
            "Hotel Administrators cannot modify hotel assignments."
          );
        }
        if (validated.roleId && validated.roleId !== targetUser.roleId) {
          const newRole = await tx.role.findUnique({ where: { id: validated.roleId } });
          if (!newRole || newRole.name === RoleName.SUPER_ADMIN) {
            throw new ForbiddenError(
              "Hotel Administrators cannot promote users to Super Admin."
            );
          }
        }
      } else if (actorSession.role !== RoleName.SUPER_ADMIN) {
        throw new ForbiddenError("Insufficient permissions to update users.");
      }

      // 1. Invariant: Block self-disable
      if (
        targetUserId === actorSession.sub &&
        validated.status &&
        validated.status !== "ACTIVE"
      ) {
        throw new BadRequestError("Administrators cannot disable their own account.");
      }

      // 2. Invariant: Block self-demote
      if (
        targetUserId === actorSession.sub &&
        validated.roleId &&
        validated.roleId !== targetUser.roleId
      ) {
        const newRole = await tx.role.findUnique({ where: { id: validated.roleId } });
        if (!newRole) {
          throw new BadRequestError(`Role with ID '${validated.roleId}' does not exist.`);
        }
        if (
          targetUser.role.name === RoleName.SUPER_ADMIN &&
          newRole.name !== RoleName.SUPER_ADMIN
        ) {
          throw new BadRequestError("Super Administrators cannot demote their own account.");
        }
        if (
          targetUser.role.name === RoleName.ADMIN &&
          newRole.name !== RoleName.ADMIN
        ) {
          throw new BadRequestError("Hotel Administrators cannot demote their own account.");
        }
      }

      // 3. Invariant: Block removing/demoting the last active SUPER_ADMIN or ADMIN
      if (
        (targetUser.role.name === RoleName.SUPER_ADMIN ||
          targetUser.role.name === RoleName.ADMIN) &&
        targetUser.status === "ACTIVE"
      ) {
        const willBeDisabled = validated.status === "DISABLED";
        let willBeDemoted = false;
        if (validated.roleId && validated.roleId !== targetUser.roleId) {
          const newRole = await tx.role.findUnique({ where: { id: validated.roleId } });
          if (newRole && newRole.name !== targetUser.role.name) {
            willBeDemoted = true;
          }
        }

        if (willBeDisabled || willBeDemoted) {
          const activeCount = await tx.user.count({
            where: {
              status: "ACTIVE",
              role: { name: targetUser.role.name },
            },
          });
          if (activeCount <= 1) {
            throw new BadRequestError(
              `Cannot demote or disable the last active ${
                targetUser.role.name === RoleName.SUPER_ADMIN
                  ? "Super Administrator"
                  : "Administrator"
              } in the system.`
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
      if (validated.propertyId !== undefined) {
        updateData.propertyId = validated.propertyId;
      }
      let shouldIncrementToken = false;
      if (validated.password) {
        updateData.passwordHash = await AuthService.hashPassword(validated.password);
        shouldIncrementToken = true;
      }
      if (
        (validated.status !== undefined && validated.status !== targetUser.status) ||
        (validated.roleId !== undefined && validated.roleId !== targetUser.roleId) ||
        (validated.propertyId !== undefined && validated.propertyId !== targetUser.propertyId)
      ) {
        shouldIncrementToken = true;
      }
      if (shouldIncrementToken) {
        updateData.tokenVersion = { increment: 1 };
      }

      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: updateData,
        include: {
          role: true,
          property: {
            select: { id: true, name: true, status: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorSession.sub,
          entityType: "User",
          entityId: updated.id,
          action: "USER_UPDATED",
          oldData: {
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role.name,
            propertyId: targetUser.propertyId,
            status: targetUser.status,
            mustChangePassword: targetUser.mustChangePassword,
          },
          newData: {
            name: updated.name,
            email: updated.email,
            role: updated.role.name,
            propertyId: updated.propertyId,
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
   * - Block deleting the last active Administrator or Super Admin
   * - Hotel Admin can only delete users in their hotel
   */
  static async deleteUser(
    targetUserId: string,
    actorParam: SessionPayload | string
  ): Promise<void> {
    const actorSession = await this.resolveActorSession(actorParam);

    if (targetUserId === actorSession.sub) {
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

      if (actorSession.role === RoleName.ADMIN) {
        if (
          targetUser.role.name === RoleName.SUPER_ADMIN ||
          (actorSession.propertyId &&
            targetUser.propertyId &&
            targetUser.propertyId !== actorSession.propertyId)
        ) {
          throw new NotFoundError("User not found");
        }
      } else if (actorSession.role !== RoleName.SUPER_ADMIN) {
        throw new ForbiddenError("Insufficient permissions to delete users.");
      }

      if (
        (targetUser.role.name === RoleName.SUPER_ADMIN ||
          targetUser.role.name === RoleName.ADMIN) &&
        targetUser.status === "ACTIVE"
      ) {
        const activeCount = await tx.user.count({
          where: {
            status: "ACTIVE",
            role: { name: targetUser.role.name },
          },
        });
        if (activeCount <= 1) {
          throw new BadRequestError(
            `Cannot delete the last active ${
              targetUser.role.name === RoleName.SUPER_ADMIN
                ? "Super Administrator"
                : "Administrator"
            } in the system.`
          );
        }
      }

      await tx.auditLog.create({
        data: {
          userId: actorSession.sub,
          entityType: "User",
          entityId: targetUserId,
          action: "USER_DELETED",
          oldData: {
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role.name,
            propertyId: targetUser.propertyId,
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
