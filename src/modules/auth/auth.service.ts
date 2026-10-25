import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "./auth.validation";
import {
  RoleName,
  type AuthResult,
  type LoginInput,
  type ChangePasswordInput,
  type SafeUser,
  type SessionPayload,
  type SafePropertySummary,
} from "./auth.types";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { invalidateSessionUserCache } from "@/lib/session-cache";

export const MIN_SESSION_SECRET_LENGTH = 32;

export const INSECURE_DEFAULT_SECRETS = new Set([
  "byteinn-super-secret-development-key-min-32-characters",
  "your-secret-key-at-least-32-characters-long",
  "changeme-changeme-changeme-changeme",
  "placeholder-secret-key-at-least-32-characters",
]);

/**
 * Validates a candidate session secret string.
 * Fails securely if the secret is missing, empty, shorter than 32 characters,
 * or configured with a known insecure placeholder string.
 */
export function validateSessionSecret(secret: string | undefined): Uint8Array {
  if (secret === undefined) {
    throw new Error(
      "Authentication configuration error: SESSION_SECRET environment variable is missing."
    );
  }

  const trimmed = secret.trim();
  if (trimmed.length === 0) {
    throw new Error(
      "Authentication configuration error: SESSION_SECRET cannot be empty."
    );
  }

  if (trimmed.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `Authentication configuration error: SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters long (provided secret length: ${trimmed.length}).`
    );
  }

  if (INSECURE_DEFAULT_SECRETS.has(trimmed)) {
    throw new Error(
      "Authentication configuration error: SESSION_SECRET is set to an insecure default or placeholder. Generate and configure a cryptographically secure random secret."
    );
  }

  return new TextEncoder().encode(trimmed);
}

/**
 * Retrieves and validates the JWT signing key from environment configuration.
 */
export function getSessionSecretKey(): Uint8Array {
  return validateSessionSecret(process.env.SESSION_SECRET);
}


const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 hours (standard shift)

export class AuthService {
  /**
   * Hashes a plaintext password using bcrypt.
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compares a plaintext password against a stored bcrypt hash.
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Signs a stateless session JWT using the configured secret key.
   */
  static async createSessionToken(payload: SessionPayload): Promise<string> {
    const key = getSessionSecretKey();
    return new SignJWT({
      email: payload.email,
      name: payload.name,
      role: payload.role,
      propertyId: payload.propertyId ?? null,
      property: payload.property ?? null,
      tokenVersion: payload.tokenVersion ?? 1,
      mustChangePassword: payload.mustChangePassword ?? false,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
      .sign(key);
  }

  /**
   * Verifies and decodes a signed session JWT. Returns null if invalid or expired.
   */
  static async verifySessionToken(token: string): Promise<SessionPayload | null> {
    try {
      const key = getSessionSecretKey();
      const { payload } = await jwtVerify(token, key, {
        algorithms: ["HS256"],
      });
      if (
        !payload.sub ||
        !payload.email ||
        !payload.role ||
        !Object.values(RoleName).includes(payload.role as RoleName)
      ) {
        return null;
      }
      return {
        sub: payload.sub as string,
        email: payload.email as string,
        name: (payload.name as string) || "",
        role: payload.role as SessionPayload["role"],
        propertyId: (payload.propertyId as string | null | undefined) ?? null,
        property: (payload.property as SafePropertySummary | null | undefined) ?? null,
        tokenVersion: typeof payload.tokenVersion === "number" ? payload.tokenVersion : 1,
        mustChangePassword: Boolean(payload.mustChangePassword),
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch {
      return null;
    }
  }

  /**
   * Authenticates a user with email and password, records audit log,
   * updates last_login_at, and issues a signed session token.
   */
  static async login(
    input: LoginInput,
    metadata?: { ip?: string; userAgent?: string }
  ): Promise<AuthResult> {
    // 1. Validate inputs
    const validated = loginSchema.parse(input);

    // 2. Lookup user by email (case-insensitive)
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: validated.email,
          mode: "insensitive",
        },
      },
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

    // Dummy hash for constant-time comparison against nonexistent users
    const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    const passwordHash = user ? user.passwordHash : DUMMY_HASH;

    // 3. Verify password before evaluating account status to eliminate user enumeration side channels
    const isPasswordValid = await this.verifyPassword(
      validated.password,
      passwordHash
    );

    if (!user || !isPasswordValid) {
      await this.recordAuditLog(user?.id || null, "LOGIN_FAILED", {
        reason: user ? "Invalid password" : "User not found",
        email: validated.email,
        ...metadata,
      });
      throw new Error("Invalid email or password");
    }

    // 4. Verify account status only after password validation succeeds
    if (user.status !== "ACTIVE") {
      await this.recordAuditLog(user.id, "LOGIN_BLOCKED", {
        reason: "Account disabled",
        status: user.status,
        ...metadata,
      });
      throw new Error("Account is disabled. Please contact an administrator.");
    }

    // 5. Update last_login_at timestamp
    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now },
    });

