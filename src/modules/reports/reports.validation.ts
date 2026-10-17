import { z } from "zod"

export function isValidISODateString(val: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val.trim())
  if (!match) return false
  const y = parseInt(match[1], 10)
  const m = parseInt(match[2], 10) - 1
  const d = parseInt(match[3], 10)
  if (m < 0 || m > 11 || d < 1 || d > 31) return false
  const dateObj = new Date(Date.UTC(y, m, d))
  return (
    dateObj.getUTCFullYear() === y &&
    dateObj.getUTCMonth() === m &&
    dateObj.getUTCDate() === d
  )
}

export const reportDateRangeSchema = z
  .object({
    startDate: z
      .string()
      .trim()
      .refine(isValidISODateString, {
        message: "startDate must be a valid calendar date in YYYY-MM-DD format",
      }),
    endDate: z
      .string()
      .trim()
      .refine(isValidISODateString, {
        message: "endDate must be a valid calendar date in YYYY-MM-DD format",
      }),
    propertyId: z.string().trim().min(1).optional(),
  })
  .refine(
    (data) => {
      const s = new Date(`${data.startDate}T00:00:00.000Z`).getTime()
      const e = new Date(`${data.endDate}T00:00:00.000Z`).getTime()
      return e >= s
    },
    {
      message: "endDate must be on or after startDate",
      path: ["endDate"],
    }
  )
  .refine(
    (data) => {
      const s = new Date(`${data.startDate}T00:00:00.000Z`).getTime()
      const e = new Date(`${data.endDate}T00:00:00.000Z`).getTime()
      const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24))
      return diffDays <= 366
    },
    {
      message: "Date range cannot exceed 366 days",
      path: ["endDate"],
    }
  )

export const singleDateReportSchema = z.object({
  date: z
    .string()
    .trim()
    .refine(isValidISODateString, {
      message: "date must be a valid calendar date in YYYY-MM-DD format",
    })
    .optional(),
  propertyId: z.string().trim().min(1).optional(),
})

export const availabilityGridSchema = z
  .object({
    startDate: z
      .string()
      .trim()
      .refine(isValidISODateString, {
        message: "startDate must be a valid calendar date in YYYY-MM-DD format",
      }),
    endDate: z
      .string()
      .trim()
      .refine(isValidISODateString, {
        message: "endDate must be a valid calendar date in YYYY-MM-DD format",
      }),
    propertyId: z.string().trim().min(1).optional(),
  })
  .refine(
    (data) => {
      const s = new Date(`${data.startDate}T00:00:00.000Z`).getTime()
      const e = new Date(`${data.endDate}T00:00:00.000Z`).getTime()
      return e >= s
    },
    {
      message: "endDate must be on or after startDate",
      path: ["endDate"],
    }
  )
  .refine(
    (data) => {
      const s = new Date(`${data.startDate}T00:00:00.000Z`).getTime()
      const e = new Date(`${data.endDate}T00:00:00.000Z`).getTime()
      const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24))
      return diffDays <= 31
    },
    {
      message: "Availability grid range cannot exceed 31 days",
      path: ["endDate"],
    }
  )

export const collectionsReportSchema = z.object({
  date: z
    .string()
    .trim()
    .refine(isValidISODateString, {
      message: "date must be a valid calendar date in YYYY-MM-DD format",
    })
    .optional(),
  startDate: z
    .string()
    .trim()
    .refine(isValidISODateString, {
      message: "startDate must be a valid calendar date in YYYY-MM-DD format",
    })
    .optional(),
  endDate: z
    .string()
    .trim()
    .refine(isValidISODateString, {
      message: "endDate must be a valid calendar date in YYYY-MM-DD format",
    })
    .optional(),
  staffUserId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
})

export const receivablesReportSchema = z.object({
  propertyId: z.string().trim().min(1).optional(),
  filter: z.enum(["all", "in_house", "departed"]).optional().default("all"),
})
