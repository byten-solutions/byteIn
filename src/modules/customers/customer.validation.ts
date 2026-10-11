import { z } from "zod";

export const createCustomerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .optional()
    .nullable()
    .or(z.literal("")),
  nationality: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  idProofType: z.string().trim().max(50).optional().nullable(),
  idProofNumber: z.string().trim().max(100).optional().nullable(),
  remarks: z.string().trim().max(500).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();