    // 6. Record successful login audit log
    await this.recordAuditLog(user.id, "LOGIN_SUCCESS", {
      role: user.role.name,
      ...metadata,
    });

    const propertySummary: SafePropertySummary | null = user.property
      ? {
          id: user.property.id,
          name: user.property.name,
          status: user.property.status,
        }
      : null;

    // 7. Generate session token
    const sessionPayload: SessionPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      propertyId: user.propertyId,
      property: propertySummary,
      tokenVersion: user.tokenVersion,
      mustChangePassword: user.mustChangePassword,
    };
    const token = await this.createSessionToken(sessionPayload);

    const safeUser: SafeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      propertyId: user.propertyId,
      property: propertySummary,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: now,
      createdAt: user.createdAt,
    };

    return {
      user: safeUser,
      token,
    };
  }

  /**
   * Updates user password, clears mustChangePassword, increments tokenVersion to
   * invalidate other active sessions, and issues a fresh session token.
   */
  static async changePassword(
    userId: string,
    input: ChangePasswordInput,
    metadata?: { ip?: string; userAgent?: string }
  ): Promise<{ token: string; user: SafeUser }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.status !== "ACTIVE") {
      throw new ForbiddenError("Account is disabled");
    }

    // 1. Verify current password
    const isCurrentValid = await this.verifyPassword(input.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestError("Current password is incorrect");
    }

    // 2. Validate new password complexity
    const newPass = input.newPassword;
    if (!newPass || typeof newPass !== "string") {
      throw new BadRequestError("New password is required");
    }
    if (newPass.length < 8) {
      throw new BadRequestError("New password must be at least 8 characters long");
    }
    if (!/[A-Z]/.test(newPass)) {
      throw new BadRequestError("New password must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(newPass)) {
      throw new BadRequestError("New password must contain at least one lowercase letter");
    }
    if (!/[0-9]/.test(newPass)) {
      throw new BadRequestError("New password must contain at least one number");
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPass)) {
      throw new BadRequestError("New password must contain at least one special character");
    }

    if (input.currentPassword === newPass) {
      throw new BadRequestError("New password cannot be the same as the current password");
    }

    // 3. Hash new password & atomically update user with incremented tokenVersion
    const newHash = await this.hashPassword(newPass);
    invalidateSessionUserCache(user.id);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
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

    // 4. Record audit log
    await this.recordAuditLog(user.id, "PASSWORD_CHANGED", {
      action: "In-app password change",
      previousTokenVersion: user.tokenVersion,
      newTokenVersion: updatedUser.tokenVersion,
      ...metadata,
    });

    const propertySummary: SafePropertySummary | null = updatedUser.property
      ? {
          id: updatedUser.property.id,
          name: updatedUser.property.name,
          status: updatedUser.property.status,
        }
      : null;

    // 5. Mint new session token for the current session with the updated tokenVersion
    const newSessionPayload: SessionPayload = {
      sub: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role.name,
      propertyId: updatedUser.propertyId,
      property: propertySummary,
      tokenVersion: updatedUser.tokenVersion,
      mustChangePassword: false,
    };
    const token = await this.createSessionToken(newSessionPayload);

    return {
      token,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role.name,
        propertyId: updatedUser.propertyId,
        property: propertySummary,
        status: updatedUser.status,
        mustChangePassword: false,
        lastLoginAt: updatedUser.lastLoginAt,
        createdAt: updatedUser.createdAt,
      },
    };
  }

  /**
   * Retrieves a safe user representation by ID.
   */
  static async getCurrentUser(userId: string): Promise<SafeUser | null> {
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

    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      propertyId: user.propertyId,
      property: user.property
        ? {
            id: user.property.id,
            name: user.property.name,
            status: user.property.status,
          }
        : null,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  /**
   * Centralized helper to write authentication audit log entries.
   */
  static async recordAuditLog(
    userId: string | null,
    action: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          entityType: "AUTH",
          entityId: userId || "ANONYMOUS",
          action,
          newData: details ? JSON.parse(JSON.stringify(details)) : null,
        },
      });
    } catch (err) {
      console.error("Failed to write auth audit log:", err);
    }
  }
}
