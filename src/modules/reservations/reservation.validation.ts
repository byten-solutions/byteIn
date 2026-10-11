import { z } from "zod";
import { createCustomerSchema } from "../customers/customer.validation";

// Helper to normalize and validate dates
export function normalizeDate(value: unknown): Date {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      throw new Error("Invalid date");
    }
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value === "string") {
    // Check YYYY-MM-DD or ISO string format
    const trimmed = value.trim();
    const parts = trimmed.split("T")[0].split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
  }
  throw new Error("Invalid date format. Expected YYYY-MM-DD");
}

export const dateSchema = z
  .union([z.string(), z.date()])
  .transform((val, ctx) => {
    try {
      return normalizeDate(val);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid date format. Expected YYYY-MM-DD",
      });
      return z.NEVER;
    }
  });

export const checkAvailabilitySchema = z
  .object({
    arrivalDate: dateSchema,
    departureDate: dateSchema,
    propertyId: z.string().trim().min(1).optional(),
    roomCategoryId: z.string().trim().min(1).optional(),
    minCapacity: z.coerce.number().int().positive().optional(),
  })
  .refine(
    (data) => data.departureDate.getTime() > data.arrivalDate.getTime(),
    {
      message: "Departure date must be after arrival date",
      path: ["departureDate"],
    }
  );

export const roomAllocationSchema = z
  .object({
    roomId: z.string().trim().min(1, "Room ID is required"),
    roomCategoryId: z.string().trim().min(1).optional(),
    arrivalDate: dateSchema,
    departureDate: dateSchema,
    bookedNightlyRate: z
      .union([z.number(), z.string()])
      .refine(
        (val) => {
          const num = typeof val === "number" ? val : parseFloat(val);
          return !isNaN(num) && num >= 0;
        },
        { message: "Nightly rate must be a non-negative number" }
      )
      .optional(),
    adults: z.coerce.number().int().min(1, "At least 1 adult required").default(1),
    children: z.coerce.number().int().min(0, "Children cannot be negative").default(0),
  })
  .refine(
    (data) => data.departureDate.getTime() > data.arrivalDate.getTime(),
    {
      message: "Departure date must be after arrival date",
      path: ["departureDate"],
    }
  );

export const createReservationSchema = z
  .object({
    customerId: z.string().trim().min(1).optional(),
    newCustomer: createCustomerSchema.optional(),
    specialRequests: z.string().trim().max(1000).optional().nullable(),
    allocations: z
      .array(roomAllocationSchema)
      .min(1, "At least one room allocation is required"),
  })
  .refine(
    (data) => Boolean(data.customerId || data.newCustomer),
    {
      message: "Either an existing customerId or newCustomer details must be provided",
      path: ["customerId"],
    }
  )
  .refine(
    (data) => {
      // Check that within the same reservation, the same room isn't double-allocated on overlapping dates
      for (let i = 0; i < data.allocations.length; i++) {
        for (let j = i + 1; j < data.allocations.length; j++) {
          const a = data.allocations[i];
          const b = data.allocations[j];
          if (a.roomId === b.roomId) {
            const aArr = a.arrivalDate.getTime();
            const aDep = a.departureDate.getTime();
            const bArr = b.arrivalDate.getTime();
            const bDep = b.departureDate.getTime();
            // Half-open overlap: aArr < bDep && aDep > bArr
            if (aArr < bDep && aDep > bArr) {
              return false;
            }
          }
        }
      }
      return true;
    },
    {
      message: "Cannot allocate the same room for overlapping dates within the same reservation",
      path: ["allocations"],
    }
  );
