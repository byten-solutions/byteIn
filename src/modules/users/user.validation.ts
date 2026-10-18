import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, "Password must contain at least one special character"),
  roleId: z.string().min(1, "Role ID is required"),
  propertyId: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional().default("ACTIVE"),
  mustChangePassword: z.boolean().optional().default(false),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/)
    .optional(),
  roleId: z.string().optional(),
  propertyId: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  mustChangePassword: z.boolean().optional(),
});
