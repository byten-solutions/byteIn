import { z } from "zod";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Standard Zod validation schema for paginated API endpoints.
 * Rejects non-positive pages and limits exceeding MAX_PAGE_SIZE (100).
 */
export const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int("Page must be an integer")
    .min(1, "Page must be greater than or equal to 1")
    .default(DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(MAX_PAGE_SIZE, `Limit cannot exceed ${MAX_PAGE_SIZE}`)
    .default(DEFAULT_PAGE_SIZE),
});

export type PaginationQueryParams = z.infer<typeof paginationQuerySchema>;

/**
 * Helper to defensively bound pagination options within domain services.
 */
export function sanitizePagination(page?: number, limit?: number, defaultLimit = DEFAULT_PAGE_SIZE) {
  const safePage = Math.max(1, Math.floor(page || DEFAULT_PAGE));
  const safeLimit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limit || defaultLimit)));
  const skip = (safePage - 1) * safeLimit;
  return { page: safePage, limit: safeLimit, skip };
}
