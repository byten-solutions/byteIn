import { z } from "zod";
import { InvoiceItemType, InvoiceStatus } from "@prisma/client";

export const createInvoiceSchema = z.object({
  reservationId: z.string().min(1, "Reservation ID is required"),
  discountTotal: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => (val !== undefined ? String(val) : "0.00")),
  taxTotal: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => (val !== undefined ? String(val) : "0.00")),
  autoIssue: z.boolean().optional().default(false),
});

export const addInvoiceItemSchema = z.object({
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
  reservationRoomId: z.string().optional(),
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
