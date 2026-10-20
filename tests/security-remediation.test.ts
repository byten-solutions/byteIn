import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import {
  AuthService,
  getSessionSecretKey,
  validateSessionSecret,
  MIN_SESSION_SECRET_LENGTH,
  INSECURE_DEFAULT_SECRETS,
} from "../src/modules/auth/auth.service";
import { RoleName, type SessionPayload } from "../src/modules/auth/auth.types";
import { requireAuth, getSession, AuthError } from "../src/lib/auth-guard";
import { RateLimiter } from "../src/lib/rate-limiter";
import {
  paginationQuerySchema,
  sanitizePagination,
  MAX_PAGE_SIZE,
} from "../src/lib/pagination";
import {
  DomainError,
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
  handleApiError,
} from "../src/lib/errors";
import { normalizeDate } from "../src/modules/reservations/reservation.validation";
import { prisma } from "../src/lib/prisma";

describe("Security Remediation & Audit Fixes Verification", () => {
  // =========================================================================
  // 1. JWT Secret Insecurity & Cryptographic Validation
  // =========================================================================
  describe("Priority 1: JWT Secret Configuration & Token Verification", () => {
    it("should reject undefined, empty, or whitespace-only SESSION_SECRET", () => {
      assert.throws(
        () => validateSessionSecret(undefined),
        /SESSION_SECRET environment variable is missing/
      );
      assert.throws(
        () => validateSessionSecret(""),
        /SESSION_SECRET cannot be empty/
      );
      assert.throws(
        () => validateSessionSecret("    "),
        /SESSION_SECRET cannot be empty/
      );
    });

    it("should reject secrets shorter than 32 characters", () => {
      const shortSecret = "short-key-1234567890";
      assert.ok(shortSecret.length < MIN_SESSION_SECRET_LENGTH);
      assert.throws(
        () => validateSessionSecret(shortSecret),
        /SESSION_SECRET must be at least 32 characters long/
      );
    });

    it("should reject known insecure default or placeholder secrets", () => {
      for (const insecure of INSECURE_DEFAULT_SECRETS) {
        assert.throws(
          () => validateSessionSecret(insecure),
          /SESSION_SECRET is set to an insecure default or placeholder/
        );
      }
    });

    it("should accept valid secrets >= 32 characters", () => {
      const validSecret = "a-very-secure-random-token-with-sufficient-entropy-1234";
      const key = validateSessionSecret(validSecret);
      assert.ok(key instanceof Uint8Array);
      assert.equal(key.length, validSecret.length);

      const activeKey = getSessionSecretKey();
      assert.ok(activeKey instanceof Uint8Array);
      assert.ok(activeKey.length >= MIN_SESSION_SECRET_LENGTH);
    });

    it("should reject a JWT signed using the former hardcoded fallback secret", async () => {
      const oldFallbackSecret = new TextEncoder().encode(
        "byteinn-super-secret-development-key-min-32-characters"
      );

      const legacyForgedToken = await new SignJWT({
        email: "attacker@byteinn.local",
        name: "Attacker",
        role: RoleName.ADMIN,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("attacker-user-id")
        .setIssuedAt()
        .setExpirationTime("2h")
        .sign(oldFallbackSecret);

      // System verifies using the active environment secret, not the legacy fallback
      const verified = await AuthService.verifySessionToken(legacyForgedToken);
      assert.equal(
        verified,
        null,
        "Tokens signed with former hardcoded fallback key must be rejected"
      );
    });

    it("should reject a JWT with 'none' algorithm (algorithm confusion attack)", async () => {
      // Create an unverified unsigned token with alg: none
      const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          sub: "hacker-user-id",
          email: "hacker@byteinn.local",
          role: RoleName.ADMIN,
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString("base64url");
      const unsignedToken = `${header}.${payload}.`;

      const result = await AuthService.verifySessionToken(unsignedToken);
      assert.equal(result, null, "Alg: none token must be rejected");
    });

    it("should reject tampered token signatures", async () => {
      const validToken = await AuthService.createSessionToken({
        sub: "user-1",
        email: "user1@byteinn.local",
        name: "User One",
        role: RoleName.RECEPTIONIST,
      });

      const parts = validToken.split(".");
      assert.equal(parts.length, 3);
      // Alter signature
      const tamperedToken = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -4)}xxxx`;

      const result = await AuthService.verifySessionToken(tamperedToken);
      assert.equal(result, null, "Tampered signature must be rejected");
    });

    it("should successfully sign and verify a token with the valid active secret", async () => {
      const payload: SessionPayload = {
        sub: "legit-user-id",
        email: "legit@byteinn.local",
        name: "Legit Staff",
        role: RoleName.RECEPTIONIST,
      };

      const token = await AuthService.createSessionToken(payload);
      const verified = await AuthService.verifySessionToken(token);
      assert.ok(verified !== null);
      assert.equal(verified?.sub, payload.sub);
      assert.equal(verified?.role, RoleName.RECEPTIONIST);
    });
  });

  // =========================================================================
  // 2. Session Validity, Account Status & RBAC Freshness (Priority 3)
  // =========================================================================
  describe("Priority 3: Database-Backed Session Validity & Dynamic RBAC", () => {
    let testAdminRoleId: string;
    let testReceptionistRoleId: string;
    let testUserId: string;

    before(async () => {
      const adminRole = await prisma.role.upsert({
        where: { name: RoleName.ADMIN },
        update: {},
        create: { name: RoleName.ADMIN, description: "Administrator" },
      });
      testAdminRoleId = adminRole.id;

      const receptionistRole = await prisma.role.upsert({
        where: { name: RoleName.RECEPTIONIST },
        update: {},
        create: { name: RoleName.RECEPTIONIST, description: "Receptionist" },
      });
      testReceptionistRoleId = receptionistRole.id;

      const passwordHash = await AuthService.hashPassword("SecurePass@123");
      const testUser = await prisma.user.upsert({
        where: { email: "sec-test@byteinn.local" },
        update: {
          roleId: testAdminRoleId,
          status: "ACTIVE",
          passwordHash,
        },
        create: {
          name: "Sec Test Admin",
          email: "sec-test@byteinn.local",
          passwordHash,
          roleId: testAdminRoleId,
          status: "ACTIVE",
        },
      });
      testUserId = testUser.id;
    });

    after(async () => {
      if (testUserId) {
        await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
        await prisma.user.deleteMany({ where: { id: testUserId } });
      }
    });

    it("should allow active user with valid token and matching role", async () => {
      const token = await AuthService.createSessionToken({
        sub: testUserId,
        email: "sec-test@byteinn.local",
        name: "Sec Test Admin",
        role: RoleName.ADMIN,
      });

      const session = await requireAuth([RoleName.ADMIN], token);
      assert.equal(session.sub, testUserId);
      assert.equal(session.role, RoleName.ADMIN);
    });

    it("should reject token when required role is not matched", async () => {
      const token = await AuthService.createSessionToken({
        sub: testUserId,
        email: "sec-test@byteinn.local",
        name: "Sec Test Admin",
        role: RoleName.ADMIN,
      });

      await assert.rejects(
        async () => {
          await requireAuth([RoleName.RECEPTIONIST], token);
        },
        (err: unknown) =>
          err instanceof AuthError &&
          err.statusCode === 403 &&
          err.message.includes("Access denied")
      );
    });

    it("should enforce immediate role demotion from database regardless of JWT claims", async () => {
      // 1. User has an ADMIN token
      const tokenWithAdminClaim = await AuthService.createSessionToken({
        sub: testUserId,
        email: "sec-test@byteinn.local",
        name: "Sec Test Admin",
        role: RoleName.ADMIN,
      });

      // 2. Demote user in database to RECEPTIONIST
      await prisma.user.update({
        where: { id: testUserId },
        data: { roleId: testReceptionistRoleId },
      });

      // 3. User attempts an ADMIN-only endpoint using their existing ADMIN token
      await assert.rejects(
        async () => {
          await requireAuth([RoleName.ADMIN], tokenWithAdminClaim);
        },
        (err: unknown) =>
          err instanceof AuthError &&
          err.statusCode === 403 &&
          err.message.includes("Access denied"),
        "Demoted user must be rejected from admin endpoints even if JWT claims ADMIN"
      );

      // 4. User should now be recognized as RECEPTIONIST
      const session = await requireAuth([RoleName.RECEPTIONIST], tokenWithAdminClaim);
      assert.equal(session.role, RoleName.RECEPTIONIST);

      // Restore role to ADMIN
      await prisma.user.update({
        where: { id: testUserId },
        data: { roleId: testAdminRoleId },
      });
    });

    it("should immediately reject disabled user accounts", async () => {
      const token = await AuthService.createSessionToken({
        sub: testUserId,
        email: "sec-test@byteinn.local",
        name: "Sec Test Admin",
        role: RoleName.ADMIN,
      });

      // Disable account
      await prisma.user.update({
        where: { id: testUserId },
        data: { status: "DISABLED" },
      });

      // requireAuth must reject with 403
      await assert.rejects(
        async () => {
          await requireAuth(undefined, token);
        },
        (err: unknown) =>
          err instanceof AuthError &&
          err.statusCode === 403 &&
          err.message.includes("User account is disabled")
      );

      // getSession must return null
      const session = await getSession(token);
      assert.equal(session, null);

      // Restore account
      await prisma.user.update({
        where: { id: testUserId },
        data: { status: "ACTIVE" },
      });
    });

    it("should immediately reject deleted users", async () => {
      // Create a temporary user
      const tempUser = await prisma.user.create({
        data: {
          name: "Temp User",
          email: "temp-deleted@byteinn.local",
          passwordHash: "hash",
          roleId: testReceptionistRoleId,
          status: "ACTIVE",
        },
      });

      const token = await AuthService.createSessionToken({
        sub: tempUser.id,
        email: tempUser.email,
        name: tempUser.name,
        role: RoleName.RECEPTIONIST,
      });

      // Delete the user
      await prisma.user.delete({ where: { id: tempUser.id } });

      // Token for deleted user must fail
      await assert.rejects(
        async () => {
          await requireAuth(undefined, token);
        },
        (err: unknown) =>
          err instanceof AuthError &&
          err.statusCode === 401 &&
          err.message.includes("User account not found or deleted")
      );

      const session = await getSession(token);
      assert.equal(session, null);
    });

    it("should reject missing or empty session token", async () => {
      await assert.rejects(
        async () => {
          await requireAuth(undefined, null);
        },
        (err: unknown) =>
          err instanceof AuthError &&
          err.statusCode === 401 &&
          err.message === "Authentication required"
      );
    });
  });

  // =========================================================================
  // 3. Login Abuse Protection / Rate Limiter (Priority 4)
  // =========================================================================
  describe("Priority 4: Login Rate Limiting & Abuse Prevention", () => {
    it("should allow requests within rate limits and block once exceeded", () => {
      const limiter = new RateLimiter();
      const clientKey = "test-ip-127.0.0.1";

      assert.equal(limiter.check(clientKey, 3, 60).allowed, true);
      limiter.recordAttempt(clientKey);
      assert.equal(limiter.check(clientKey, 3, 60).allowed, true);
      limiter.recordAttempt(clientKey);
      assert.equal(limiter.check(clientKey, 3, 60).allowed, true);
      limiter.recordAttempt(clientKey);

      // 4th attempt must be rejected
      const result = limiter.check(clientKey, 3, 60);
      assert.equal(result.allowed, false);
      assert.ok(result.retryAfterSeconds > 0 && result.retryAfterSeconds <= 60);
    });

    it("should isolate rate limit tracking across different keys", () => {
      const limiter = new RateLimiter();
      const ip1 = "10.0.0.1";
      const ip2 = "10.0.0.2";

      limiter.recordAttempt(ip1);
      limiter.recordAttempt(ip1);
      assert.equal(limiter.check(ip1, 2, 60).allowed, false);

      // ip2 is completely untouched
      assert.equal(limiter.check(ip2, 2, 60).allowed, true);
      limiter.recordAttempt(ip2);
      assert.equal(limiter.check(ip2, 2, 60).allowed, true);
      limiter.recordAttempt(ip2);
      assert.equal(limiter.check(ip2, 2, 60).allowed, false);
    });

    it("should reset rate limit counters on successful authentication", () => {
      const limiter = new RateLimiter();
      const key = "user@byteinn.local";

      limiter.recordAttempt(key);
      limiter.recordAttempt(key);
      assert.equal(limiter.check(key, 2, 60).allowed, false);

      // Reset upon successful login
      limiter.reset(key);
      assert.equal(limiter.check(key, 2, 60).allowed, true);
    });
  });

  // =========================================================================
  // 4. Pagination Bounds & Input Sanitization (Priority 5)
  // =========================================================================
  describe("Priority 5: Pagination Bounds & Sanitization", () => {
    it("should validate and coerce normal pagination inputs", () => {
      const parsed = paginationQuerySchema.safeParse({ page: 2, limit: 25 });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.page, 2);
        assert.equal(parsed.data.limit, 25);
      }
    });

    it("should coerce string numbers correctly", () => {
      const parsed = paginationQuerySchema.safeParse({ page: "3", limit: "50" });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.page, 3);
        assert.equal(parsed.data.limit, 50);
      }
    });

    it("should apply default values when page and limit are missing", () => {
      const parsed = paginationQuerySchema.safeParse({});
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.page, 1);
        assert.equal(parsed.data.limit, 25);
      }
    });

    it("should reject negative or zero page values", () => {
      const zero = paginationQuerySchema.safeParse({ page: 0 });
      assert.equal(zero.success, false);

      const negative = paginationQuerySchema.safeParse({ page: -5 });
      assert.equal(negative.success, false);
    });

    it("should reject negative or zero limit values", () => {
      const zero = paginationQuerySchema.safeParse({ limit: 0 });
      assert.equal(zero.success, false);

      const negative = paginationQuerySchema.safeParse({ limit: -10 });
      assert.equal(negative.success, false);
    });

    it("should reject limit values exceeding MAX_PAGE_SIZE (100)", () => {
      const excessive = paginationQuerySchema.safeParse({ limit: 101 });
      assert.equal(excessive.success, false);

      const huge = paginationQuerySchema.safeParse({ limit: 5000 });
      assert.equal(huge.success, false);
    });

    it("should sanitize pagination defensively with sanitizePagination helper", () => {
      const clampedNegative = sanitizePagination(-5, -10);
      assert.equal(clampedNegative.page, 1);
      assert.equal(clampedNegative.limit, 1);
      assert.equal(clampedNegative.skip, 0);

      const clampedHuge = sanitizePagination(2, 500);
      assert.equal(clampedHuge.page, 2);
      assert.equal(clampedHuge.limit, MAX_PAGE_SIZE);
      assert.equal(clampedHuge.skip, MAX_PAGE_SIZE);
    });
  });

  // =========================================================================
  // 5. Date Query Validation (Priority 5)
  // =========================================================================
  describe("Priority 5: Date Query Validation in CheckInOutService & API", () => {
    it("should accept valid date string 'YYYY-MM-DD'", () => {
      const dateStr = "2026-10-15";
      const parsed = normalizeDate(dateStr);
      assert.ok(parsed instanceof Date);
      assert.equal(parsed.toISOString().startsWith("2026-10-15"), true);
    });

    it("should reject malformed or invalid date strings with BadRequestError", () => {
      assert.throws(
        () => normalizeDate("not-a-date"),
        (err: unknown) =>
          err instanceof BadRequestError &&
          err.statusCode === 400 &&
          err.message.includes("Invalid date format")
      );

      assert.throws(
        () => normalizeDate("2026-02-31"),
        (err: unknown) =>
          err instanceof BadRequestError &&
          err.statusCode === 400 &&
          err.message.includes("Invalid calendar date")
      );

      assert.throws(
        () => normalizeDate("2026-13-45"),
        (err: unknown) =>
          err instanceof BadRequestError &&
          err.statusCode === 400 &&
          err.message.includes("Invalid calendar date")
      );
    });
  });

  // =========================================================================
  // 6. Typed Domain Error Handling & API Response Safety (Priority 5)
  // =========================================================================
  describe("Priority 5: Typed Domain Error Hierarchy & API Handling", () => {
    it("should instantiate specific domain errors with correct HTTP status codes", () => {
      const notFound = new NotFoundError("Entity not found");
      assert.ok(notFound instanceof DomainError);
      assert.equal(notFound.statusCode, 404);
      assert.equal(notFound.message, "Entity not found");

      const conflict = new ConflictError("Resource state conflict");
      assert.ok(conflict instanceof DomainError);
      assert.equal(conflict.statusCode, 409);

      const badRequest = new BadRequestError("Validation failed");
      assert.ok(badRequest instanceof DomainError);
      assert.equal(badRequest.statusCode, 400);

      const forbidden = new ForbiddenError("Not allowed");
      assert.ok(forbidden instanceof DomainError);
      assert.equal(forbidden.statusCode, 403);

      const unauthorized = new UnauthorizedError("Please login");
      assert.ok(unauthorized instanceof DomainError);
      assert.equal(unauthorized.statusCode, 401);
    });

    it("should map domain errors to proper JSON HTTP responses via handleApiError", async () => {
      const domainErr = new NotFoundError("Room 404 not found");
      const res = handleApiError(domainErr);
      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.error, "Room 404 not found");
      assert.equal(json.code, "NOT_FOUND");
    });

    it("should mask unexpected errors with HTTP 500 without leaking stack traces or internal details", async () => {
      const secretError = new Error("FATAL: connection to pgpool-internal failed password=secret123");
      const res = handleApiError(secretError);
      assert.equal(res.status, 500);
      const json = await res.json();
      assert.equal(json.error, "An unexpected internal server error occurred");
      assert.equal(json.stack, undefined);
      assert.ok(!JSON.stringify(json).includes("secret123"));
    });
  });
});
