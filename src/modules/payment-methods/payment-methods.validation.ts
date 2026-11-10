import { z } from "zod";

export const createPaymentMethodSchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  name: z
    .string()
    .trim()
    .min(1, "Payment method name is required")
    .max(50, "Payment method name cannot exceed 50 characters"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Payment method code is required")
    .max(30, "Payment method code cannot exceed 30 characters")
    .regex(
      /^[A-Z0-9_]+$/,
      "Code must contain only uppercase alphanumeric characters and underscores"
    ),
  defaultAccountId: z
    .string()
    .trim()
    .nullable()
    .optional(),
  isActive: z.boolean().default(true),
});

export const updatePaymentMethodSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Payment method name cannot be empty")
      .max(50, "Payment method name cannot exceed 50 characters")
      .optional(),
    defaultAccountId: z
      .string()
      .trim()
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.defaultAccountId !== undefined ||
      data.isActive !== undefined,
    { message: "At least one field must be provided for update" }
  );

export const listPaymentMethodsQuerySchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});
