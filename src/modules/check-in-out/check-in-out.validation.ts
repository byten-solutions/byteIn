import { z } from "zod";

export const checkInSchema = z.object({
  allocationId: z.string().trim().min(1, "Allocation ID is required"),
  verifiedIdType: z.string().trim().max(50).optional().nullable(),
  verifiedIdNumber: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const checkOutSchema = z.object({
  allocationId: z.string().trim().min(1, "Allocation ID is required"),
  notes: z.string().trim().max(500).optional().nullable(),
});
