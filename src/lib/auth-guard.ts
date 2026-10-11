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
 * Reads the current session from incoming request cookies and verifies the token.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  return AuthService.verifySessionToken(token);
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
 * Enforces authentication and optional role-based access control.
 * Throws AuthError(401) if unauthenticated, or AuthError(403) if unauthorized.
 */
export async function requireAuth(allowedRoles?: RoleName[]): Promise<SessionPayload> {
  const session = await getSession();
  return enforceRole(session, allowedRoles);
}
