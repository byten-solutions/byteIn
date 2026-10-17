import { prisma } from "@/lib/prisma";
import { AuthService } from "@/modules/auth/auth.service";
import { RoleName, type SessionPayload } from "@/modules/auth/auth.types";
import { getSessionCookie } from "./session";

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
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
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    return {
      ...payload,
      role: user.role.name as RoleName,
      name: user.name,
      email: user.email,
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
 * - Enforces permissions against the user's current database role.
 * - Throws AuthError(401) if unauthenticated or user deleted.
 * - Throws AuthError(403) if user account is disabled or lacks permitted role.
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

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: true },
  });

  if (!user) {
    throw new AuthError("User account not found or deleted", 401);
  }

  if (user.status !== "ACTIVE") {
    throw new AuthError("User account is disabled", 403);
  }

  const verifiedSession: SessionPayload = {
    ...payload,
    role: user.role.name as RoleName,
    name: user.name,
    email: user.email,
  };

  return enforceRole(verifiedSession, allowedRoles);
}

