import { prisma } from "@/lib/prisma";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import {
  ExpenseHeadDTO,
  CreateExpenseHeadInput,
  UpdateExpenseHeadInput,
} from "./expenses.types";

export const DEFAULT_EXPENSE_HEADS = [
  {
    name: "Utilities (Electricity, Water, Gas)",
    code: "UTILITIES",
    description: "Monthly electricity, municipal water, gas cylinders, and piped utility expenses",
  },
  {
    name: "Repairs & Room Maintenance",
    code: "MAINTENANCE",
    description: "Plumbing, electrical, HVAC, painting, and room fixture maintenance",
  },
  {
    name: "Housekeeping & Guest Supplies",
    code: "SUPPLIES",
    description: "Linens, toiletries, detergents, cleaning chemicals, and guest amenities",
  },
  {
    name: "Kitchen & F&B Purchases",
    code: "FOOD_BEVERAGE",
    description: "Breakfast ingredients, pantry groceries, tea/coffee, and kitchen supplies",
  },
  {
    name: "Staff Welfare & Refreshments",
    code: "STAFF_WELFARE",
    description: "Staff meals, uniforms, tea/coffee, and welfare provisions",
  },
  {
    name: "Miscellaneous Operating Expenses",
    code: "MISC_EXPENSE",
    description: "General administrative, office stationary, and non-recurring hotel expenses",
  },
];

export class ExpenseHeadService {
  /**
   * Idempotently seeds standard default expense categories for a property.
   */
  static async seedDefaultExpenseHeads(
    propertyId: string,
    userId: string
  ): Promise<{ seededCount: number; heads: ExpenseHeadDTO[] }> {
    const existing = await prisma.expenseHead.findMany({
      where: { propertyId },
      select: { code: true },
    });

    const existingCodes = new Set(existing.map((h) => h.code.toUpperCase()));
    const missing = DEFAULT_EXPENSE_HEADS.filter((def) => !existingCodes.has(def.code));

    if (missing.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const cat of missing) {
          const head = await tx.expenseHead.create({
            data: {
              propertyId,
              name: cat.name,
              code: cat.code,
              description: cat.description,
              isActive: true,
            },
          });

          await tx.auditLog.create({
            data: {
              userId,
              entityType: "EXPENSE_HEAD",
              entityId: head.id,
              action: "SEED_DEFAULT_EXPENSE_HEAD",
              newData: { propertyId, code: cat.code, name: cat.name },
            },
          });
        }
      });
    }

    const allHeads = await this.listExpenseHeads(propertyId, true);
    return {
      seededCount: missing.length,
      heads: allHeads,
    };
  }

  /**
   * List all expense categories for a property.
   */
  static async listExpenseHeads(
    propertyId: string,
    includeInactive = false
  ): Promise<ExpenseHeadDTO[]> {
    const heads = await prisma.expenseHead.findMany({
      where: {
        propertyId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: "asc" },
    });

    return heads.map(this.formatHead);
  }

  /**
   * Get a single expense category by ID.
   */
  static async getExpenseHeadById(
    propertyId: string,
    id: string
  ): Promise<ExpenseHeadDTO> {
    const head = await prisma.expenseHead.findFirst({
      where: { id, propertyId },
    });

    if (!head) {
      throw new NotFoundError("Expense category not found");
    }

    return this.formatHead(head);
  }

  /**
   * Create a custom expense category for a property.
   */
  static async createExpenseHead(
    propertyId: string,
    input: CreateExpenseHeadInput,
    userId: string
  ): Promise<ExpenseHeadDTO> {
    const upperCode = input.code.trim().toUpperCase();

    const existingCode = await prisma.expenseHead.findFirst({
      where: { propertyId, code: upperCode },
    });

    if (existingCode) {
      throw new BadRequestError(`An expense category with code '${upperCode}' already exists for this property.`);
    }

    const head = await prisma.expenseHead.create({
      data: {
        propertyId,
        name: input.name.trim(),
        code: upperCode,
        description: input.description?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        entityType: "EXPENSE_HEAD",
        entityId: head.id,
        action: "CREATE_EXPENSE_HEAD",
        newData: {
          propertyId,
          name: head.name,
          code: head.code,
          description: head.description,
          isActive: head.isActive,
        },
      },
    });

    return this.formatHead(head);
  }

  /**
   * Update an existing expense category.
   * Invariant: Category code is strictly immutable after creation.
   */
  static async updateExpenseHead(
    propertyId: string,
    id: string,
    input: UpdateExpenseHeadInput & { code?: string },
    userId: string
  ): Promise<ExpenseHeadDTO> {
    if (input.code !== undefined) {
      throw new BadRequestError("Expense category code is immutable and cannot be modified.");
    }

    const existing = await prisma.expenseHead.findFirst({
      where: { id, propertyId },
    });

    if (!existing) {
      throw new NotFoundError("Expense category not found");
    }

    const updated = await prisma.expenseHead.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        description: input.description !== undefined ? (input.description?.trim() || null) : undefined,
        isActive: input.isActive !== undefined ? input.isActive : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        entityType: "EXPENSE_HEAD",
        entityId: updated.id,
        action: "UPDATE_EXPENSE_HEAD",
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

    return this.formatHead(updated);
  }

  /**
   * Delete or deactivate an expense category.
   * Invariant: Referenced categories cannot be deleted, even if all referencing expenses are VOID.
   */
  static async deleteOrDeactivateExpenseHead(
    propertyId: string,
    id: string,
    userId: string
  ): Promise<{ success: boolean; deactivated?: boolean; message?: string }> {
    const existing = await prisma.expenseHead.findFirst({
      where: { id, propertyId },
    });

    if (!existing) {
      throw new NotFoundError("Expense category not found");
    }

    // Check ALL referencing expenses (including VOID)
    const referencingCount = await prisma.expense.count({
      where: { expenseHeadId: id },
    });

    if (referencingCount > 0) {
      throw new BadRequestError(
        `Cannot delete expense category '${existing.name}' because it is referenced by ${referencingCount} expense record(s). Deactivate the category instead to preserve historical integrity.`
      );
    }

    try {
      await prisma.expenseHead.delete({
        where: { id },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          entityType: "EXPENSE_HEAD",
          entityId: id,
          action: "DELETE_EXPENSE_HEAD",
          oldData: {
            propertyId,
            name: existing.name,
            code: existing.code,
          },
        },
      });

      return { success: true };
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw new BadRequestError(
          `Cannot delete expense category '${existing.name}' due to existing historical references. Deactivate the category instead.`
        );
      }
      throw err;
    }
  }

  private static formatHead(head: {
    id: string;
    propertyId: string;
    name: string;
    code: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ExpenseHeadDTO {
    return {
      id: head.id,
      propertyId: head.propertyId,
      name: head.name,
      code: head.code,
      description: head.description,
      isActive: head.isActive,
      createdAt: head.createdAt.toISOString(),
      updatedAt: head.updatedAt.toISOString(),
    };
  }
}
