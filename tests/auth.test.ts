import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { AuthService } from "../src/modules/auth/auth.service";
import { loginSchema } from "../src/modules/auth/auth.validation";
import { RoleName } from "../src/modules/auth/auth.types";
import { AuthError, enforceRole } from "../src/lib/auth-guard";
import { prisma } from "../src/lib/prisma";

const TEST_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ||
    "byteinn-super-secret-development-key-min-32-characters"
);

describe("Phase 1: Authentication & Access Control Tests", () => {
  describe("1. Password Hashing & Verification", () => {
    it("should hash a plaintext password and verify correctly", async () => {
      const plaintext = "SecretPassword@123";
      const hash = await AuthService.hashPassword(plaintext);

      assert.notEqual(hash, plaintext);
      assert.ok(hash.startsWith("$2"), "Hash should be a bcrypt format string");

      const isValid = await AuthService.verifyPassword(plaintext, hash);
      assert.equal(isValid, true, "Valid password should verify as true");

      const isInvalid = await AuthService.verifyPassword("WrongPassword", hash);
      assert.equal(isInvalid, false, "Incorrect password should verify as false");
    });

    it("should generate distinct bcrypt salts for identical plaintext passwords", async () => {
      const plaintext = "IdenticalSecret@123";
      const hash1 = await AuthService.hashPassword(plaintext);
      const hash2 = await AuthService.hashPassword(plaintext);

      assert.notEqual(hash1, hash2, "Hashes must have distinct salts");
      assert.equal(await AuthService.verifyPassword(plaintext, hash1), true);
      assert.equal(await AuthService.verifyPassword(plaintext, hash2), true);
    });
  });

  describe("2. Session Token Lifecycle (JWT via jose)", () => {
    it("should create and verify a signed session token", async () => {
      const payload = {
        sub: "user-test-uuid-1",
        email: "staff@byteinn.local",
        name: "Test Staff",
        role: RoleName.RECEPTIONIST,
      };

      const token = await AuthService.createSessionToken(payload);
      assert.ok(typeof token === "string" && token.length > 20);

      const decoded = await AuthService.verifySessionToken(token);
      assert.ok(decoded !== null);
      assert.equal(decoded.sub, payload.sub);
      assert.equal(decoded.email, payload.email);
      assert.equal(decoded.name, payload.name);
      assert.equal(decoded.role, payload.role);
    });

    it("should reject a tampered or invalid session token", async () => {
      const tampered = "eyJhbGciOiJIUzI1NiJ9.invalidpayload.invalidsignature";
      const result = await AuthService.verifySessionToken(tampered);
      assert.equal(result, null);
    });

    it("should reject an expired session token", async () => {
      // Craft an expired token directly
      const expiredToken = await new SignJWT({
        email: "expired@byteinn.local",
        name: "Expired Staff",
        role: RoleName.RECEPTIONIST,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-expired-uuid")
        .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
        .sign(TEST_SECRET);

      const result = await AuthService.verifySessionToken(expiredToken);
      assert.equal(result, null, "Expired token must be rejected");
    });

    it("should reject a token with an invalid role", async () => {
      const invalidRoleToken = await new SignJWT({
        email: "hacker@byteinn.local",
        name: "Hacker",
        role: "SUPERADMIN_FORGED",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-forged-uuid")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(TEST_SECRET);

      const result = await AuthService.verifySessionToken(invalidRoleToken);
      assert.equal(result, null, "Token with unauthorized role must be rejected");
    });
  });

  describe("3. Input Validation Schemas", () => {
    it("should accept valid login credentials and normalize email", () => {
      const valid = loginSchema.safeParse({
        email: "  RECEPTION@BYTEINN.LOCAL  ",
        password: "ValidPassword123",
      });
      assert.equal(valid.success, true);
      if (valid.success) {
        assert.equal(valid.data.email, "reception@byteinn.local");
      }
    });

    it("should reject an invalid email address", () => {
      const invalid = loginSchema.safeParse({
        email: "not-an-email",
        password: "ValidPassword123",
      });
      assert.equal(invalid.success, false);
      if (!invalid.success) {
        assert.ok(invalid.error.flatten().fieldErrors.email);
      }
    });

    it("should reject an empty email", () => {
      const invalid = loginSchema.safeParse({
        email: "   ",
        password: "ValidPassword123",
      });
      assert.equal(invalid.success, false);
      if (!invalid.success) {
        assert.ok(invalid.error.flatten().fieldErrors.email);
      }
    });

    it("should reject an empty password", () => {
      const invalid = loginSchema.safeParse({
        email: "user@byteinn.local",
        password: "",
      });
      assert.equal(invalid.success, false);
      if (!invalid.success) {
        assert.ok(invalid.error.flatten().fieldErrors.password);
      }
    });

    it("should reject a password exceeding 128 characters (DoS mitigation)", () => {
      const oversizedPassword = "A".repeat(129);
      const invalid = loginSchema.safeParse({
        email: "user@byteinn.local",
        password: oversizedPassword,
      });
      assert.equal(invalid.success, false);
      if (!invalid.success) {
        assert.ok(invalid.error.flatten().fieldErrors.password);
      }
    });
  });

  describe("4. Role Authorization Guards Logic (enforceRole)", () => {
    const adminSession = {
      sub: "u1",
      email: "admin@byteinn.local",
      name: "Admin",
      role: RoleName.ADMIN,
    };

    const receptionistSession = {
      sub: "u2",
      email: "reception@byteinn.local",
      name: "Receptionist",
      role: RoleName.RECEPTIONIST,
    };

    it("should throw AuthError(401) when session is null", () => {
      assert.throws(
        () => enforceRole(null),
        (err: unknown) =>
          err instanceof AuthError &&
          err.statusCode === 401 &&
          err.message === "Authentication required"
      );
    });

    it("should permit any authenticated session when no roles are specified", () => {
      assert.equal(enforceRole(adminSession), adminSession);
      assert.equal(enforceRole(receptionistSession), receptionistSession);
    });

    it("should permit action when user role matches allowed roles", () => {
      assert.equal(enforceRole(adminSession, [RoleName.ADMIN]), adminSession);
      assert.equal(
        enforceRole(adminSession, [RoleName.ADMIN, RoleName.RECEPTIONIST]),
        adminSession
      );
      assert.equal(
        enforceRole(receptionistSession, [RoleName.RECEPTIONIST]),
        receptionistSession
      );
    });

    it("should throw AuthError(403) when receptionist attempts admin-only operation", () => {
      assert.throws(
        () => enforceRole(receptionistSession, [RoleName.ADMIN]),
        (err: unknown) =>
          err instanceof AuthError &&
          err.statusCode === 403 &&
          err.message.includes("Access denied")
      );
    });

    it("should throw AuthError(403) when admin attempts receptionist-only operation", () => {
      assert.throws(
        () => enforceRole(adminSession, [RoleName.RECEPTIONIST]),
        (err: unknown) =>
          err instanceof AuthError &&
          err.statusCode === 403 &&
          err.message.includes("Access denied")
      );
    });
  });

  describe("5. Database Integration & Login Flow", () => {
    let testUserId: string;

    before(async () => {
      // Ensure ADMIN role exists
      const role = await prisma.role.upsert({
        where: { name: RoleName.ADMIN },
        update: {},
        create: {
          name: RoleName.ADMIN,
          description: "System Administrator",
        },
      });

      // Create a test user for integration testing
      const passwordHash = await AuthService.hashPassword("IntegrationTest@123");
      const user = await prisma.user.upsert({
        where: { email: "authtest@byteinn.local" },
        update: {
          passwordHash,
          status: "ACTIVE",
        },
        create: {
          name: "Auth Test User",
          email: "authtest@byteinn.local",
          passwordHash,
          roleId: role.id,
          status: "ACTIVE",
        },
      });
      testUserId = user.id;
    });

    after(async () => {
      // Clean up test audit logs and user safely
      if (testUserId) {
        await prisma.auditLog.deleteMany({
          where: { userId: testUserId },
        });
        await prisma.user.deleteMany({
          where: { id: testUserId, email: "authtest@byteinn.local" },
        });
      }
    });

    it("should successfully authenticate with valid credentials and record audit log", async () => {
      const result = await AuthService.login(
        {
          email: "authtest@byteinn.local",
          password: "IntegrationTest@123",
        },
        { ip: "127.0.0.1", userAgent: "NodeTest" }
      );

      assert.ok(result.token);
      assert.equal(result.user.email, "authtest@byteinn.local");
      assert.equal(result.user.role, RoleName.ADMIN);
      assert.ok(result.user.lastLoginAt !== null);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          userId: testUserId,
          action: "LOGIN_SUCCESS",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(audit !== null, "Audit log for LOGIN_SUCCESS should exist");
    });

    it("should support case-insensitive email login", async () => {
      const result = await AuthService.login({
        email: "AUTHTEST@BYTEINN.LOCAL",
        password: "IntegrationTest@123",
      });

      assert.ok(result.token);
      assert.equal(result.user.email, "authtest@byteinn.local");
    });

    it("should reject nonexistent user with generic error and record failed audit log", async () => {
      await assert.rejects(
        async () => {
          await AuthService.login({
            email: "nonexistent@byteinn.local",
            password: "AnyPassword123!",
          });
        },
        {
          name: "Error",
          message: "Invalid email or password",
        }
      );

      // Verify audit log for anonymous/null user
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityId: "ANONYMOUS",
          action: "LOGIN_FAILED",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(audit !== null, "Audit log for anonymous failed login should exist");
      if (audit && audit.newData) {
        const details = audit.newData as Record<string, unknown>;
        assert.equal(details.email, "nonexistent@byteinn.local");
        assert.equal(details.reason, "User not found");
      }
    });

    it("should reject incorrect password and record failed audit log", async () => {
      await assert.rejects(
        async () => {
          await AuthService.login({
            email: "authtest@byteinn.local",
            password: "WrongPassword!",
          });
        },
        {
          name: "Error",
          message: "Invalid email or password",
        }
      );

      const audit = await prisma.auditLog.findFirst({
        where: {
          userId: testUserId,
          action: "LOGIN_FAILED",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(audit !== null, "Audit log for LOGIN_FAILED should exist");
    });

    it("should reject disabled user accounts", async () => {
      // Set user to DISABLED
      await prisma.user.update({
        where: { id: testUserId },
        data: { status: "DISABLED" },
      });

      await assert.rejects(
        async () => {
          await AuthService.login({
            email: "authtest@byteinn.local",
            password: "IntegrationTest@123",
          });
        },
        {
          name: "Error",
          message: "Account is disabled. Please contact an administrator.",
        }
      );

      // Re-enable user
      await prisma.user.update({
        where: { id: testUserId },
        data: { status: "ACTIVE" },
      });
    });

    it("should fetch safe user representation without exposing passwordHash", async () => {
      const safeUser = await AuthService.getCurrentUser(testUserId);
      assert.ok(safeUser !== null);
      assert.equal(safeUser.id, testUserId);
      assert.equal(safeUser.email, "authtest@byteinn.local");
      assert.equal((safeUser as unknown as Record<string, unknown>).passwordHash, undefined);
    });

    it("should return null for non-existent user ID in getCurrentUser", async () => {
      const nonExistent = await AuthService.getCurrentUser("non-existent-user-id");
      assert.equal(nonExistent, null);
    });
  });
});
