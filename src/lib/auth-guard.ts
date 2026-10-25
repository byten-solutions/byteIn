import { prisma } from "@/lib/prisma";
import { AuthService } from "@/modules/auth/auth.service";
import { RoleName, type SessionPayload } from "@/modules/auth/auth.types";
import { getSessionCookie } from "./session";

import {
  getCachedSessionUser,
  setCachedSessionUser,
  invalidateSessionUserCache,
  type CachedUserRecord,
} from "./session-cache";

export { invalidateSessionUserCache };

export class AuthError extends Error {
  statusCode: number;
  mustChangePassword?: boolean;

  constructor(message: string, statusCode = 401, mustChangePassword = false) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
    this.mustChangePassword = mustChangePassword;
  }
}

async function fetchSessionUser(userId: string): Promise<CachedUserRecord | null> {
  const cached = getCachedSessionUser(userId);
  if (cached !== undefined) {
    return cached;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      property: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  setCachedSessionUser(userId, user);
  return user;
}

/**
 * Reads the current session from incoming request cookies, verifies the JWT signature,
 * and validates that the user exists and is ACTIVE in the database.
 * Returns null if the token is missing, invalid, expired, or if the account is disabled/deleted.
 */
export async function getSession(
  explicitTokenOrReq?: string | null | Request
): Promise<SessionPayload | null> {
  let token: string | null = null;
  if (typeof explicitTokenOrReq === "string") {
    token = explicitTokenOrReq;
  } else if (explicitTokenOrReq && "headers" in explicitTokenOrReq) {
    token = await getSessionCookie(explicitTokenOrReq);
  } else {
    token = await getSessionCookie();
  }
  if (!token) return null;
  const payload = await AuthService.verifySessionToken(token);
  if (!payload) return null;

  try {
    const user = await fetchSessionUser(payload.sub);

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    if (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion) {
      return null;
    }

    return {
      ...payload,
      role: user.role.name as RoleName,
      name: user.name,
      email: user.email,
      propertyId: user.propertyId,
      property: user.property
        ? {
            id: user.property.id,
            name: user.property.name,
            status: user.property.status,
          }
        : null,
      tokenVersion: user.tokenVersion,
      mustChangePassword: user.mustChangePassword,
    };
  } catch {
    return null;
  }
}

/**
 * Pure authorization helper that validates session presence and permitted roles.
 * Throws AuthError(401) if session is missing, or AuthError(403) if role is unauthorized.
 */
export function enforceRole(
  session: SessionPayload | null,
  allowedRoles?: RoleName[]
): SessionPayload {
  if (!session) {
    throw new AuthError("Authentication required", 401);
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(session.role)) {
      throw new AuthError(
        `Access denied. Requires one of the following roles: ${allowedRoles.join(", ")}`,
        403
      );
    }
  }

  return session;
}

/**
 * Enforces authentication and role-based access control with database-level freshness.
 * - Cryptographically verifies session token.
 * - Validates user existence and ACTIVE status in PostgreSQL.
 * - Enforces token_version matches DB (session invalidation).
 * - Enforces must_change_password redirect guard.
 * - Enforces permissions against the user's current database role.
 * - Throws AuthError(401) if unauthenticated or user deleted or session invalidated.
 * - Throws AuthError(403) if user account is disabled, must change password, or lacks permitted role.
 */
export async function requireAuth(
  allowedRoles?: RoleName[],
  explicitTokenOrReq?: string | null | Request
): Promise<SessionPayload> {
  let token: string | null = null;
  if (typeof explicitTokenOrReq === "string") {
    token = explicitTokenOrReq;
  } else if (explicitTokenOrReq && "headers" in explicitTokenOrReq) {
    token = await getSessionCookie(explicitTokenOrReq);
  } else {
    token = await getSessionCookie();
  }

  if (!token) {
    throw new AuthError("Authentication required", 401);
  }

  const payload = await AuthService.verifySessionToken(token);
  if (!payload) {
    throw new AuthError("Authentication required", 401);
  }

  const user = await fetchSessionUser(payload.sub);

  if (!user) {
    throw new AuthError("User account not found or deleted", 401);
  }

  if (user.status !== "ACTIVE") {
    throw new AuthError("User account is disabled", 403);
  }

  if (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion) {
    throw new AuthError("Session has been invalidated. Please log in again.", 401);
  }

  if (user.mustChangePassword) {
    let isAllowedPath = false;
    if (explicitTokenOrReq && typeof explicitTokenOrReq !== "string" && "url" in explicitTokenOrReq) {
      const urlStr = (explicitTokenOrReq as Request).url;
      try {
        const pathname = new URL(urlStr).pathname;
        if (
          pathname.startsWith("/api/auth/change-password") ||
          pathname.startsWith("/api/auth/logout") ||
          pathname.startsWith("/api/auth/me")
        ) {
          isAllowedPath = true;
        }
      } catch {
        // invalid URL format
      }
    }
    if (!isAllowedPath) {
      throw new AuthError("Password change required before accessing system functions", 403, true);
    }
  }

  const verifiedSession: SessionPayload = {
    ...payload,
    role: user.role.name as RoleName,
    name: user.name,
    email: user.email,
    propertyId: user.propertyId,
    property: user.property
      ? {
          id: user.property.id,
          name: user.property.name,
          status: user.property.status,
        }
      : null,
    tokenVersion: user.tokenVersion,
    mustChangePassword: user.mustChangePassword,
  };

  return enforceRole(verifiedSession, allowedRoles);
}

/**
 * Requires an authenticated user with any valid role.
 */
export async function requireAuthenticatedUser(
  explicitTokenOrReq?: string | null | Request
): Promise<SessionPayload> {
  return requireAuth(undefined, explicitTokenOrReq);
}

/**
 * Requires a SUPER_ADMIN user.
 */
export async function requireSuperAdmin(
  explicitTokenOrReq?: string | null | Request
): Promise<SessionPayload> {
  return requireAuth([RoleName.SUPER_ADMIN], explicitTokenOrReq);
}

/**
 * Requires an ADMIN (Hotel Admin) user.
 */
export async function requireHotelAdmin(
  explicitTokenOrReq?: string | null | Request
): Promise<SessionPayload> {
  return requireAuth([RoleName.ADMIN], explicitTokenOrReq);
}

export function resolveScope(
  session: SessionPayload,
  requestedPropertyId?: string | null,
  options?: { allowSuperAdminGlobal?: boolean }
): string | null {
  const requested = requestedPropertyId?.trim() || null;

  if (session.role === RoleName.SUPER_ADMIN) {
    if (requested) return requested;
    if (options?.allowSuperAdminGlobal) return null; // platform-wide, SUPER_ADMIN only
    throw new AuthError("Hotel selection (propertyId) is required for this operation", 400);
  }

  // Fail closed: a hotel-level user without an assigned hotel must NEVER fall through to "all hotels".
  if (!session.propertyId) {
    throw new AuthError("Your account is not assigned to a hotel. Contact a platform administrator.", 403);
  }
  if (requested && requested !== session.propertyId) {
    throw new AuthError(
      "Access denied: You cannot access or modify records belonging to another hotel.",
      403
    );
  }
  return session.propertyId;
}

export const requireHotelContext = resolveScope;


