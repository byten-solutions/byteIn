import { unstable_cache, revalidateTag } from "next/cache";

export const scopeKey = (propertyId?: string | null) => propertyId ?? "all";

export async function scopedCached<T>(
  base: string,
  propertyId: string | null | undefined,
  ttlSeconds: number,
  loader: () => Promise<T>,
  extraKeyParts: string[] = []
): Promise<T> {
  const key = scopeKey(propertyId);
  try {
    return await unstable_cache(loader, [base, key, ...extraKeyParts], {
      tags: [`${base}:${key}`],
      revalidate: ttlSeconds,
    })();
  } catch {
    return loader(); // outside a Next request context (scripts, tests): same behavior the existing code has
  }
}

// A write in hotel P changes hotel P's numbers AND the platform-wide ("all") numbers.
export function invalidateScoped(base: string, propertyId?: string | null) {
  const keys = new Set<string>(["all"]);
  if (propertyId) keys.add(propertyId);
  for (const k of keys) {
    try {
      revalidateTag(`${base}:${k}`, "max");
    } catch {
      // outside Next request context
    }
  }
}
