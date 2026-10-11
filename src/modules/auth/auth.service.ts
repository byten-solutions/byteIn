import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "./auth.validation";
import { RoleName } from "./auth.types";
import type {
  AuthResult,
  LoginInput,
  SafeUser,
  SessionPayload,
} from "./auth.types";

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ||
    "byteinn-super-secret-development-key-min-32-characters"
);

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
    return new SignJWT({
      email: payload.email,
      name: payload.name,
      role: payload.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
      .sign(SESSION_SECRET);
  }

  /**
   * Verifies and decodes a signed session JWT. Returns null if invalid or expired.
   */
  static async verifySessionToken(token: string): Promise<SessionPayload | null> {
    try {
      const { payload } = await jwtVerify(token, SESSION_SECRET);
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

    if (!user) {
      await this.recordAuditLog(null, "LOGIN_FAILED", {
        reason: "User not found",
        email: validated.email,
        ...metadata,
      });
      throw new Error("Invalid email or password");
    }

    // 3. Verify account status
    if (user.status !== "ACTIVE") {
      await this.recordAuditLog(user.id, "LOGIN_BLOCKED", {
        reason: "Account disabled",
        status: user.status,
        ...metadata,
      });
      throw new Error("Account is disabled. Please contact an administrator.");
    }

    // 4. Verify password
    const isPasswordValid = await this.verifyPassword(
      validated.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      await this.recordAuditLog(user.id, "LOGIN_FAILED", {
        reason: "Invalid password",
        ...metadata,
      });
      throw new Error("Invalid email or password");
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
