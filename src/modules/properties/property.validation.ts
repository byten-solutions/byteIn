import { z } from "zod";

export const createPropertySchema = z.object({
  name: z.string().trim().min(1, "Property name is required").max(100),
  address: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email("Invalid email").optional().nullable().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
});

export const updatePropertySchema = createPropertySchema.partial();

export const createBuildingSchema = z.object({
  name: z.string().trim().min(1, "Building name is required").max(100),
  description: z.string().trim().max(255).optional().nullable(),
});

export const createFloorSchema = z.object({
  floorNo: z.coerce.number().int("Floor number must be an integer"),
  name: z.string().trim().max(100).optional().nullable(),
});
