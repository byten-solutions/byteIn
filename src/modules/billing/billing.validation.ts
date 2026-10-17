import { z } from "zod";
import { InvoiceItemType, InvoiceStatus } from "@prisma/client";

export const createInvoiceSchema = z
  .object({
    reservationId: z.string().min(1, "Reservation ID is required"),
    discountTotal: z
      .union([z.number(), z.string()])
      .optional()
      .transform((val) => (val !== undefined ? String(val) : "0.00")),
    discountReason: z
      .string()
      .trim()
      .min(3, "Discount reason is required and must be at least 3 characters")
      .optional(),
    taxTotal: z
      .union([z.number(), z.string()])
      .optional()
      .transform((val) => (val !== undefined ? String(val) : "0.00")),
    autoIssue: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      const discountNum = parseFloat(data.discountTotal || "0");
      if (discountNum > 0) {
        return Boolean(data.discountReason && data.discountReason.length >= 3);
      }
      return true;
    },
    {
      message: "Discount reason is required (at least 3 characters) when applying a discount",
      path: ["discountReason"],
    }
  );

export const addInvoiceItemSchema = z
  .object({
    description: z.string().min(1, "Description is required").max(255),
    quantity: z
      .union([z.number(), z.string()])
      .transform((val) => Number(val))
      .refine((n) => !isNaN(n) && n > 0, "Quantity must be a positive number"),
    unitPrice: z
      .union([z.number(), z.string()])
      .transform((val) => Number(val))
      .refine((n) => !isNaN(n) && n >= 0, "Unit price must be non-negative"),
    itemType: z
      .nativeEnum(InvoiceItemType)
      .optional()
      .default(InvoiceItemType.EXTRA_CHARGE),
    reason: z
      .string()
      .trim()
      .min(3, "Reason must be at least 3 characters")
      .optional(),
    reservationRoomId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.itemType === InvoiceItemType.DISCOUNT) {
        return Boolean(data.reason && data.reason.length >= 3);
      }
      return true;
    },
    {
      message: "A reason is required (at least 3 characters) when adding a discount line item",
      path: ["reason"],
    }
  );

export const updateInvoiceItemSchema = z
  .object({
    description: z.string().min(1, "Description is required").max(255).optional(),
    quantity: z
      .union([z.number(), z.string()])
      .transform((val) => Number(val))
      .refine((n) => !isNaN(n) && n > 0, "Quantity must be a positive number")
      .optional(),
    unitPrice: z
      .union([z.number(), z.string()])
      .transform((val) => Number(val))
      .refine((n) => !isNaN(n) && n >= 0, "Unit price must be non-negative")
      .optional(),
    itemType: z.nativeEnum(InvoiceItemType).optional(),
    reason: z
      .string()
      .trim()
      .min(3, "Reason must be at least 3 characters")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.itemType === InvoiceItemType.DISCOUNT) {
        return Boolean(data.reason && data.reason.length >= 3);
      }
      return true;
    },
    {
      message: "A reason is required (at least 3 characters) when editing to a discount line item",
      path: ["reason"],
    }
  );

export const voidPaymentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Void reason is required and must be at least 3 characters")
    .max(500, "Void reason cannot exceed 500 characters"),
});

export const recordPaymentSchema = z.object({
  amount: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val))
    .refine((n) => !isNaN(n) && n > 0, "Payment amount must be greater than 0"),
  paymentMethod: z
    .string()
    .min(1, "Payment method is required")
    .max(50),
  referenceNumber: z.string().max(100).optional().nullable(),
  idempotencyKey: z.string().max(128).optional().nullable(),
  paidAt: z.string().datetime({ offset: true }).optional().or(z.string().optional()),
});

export const invoiceListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  reservationId: z.string().optional(),
  customerId: z.string().optional(),
});
