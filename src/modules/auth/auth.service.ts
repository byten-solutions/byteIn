import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "./auth.validation";
import {
  RoleName,
  type AuthResult,
  type LoginInput,
  type SafeUser,
  type SessionPayload,
} from "./auth.types";

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

    // 7. Generate session token
    const sessionPayload: SessionPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
    };
    const token = await this.createSessionToken(sessionPayload);

    const safeUser: SafeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      status: user.status,
      lastLoginAt: now,
      createdAt: user.createdAt,
    };

    return {
      user: safeUser,
      token,
    };
  }

  /**
   * Retrieves a safe user representation by ID.
   */
  static async getCurrentUser(userId: string): Promise<SafeUser | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      status: user.status,
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
