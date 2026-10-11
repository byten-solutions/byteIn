import { z } from "zod";
import { RoomStatus } from "@prisma/client";

export const createCategorySchema = z.object({
  propertyId: z.string().trim().min(1).optional().nullable(),
  name: z.string().trim().min(1, "Category name is required").max(100),
  description: z.string().trim().max(255).optional().nullable(),
  basePrice: z
    .union([z.number(), z.string()])
    .refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0;
    }, "Base price must be a non-negative number")
    .transform((val) => Number(val).toFixed(2)),
  maxOccupancy: z.coerce
    .number()
    .int("Max occupancy must be an integer")
    .min(1, "Max occupancy must be at least 1"),
  amenityIds: z.array(z.string().trim()).optional().default([]),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createAmenitySchema = z.object({
  name: z.string().trim().min(1, "Amenity name is required").max(100),
  description: z.string().trim().max(255).optional().nullable(),
});

export const createRoomSchema = z.object({
  propertyId: z.string().trim().min(1, "Property ID is required"),
  buildingId: z.string().trim().min(1, "Building ID is required"),
  floorId: z.string().trim().min(1, "Floor ID is required"),
  roomCategoryId: z.string().trim().min(1, "Room Category ID is required"),
  roomNo: z.string().trim().min(1, "Room number is required").max(50),
  displayName: z.string().trim().max(100).optional().nullable(),
  capacity: z.coerce
    .number()
    .int("Capacity must be an integer")
    .min(1, "Capacity must be at least 1"),
  status: z.nativeEnum(RoomStatus).optional().default(RoomStatus.VACANT_CLEAN),
  priceOverride: z
    .union([z.number(), z.string()])
    .refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0;
    }, "Price override must be a non-negative number")
    .transform((val) => Number(val).toFixed(2))
    .optional()
    .nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const updateRoomSchema = createRoomSchema.partial();

export const updateRoomStatusSchema = z.object({
  status: z.nativeEnum(RoomStatus, {
    message: "Invalid room status",
  }),
  notes: z.string().trim().max(500).optional().nullable(),
});
