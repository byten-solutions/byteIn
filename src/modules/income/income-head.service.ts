import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NotFoundError, BadRequestError, ConflictError } from "@/lib/errors";
import {
  DEFAULT_INCOME_HEADS,
  type IncomeHeadDTO,
  type CreateIncomeHeadInput,
  type UpdateIncomeHeadInput,
  type IncomeHeadFilterParams,
} from "./income.types";

export class IncomeHeadService {
  /**
   * List all income heads (categories) for a property.
   */
  static async getIncomeHeads(
    propertyId: string,
    filters?: IncomeHeadFilterParams
  ): Promise<IncomeHeadDTO[]> {
    const heads = await prisma.incomeHead.findMany({
      where: {
        propertyId,
        ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
      },
      include: {
        _count: {
          select: { incomes: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return heads.map((h) => ({
      id: h.id,
      propertyId: h.propertyId,
      name: h.name,
      code: h.code,
      description: h.description,
      isActive: h.isActive,
      incomeCount: h._count.incomes,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
    }));
  }

  /**
   * Get an income head by ID scoped strictly to property.
   */
  static async getIncomeHeadById(
    propertyId: string,
    id: string
  ): Promise<IncomeHeadDTO> {
    const head = await prisma.incomeHead.findFirst({
      where: { id, propertyId },
      include: {
        _count: {
          select: { incomes: true },
        },
      },
    });

    if (!head) {
      throw new NotFoundError("Income category not found");
    }

    return {
      id: head.id,
      propertyId: head.propertyId,
      name: head.name,
      code: head.code,
      description: head.description,
      isActive: head.isActive,
      incomeCount: head._count.incomes,
      createdAt: head.createdAt.toISOString(),
      updatedAt: head.updatedAt.toISOString(),
    };
  }

  /**
   * Create a new income head for a property.
   */
  static async createIncomeHead(
    propertyId: string,
    input: CreateIncomeHeadInput,
    userId: string
  ): Promise<IncomeHeadDTO> {
    const code = input.code.toUpperCase().trim();

    // Check code uniqueness per property
    const existing = await prisma.incomeHead.findUnique({
      where: {
        propertyId_code: {
          propertyId,
          code,
        },
      },
    });

    if (existing) {
      throw new ConflictError(
        `Income category with code '${code}' already exists for this property.`
      );
    }

    const head = await prisma.incomeHead.create({
      data: {
        propertyId,
        name: input.name.trim(),
        code,
        description: input.description?.trim() || null,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        entityType: "INCOME_HEAD",
        entityId: head.id,
        action: "CREATE_INCOME_HEAD",
        newData: {
          propertyId,
          name: head.name,
          code: head.code,
        },
      },
    });

    return {
      id: head.id,
      propertyId: head.propertyId,
      name: head.name,
      code: head.code,
      description: head.description,
      isActive: head.isActive,
      incomeCount: 0,
      createdAt: head.createdAt.toISOString(),
      updatedAt: head.updatedAt.toISOString(),
    };
  }

  /**
   * Update an existing income head's name, description, or active status.
   * Note: The code slug is immutable to preserve financial history integrity.
   */
  static async updateIncomeHead(
    propertyId: string,
    id: string,
    input: UpdateIncomeHeadInput,
    userId: string
  ): Promise<IncomeHeadDTO> {
    if ("code" in input && (input as Record<string, unknown>).code !== undefined) {
      throw new BadRequestError(
        "Income category code is immutable and cannot be modified after creation."
      );
    }

    const existing = await prisma.incomeHead.findFirst({
      where: { id, propertyId },
    });

    if (!existing) {
      throw new NotFoundError("Income category not found");
    }

    const updated = await prisma.incomeHead.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: {
        _count: {
          select: { incomes: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        entityType: "INCOME_HEAD",
        entityId: updated.id,
        action: "UPDATE_INCOME_HEAD",
        oldData: {
          name: existing.name,
          description: existing.description,
          isActive: existing.isActive,
        },
        newData: {
          name: updated.name,
          description: updated.description,
          isActive: updated.isActive,
        },
      },
    });

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      name: updated.name,
      code: updated.code,
      description: updated.description,
      isActive: updated.isActive,
      incomeCount: updated._count.incomes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Delete an income head or prevent deletion if referenced by existing incomes.
   * Enforces that ANY referencing income (including VOID) completely prevents deletion.
   */
  static async deleteOrDeactivateIncomeHead(
    propertyId: string,
    id: string,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const existing = await prisma.incomeHead.findFirst({
      where: { id, propertyId },
    });

    if (!existing) {
      throw new NotFoundError("Income category not found");
    }

    // Check all referencing income records regardless of status (PENDING, PARTIALLY_RECEIVED, RECEIVED, VOID)
    const referencingIncomesCount = await prisma.income.count({
      where: { incomeHeadId: id },
    });

    if (referencingIncomesCount > 0) {
      throw new BadRequestError(
        `Cannot delete income category '${existing.name}' because it is referenced by ${referencingIncomesCount} income record(s) (including voided records). Deactivate it instead to preserve financial history.`
      );
    }

    try {
      await prisma.incomeHead.delete({
        where: { id },
      });
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2003"
      ) {
        throw new BadRequestError(
          `Cannot delete income category '${existing.name}' because it is referenced by existing income records. Deactivate it instead to preserve financial history.`
        );
      }
      throw err;
    }

    await prisma.auditLog.create({
      data: {
        userId,
        entityType: "INCOME_HEAD",
        entityId: id,
        action: "DELETE_INCOME_HEAD",
        oldData: {
          name: existing.name,
          code: existing.code,
        },
      },
    });

    return {
      success: true,
      message: `Income category '${existing.name}' successfully deleted.`,
    };
  }

  /**
   * Idempotently seeds default income heads for a hotel property.
   * Creates only missing categories; never overwrites administrator customizations.
   */
  static async seedDefaultIncomeHeads(
    propertyId: string,
    userId?: string
  ): Promise<{ seededCount: number }> {
    let seededCount = 0;

    for (const def of DEFAULT_INCOME_HEADS) {
      const existing = await prisma.incomeHead.findUnique({
        where: {
          propertyId_code: {
            propertyId,
            code: def.code,
          },
        },
      });

      if (!existing) {
        const head = await prisma.incomeHead.create({
          data: {
            propertyId,
            name: def.name,
            code: def.code,
            description: def.description,
            isActive: true,
          },
        });
        seededCount++;

        if (userId) {
          await prisma.auditLog.create({
            data: {
              userId,
              entityType: "INCOME_HEAD",
              entityId: head.id,
              action: "SEED_DEFAULT_INCOME_HEAD",
              newData: {
                propertyId,
                name: head.name,
                code: head.code,
              },
            },
          });
        }
      }
    }

    return { seededCount };
  }
}
