import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { getSession, requireAuth, AuthError } from "../src/lib/auth-guard";
import { AuthService } from "../src/modules/auth/auth.service";
import { RoleName } from "../src/modules/auth/auth.types";
import { POST as logoutHandler } from "../src/app/api/auth/logout/route";

describe("AUTH-08: Session Invalidation on Logout", () => {
  let testUserId: string;
  let testUserEmail: string;

  before(async () => {
    // Ensure RECEPTIONIST role exists in test database
    const role = await prisma.role.upsert({
      where: { name: RoleName.RECEPTIONIST },
      update: {},
      create: {
        name: RoleName.RECEPTIONIST,
        description: "Front-desk receptionist",
      },
    });

    testUserEmail = `logout_test_${Date.now()}@byteinn.local`;
    const passwordHash = await AuthService.hashPassword("Password@123");

    const user = await prisma.user.create({
      data: {
        name: "Logout Test User",
        email: testUserEmail,
        passwordHash,
        roleId: role.id,
        status: "ACTIVE",
        tokenVersion: 1,
      },
    });
    testUserId = user.id;
  });

  after(async () => {
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  it("should atomically increment tokenVersion in DB on logout and reject subsequent token replay with 401", async () => {
    // 1. Fetch current user from DB to obtain initial tokenVersion
    const userBefore = await prisma.user.findUniqueOrThrow({ where: { id: testUserId } });
    const initialTokenVersion = userBefore.tokenVersion;

    // 2. Generate a valid session token
    const token = await AuthService.createSessionToken({
      sub: testUserId,
      email: testUserEmail,
      name: "Logout Test User",
      role: RoleName.RECEPTIONIST,
      tokenVersion: initialTokenVersion,
      mustChangePassword: false,
    });

    // 3. Confirm token is valid before logout
    const sessionBefore = await getSession(token);
    assert.ok(sessionBefore !== null, "Session must be valid prior to logout");
    assert.equal(sessionBefore.sub, testUserId);

    // 4. Execute logout route handler with session cookie
    const req = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `byteinn_session=${token}`,
      },
    });

    const logoutResponse = await logoutHandler(req);
    assert.equal(logoutResponse.status, 200, "Logout must return HTTP 200");

    const logoutBody = await logoutResponse.json();
    assert.equal(logoutBody.success, true);
    assert.equal(logoutBody.message, "Logged out successfully");

    // 5. Verify cookie clearing header (AUTH-17)
    const setCookie = logoutResponse.headers.get("set-cookie") || "";
    assert.ok(
      setCookie.includes("byteinn_session=") && (setCookie.includes("Max-Age=0") || setCookie.includes("expires=")),
      "Logout response must return cookie clearing header with Max-Age=0"
    );

    // 6. Verify user's tokenVersion was incremented in PostgreSQL
    const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: testUserId } });
    assert.equal(
      userAfter.tokenVersion,
      initialTokenVersion + 1,
      "user.tokenVersion must be incremented in DB to invalidate stateless tokens"
    );

    // 7. Replay old token: requireAuth MUST reject with 401 (AUTH-08)
    await assert.rejects(
      async () => {
        await requireAuth(undefined, token);
      },
      (err: unknown) => {
        return (
          err instanceof AuthError &&
          err.statusCode === 401 &&
          err.message.includes("Session has been invalidated")
        );
      },
      "requireAuth must throw 401 Session has been invalidated upon token replay"
    );
  });

  it("should handle rapid successive logouts idempotently without throwing (AUTH-48)", async () => {
    // Call logout with an arbitrary / already-invalidated token 3 times
    for (let i = 0; i < 3; i++) {
      const req = new NextRequest("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: {
          cookie: `byteinn_session=invalid_or_already_logged_out_token`,
        },
      });

      const res = await logoutHandler(req);
      assert.equal(res.status, 200, `Successive logout #${i + 1} must return HTTP 200`);
      const body = await res.json();
      assert.equal(body.success, true);
    }
  });
});
