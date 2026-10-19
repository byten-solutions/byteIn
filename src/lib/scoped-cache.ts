import { unstable_cache, revalidateTag } from "next/cache";

export const scopeKey = (propertyId?: string | null) => propertyId ?? "all";

export type CacheStub = {
  expireTag?: (tag: string) => void;
  cached?: <T>(
    loader: () => Promise<T>,
    key: string[],
    options: { tags: string[]; revalidate: number }
  ) => Promise<T>;
};

let cacheStub: CacheStub | null = null;

export function setCacheStub(stub: CacheStub | null) {
  cacheStub = stub;
}

export function expireTag(tag: string) {
  if (cacheStub?.expireTag) {
    cacheStub.expireTag(tag);
    return;
  }
  try {
    revalidateTag(tag, { expire: 0 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // In standalone node/tsx test runners running outside Next request context:
    if (process.env.NODE_ENV === "test" && msg.includes("static generation store")) {
      return;
    }
    console.error("cache invalidation failed", tag, err);
    if (process.env.NODE_ENV === "test") {
      throw err;
    }
  }
}

/**
 * Scoped cache wrapper:
 * Hotel-scoped queries run directly (0.5ms - 20ms) without caching.
 * Only platform-wide ("all") queries are cached, with TTL <= 60s.
 */
export async function scopedCached<T>(
  base: string,
  propertyId: string | null | undefined,
  ttl: number,
  loader: () => Promise<T>,
  extraKeyParts: string[] = []
): Promise<T> {
  if (propertyId) return loader();

  const cappedTtl = Math.min(ttl, 60);

  if (cacheStub?.cached) {
    return cacheStub.cached(loader, [base, "all", ...extraKeyParts], {
      tags: [`${base}:all`],
      revalidate: cappedTtl,
    });
  }

  try {
    return await unstable_cache(loader, [base, "all", ...extraKeyParts], {
      tags: [`${base}:all`],
      revalidate: cappedTtl,
    })();
  } catch {
    return loader(); // outside Next request context (scripts, unit tests)
  }
}

/**
 * Expire scoped cache:
 * Since only the platform-wide "all" variant is cached, a write anywhere expires "${base}:all".
 */
export function expireScoped(base: string, _propertyId?: string | null) {
  expireTag(`${base}:all`);
}

export const invalidateScoped = expireScoped;
