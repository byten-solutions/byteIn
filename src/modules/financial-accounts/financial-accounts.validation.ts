import { z } from "zod";
import { AccountType } from "@prisma/client";

export const createFinancialAccountSchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  accountName: z
    .string()
    .trim()
    .min(1, "Account name is required")
    .max(100, "Account name cannot exceed 100 characters"),
  accountType: z
    .nativeEnum(AccountType, {
      message: "Invalid account type",
    })
    .default(AccountType.CASH),
  openingBalance: z
    .union([z.number(), z.string()])
    .default(0)
    .transform((val) => (typeof val === "string" ? val.trim() : String(val)))
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
      message: "Opening balance must be a non-negative number",
    }),
  openingBalanceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Opening balance date must be in YYYY-MM-DD format")
    .optional(),
  isDefault: z.boolean().default(false),
});

export const updateFinancialAccountSchema = z
  .object({
    accountName: z
      .string()
      .trim()
      .min(1, "Account name cannot be empty")
      .max(100, "Account name cannot exceed 100 characters")
      .optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.accountName !== undefined ||
      data.isDefault !== undefined ||
      data.isActive !== undefined,
    { message: "At least one field must be provided for update" }
  );

export const createAccountTransferSchema = z
  .object({
    propertyId: z.string().trim().min(1).optional(),
    fromAccountId: z.string().trim().min(1, "Source account is required"),
    toAccountId: z.string().trim().min(1, "Destination account is required"),
    amount: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? val.trim() : String(val)))
      .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: "Transfer amount must be strictly greater than zero",
      }),
    transferDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Transfer date must be in YYYY-MM-DD format")
      .optional(),
    description: z.string().trim().max(255, "Description cannot exceed 255 characters").optional(),
    referenceNumber: z.string().trim().max(100, "Reference number cannot exceed 100 characters").optional(),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "Source and destination accounts must be different",
    path: ["toAccountId"],
  });

export const accountStatementQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format")
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const listAccountsQuerySchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  accountType: z.nativeEnum(AccountType).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});

export const listTransfersQuerySchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format")
    .optional(),
});
