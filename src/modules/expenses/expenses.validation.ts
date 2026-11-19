import { z } from "zod";
import { ExpenseStatus } from "@prisma/client";

export const createExpenseHeadSchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, "Category name is required").max(100, "Category name cannot exceed 100 characters"),
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(30, "Code cannot exceed 30 characters")
    .regex(/^[A-Z0-9_]+$/, "Code must contain only uppercase letters, numbers, and underscores"),
  description: z.string().trim().max(255).optional(),
  isActive: z.boolean().optional().default(true),
});

export const expenseHeadFilterSchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  includeInactive: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .optional(),
});

export const updateExpenseHeadSchema = z
  .object({
    propertyId: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1, "Category name cannot be empty").max(100).optional(),
    description: z.string().trim().max(255).nullable().optional(),
    isActive: z.boolean().optional(),
    code: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if ("code" in data && data.code !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expense category code is immutable and cannot be modified.",
        path: ["code"],
      });
    }
  });

export const createExpenseSchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  expenseHeadId: z.string().trim().min(1, "Expense category is required"),
  title: z.string().trim().min(1, "Expense title is required").max(200, "Title cannot exceed 200 characters"),
  description: z.string().trim().max(500).optional(),
  amount: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Expense amount must be strictly greater than zero",
    })
    .refine((val) => val <= 100000000, {
      message: "Amount exceeds maximum permitted limit",
    }),
  vendorName: z.string().trim().max(100).optional(),
  referenceNumber: z.string().trim().max(100).optional(),
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expense date must be formatted as YYYY-MM-DD")
    .optional(),
});

export const updateExpenseSchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  expenseHeadId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  amount: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Expense amount must be strictly greater than zero",
    })
    .refine((val) => val <= 100000000, {
      message: "Amount exceeds maximum permitted limit",
    })
    .optional(),
  vendorName: z.string().trim().max(100).nullable().optional(),
  referenceNumber: z.string().trim().max(100).nullable().optional(),
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expense date must be formatted as YYYY-MM-DD")
    .optional(),
});

export const recordExpensePaymentSchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  accountId: z.string().trim().min(1, "Financial account is required"),
  paymentMethodId: z.string().trim().min(1).optional(),
  paymentMethodCode: z.string().trim().min(1).optional(),
  amount: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Payment amount must be strictly greater than zero",
    })
    .refine((val) => val <= 100000000, {
      message: "Payment amount exceeds maximum permitted limit",
    }),
  referenceNumber: z.string().trim().max(100).optional(),
  idempotencyKey: z.string().trim().max(255).optional(),
  paidAt: z.string().optional(),
});

export const voidExpensePaymentSchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  voidReason: z
    .string()
    .trim()
    .min(3, "Void reason must be at least 3 characters")
    .max(255, "Void reason cannot exceed 255 characters"),
});

export const voidExpenseSchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  voidReason: z
    .string()
    .trim()
    .min(3, "Void reason must be at least 3 characters")
    .max(255, "Void reason cannot exceed 255 characters"),
});

export const expenseFilterSchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.union([z.literal("ALL"), z.nativeEnum(ExpenseStatus)]).optional(),
  expenseHeadId: z.string().trim().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().optional(),
  summary: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .optional(),
});
