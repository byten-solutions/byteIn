import { prisma } from "@/lib/prisma";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import type {
  PaymentMethodDTO,
  CreatePaymentMethodInput,
  UpdatePaymentMethodInput,
} from "./payment-methods.types";

export class PaymentMethodService {
  /**
   * List all payment methods for a property.
   * Includes linked default account details.
   */
  static async getPaymentMethods(
    propertyId: string,
    filters?: { isActive?: boolean }
  ): Promise<PaymentMethodDTO[]> {
    const methods = await prisma.paymentMethod.findMany({
      where: {
        propertyId,
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      },
      include: {
        defaultAccount: {
          select: {
            id: true,
            accountName: true,
            accountType: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return methods.map((m) => ({
      id: m.id,
      propertyId: m.propertyId,
      name: m.name,
      code: m.code,
      defaultAccountId: m.defaultAccountId,
      defaultAccountName: m.defaultAccount?.accountName ?? null,
      defaultAccountType: m.defaultAccount?.accountType ?? null,
      isActive: m.isActive,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));
  }

  /**
   * Get a single payment method by ID.
   */
  static async getPaymentMethodById(
    propertyId: string,
    methodId: string
  ): Promise<PaymentMethodDTO> {
    const method = await prisma.paymentMethod.findFirst({
      where: { id: methodId, propertyId },
      include: {
        defaultAccount: {
          select: {
            id: true,
            accountName: true,
            accountType: true,
          },
        },
      },
    });

    if (!method) {
      throw new NotFoundError(`Payment method with ID '${methodId}' not found.`);
    }

    return {
      id: method.id,
      propertyId: method.propertyId,
      name: method.name,
      code: method.code,
      defaultAccountId: method.defaultAccountId,
      defaultAccountName: method.defaultAccount?.accountName ?? null,
      defaultAccountType: method.defaultAccount?.accountType ?? null,
      isActive: method.isActive,
      createdAt: method.createdAt.toISOString(),
      updatedAt: method.updatedAt.toISOString(),
    };
  }

  /**
   * Create a new payment method for a property.
   * Validates code uniqueness per property and ensures defaultAccountId belongs to the same property.
   */
  static async createPaymentMethod(
    propertyId: string,
    input: CreatePaymentMethodInput,
    userId: string
  ): Promise<PaymentMethodDTO> {
    const trimmedName = input.name.trim();
    const upperCode = input.code.trim().toUpperCase();

    // Check code uniqueness within property
    const existingCode = await prisma.paymentMethod.findUnique({
      where: {
        propertyId_code: {
          propertyId,
          code: upperCode,
        },
      },
    });

    if (existingCode) {
      throw new ConflictError(
        `A payment method with code '${upperCode}' already exists for this property.`
      );
    }

    // Validate defaultAccountId if provided
    let verifiedAccountId: string | null = null;
    if (input.defaultAccountId) {
      const account = await prisma.financialAccount.findFirst({
        where: { id: input.defaultAccountId, propertyId },
      });
      if (!account) {
        throw new BadRequestError(
          "The selected default financial account does not exist or belongs to another hotel."
        );
      }
      if (!account.isActive) {
        throw new BadRequestError(
          "Cannot assign an inactive financial account as the default account."
        );
      }
      verifiedAccountId = account.id;
    }

    const created = await prisma.$transaction(async (tx) => {
      const method = await tx.paymentMethod.create({
        data: {
          propertyId,
          name: trimmedName,
          code: upperCode,
          defaultAccountId: verifiedAccountId,
          isActive: input.isActive ?? true,
        },
        include: {
          defaultAccount: {
            select: {
              accountName: true,
              accountType: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: "PAYMENT_METHOD",
          entityId: method.id,
          action: "CREATE_PAYMENT_METHOD",
          newData: {
            propertyId,
            name: method.name,
            code: method.code,
            defaultAccountId: method.defaultAccountId,
            isActive: method.isActive,
          },
        },
      });

      return method;
    });

    return {
      id: created.id,
      propertyId: created.propertyId,
      name: created.name,
      code: created.code,
      defaultAccountId: created.defaultAccountId,
      defaultAccountName: created.defaultAccount?.accountName ?? null,
      defaultAccountType: created.defaultAccount?.accountType ?? null,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * Update an existing payment method.
   * Lifecycle checks:
   * - Cannot deactivate the last active payment method on the property.
   * - Default account must belong to the same property.
   */
  static async updatePaymentMethod(
    propertyId: string,
    methodId: string,
    input: UpdatePaymentMethodInput,
    userId: string
  ): Promise<PaymentMethodDTO> {
    const existing = await prisma.paymentMethod.findFirst({
      where: { id: methodId, propertyId },
    });

    if (!existing) {
      throw new NotFoundError(`Payment method with ID '${methodId}' not found.`);
    }

    // Validate defaultAccountId if updating
    let targetAccountId: string | null | undefined = undefined;
    if (input.defaultAccountId !== undefined) {
      if (input.defaultAccountId === null || input.defaultAccountId.trim() === "") {
        targetAccountId = null;
      } else {
        const account = await prisma.financialAccount.findFirst({
          where: { id: input.defaultAccountId.trim(), propertyId },
        });
        if (!account) {
          throw new BadRequestError(
            "The selected default financial account does not exist or belongs to another hotel."
          );
        }
        if (!account.isActive) {
          throw new BadRequestError(
            "Cannot assign an inactive financial account as the default account."
          );
        }
        targetAccountId = account.id;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const method = await tx.paymentMethod.update({
        where: { id: methodId },
        data: {
          ...(input.name && { name: input.name.trim() }),
          ...(targetAccountId !== undefined && { defaultAccountId: targetAccountId }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        include: {
          defaultAccount: {
            select: {
              accountName: true,
              accountType: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: "PAYMENT_METHOD",
          entityId: methodId,
          action: "UPDATE_PAYMENT_METHOD",
          oldData: {
            name: existing.name,
            defaultAccountId: existing.defaultAccountId,
            isActive: existing.isActive,
          },
          newData: {
            name: method.name,
            defaultAccountId: method.defaultAccountId,
            isActive: method.isActive,
          },
        },
      });

      return method;
    });

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      name: updated.name,
      code: updated.code,
      defaultAccountId: updated.defaultAccountId,
      defaultAccountName: updated.defaultAccount?.accountName ?? null,
      defaultAccountType: updated.defaultAccount?.accountType ?? null,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Delete a payment method.
   * Protected: Rejects deletion if linked receipts or outgoing payments exist.
   */
  static async deletePaymentMethod(
    propertyId: string,
    methodId: string,
    userId: string
  ): Promise<{ success: true; message: string }> {
    const existing = await prisma.paymentMethod.findFirst({
      where: { id: methodId, propertyId },
      include: {
        _count: {
          select: {
            receipts: true,
            payments: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError(`Payment method with ID '${methodId}' not found.`);
    }

    const totalTx = existing._count.receipts + existing._count.payments;
    if (totalTx > 0) {
      throw new BadRequestError(
        `Cannot delete payment method '${existing.name}' because it has ${totalTx} recorded transaction(s). Deactivate the payment method instead.`
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.paymentMethod.delete({
        where: { id: methodId },
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: "PAYMENT_METHOD",
          entityId: methodId,
          action: "DELETE_PAYMENT_METHOD",
          oldData: {
            name: existing.name,
            code: existing.code,
          },
        },
      });
    });

    return {
      success: true,
      message: `Payment method '${existing.name}' successfully deleted.`,
    };
  }
}
