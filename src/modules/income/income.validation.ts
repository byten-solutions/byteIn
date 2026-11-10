import { z } from "zod";
import { IncomeStatus } from "@prisma/client";

// ----------------------------------------------------------------------------
// Income Heads (Categories) Schemas
// ----------------------------------------------------------------------------

export const createIncomeHeadSchema = z.object({
  propertyId: z.string().cuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(100, "Category name cannot exceed 100 characters"),
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(30, "Code cannot exceed 30 characters")
    .transform((val) => val.toUpperCase())
    .refine((val) => /^[A-Z0-9_]+$/.test(val), {
      message: "Code must contain only uppercase alphanumeric characters and underscores",
    }),
  description: z
    .string()
    .trim()
    .max(255, "Description cannot exceed 255 characters")
    .optional()
    .nullable(),
});

export const updateIncomeHeadSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Category name must be at least 2 characters")
      .max(100, "Category name cannot exceed 100 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(255, "Description cannot exceed 255 characters")
      .optional()
      .nullable(),
    isActive: z.boolean().optional(),
    code: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.code !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Income category code is immutable and cannot be modified.",
        path: ["code"],
      });
    }
  });

export const incomeHeadFilterSchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
});

// ----------------------------------------------------------------------------
// Direct Income Schemas
// ----------------------------------------------------------------------------

export const createIncomeSchema = z.object({
  propertyId: z.string().cuid().optional(),
  incomeHeadId: z.string().cuid("Invalid income head identifier"),
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(150, "Title cannot exceed 150 characters"),
  expectedAmount: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Expected amount must be a positive number greater than zero",
    })
    .refine((val) => val <= 100000000, {
      message: "Expected amount exceeds maximum allowable limit",
    }),
  incomeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Income date must be in YYYY-MM-DD format")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable(),
});

export const updateIncomeSchema = z.object({
  incomeHeadId: z.string().cuid("Invalid income head identifier").optional(),
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(150, "Title cannot exceed 150 characters")
    .optional(),
  expectedAmount: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Expected amount must be a positive number greater than zero",
    })
    .refine((val) => val <= 100000000, {
      message: "Expected amount exceeds maximum allowable limit",
    })
    .optional(),
  incomeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Income date must be in YYYY-MM-DD format")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable(),
});

export const voidIncomeSchema = z.object({
  voidReason: z
    .string()
    .trim()
    .min(3, "Void reason must be at least 3 characters")
    .max(255, "Void reason cannot exceed 255 characters"),
});

// ----------------------------------------------------------------------------
// Income Receipts (Collections) Schemas
// ----------------------------------------------------------------------------

export const recordIncomeReceiptSchema = z.object({
  amount: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Receipt collection amount must be greater than zero",
    })
    .refine((val) => val <= 100000000, {
      message: "Amount exceeds maximum allowable limit",
    }),
  accountId: z.string().cuid("Invalid destination financial account identifier"),
  paymentMethod: z
    .string()
    .trim()
    .min(1, "Payment method is required")
    .max(50, "Payment method cannot exceed 50 characters"),
  paymentMethodId: z.string().cuid().optional().nullable(),
  referenceNumber: z
    .string()
    .trim()
    .max(100, "Reference number cannot exceed 100 characters")
    .optional()
    .nullable(),
  paidAt: z
    .string()
    .optional()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      "Collection date must be a valid date string"
    ),
  idempotencyKey: z
    .string()
    .trim()
    .max(100, "Idempotency key cannot exceed 100 characters")
    .optional()
    .nullable(),
});

export const voidIncomeReceiptSchema = z.object({
  voidReason: z
    .string()
    .trim()
    .min(3, "Void reason must be at least 3 characters")
    .max(255, "Void reason cannot exceed 255 characters"),
});

export const incomeFilterSchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD")
    .optional(),
  incomeHeadId: z.string().cuid().optional(),
  status: z.union([z.literal("ALL"), z.nativeEnum(IncomeStatus)]).optional(),
  search: z.string().trim().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 20)) : 20)),
});
