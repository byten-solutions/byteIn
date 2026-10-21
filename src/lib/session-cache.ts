export interface CachedUserRecord {
  id: string;
  status: string;
  tokenVersion: number;
  name: string;
  email: string;
  propertyId: string | null;
  mustChangePassword: boolean;
  role: { id: string; name: string };
  property: { id: string; name: string; status: string } | null;
}

interface UserCacheEntry {
  user: CachedUserRecord | null;
  expiresAt: number;
}

const sessionUserCache = new Map<string, UserCacheEntry>();
const SESSION_CACHE_TTL_MS = 15_000;

function isTestMode(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.argv.includes("--test") ||
    !!process.env.DATABASE_URL?.includes("_test")
  );
}

/**
 * Gets a cached session user if valid and not expired.
 * Always returns undefined in test environment to preserve complete test isolation.
 */
export function getCachedSessionUser(userId: string): CachedUserRecord | null | undefined {
  if (isTestMode()) {
    return undefined;
  }
  const entry = sessionUserCache.get(userId);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.user;
  }
  return undefined;
}

/**
 * Stores a user record in the short-lived in-memory session cache.
 * Bypassed in test environment.
 */
export function setCachedSessionUser(userId: string, user: CachedUserRecord | null): void {
  if (isTestMode()) {
    return;
  }
  if (sessionUserCache.size > 1000) {
    sessionUserCache.clear();
  }
  sessionUserCache.set(userId, {
    user,
    expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
  });
}

/**
 * Invalidates the in-memory session user cache for a specific user ID or completely.
 */
export function invalidateSessionUserCache(userId?: string): void {
  if (userId) {
    sessionUserCache.delete(userId);
  } else {
    sessionUserCache.clear();
  }
}
