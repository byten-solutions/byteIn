import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { AuthService } from "../src/modules/auth/auth.service";
import { parseArgs, rotatePasswords } from "../scripts/rotate-seeded-passwords";

describe("Rotate Seeded Passwords CLI Tool", () => {
  const testEmail = `test-rotate-${Date.now()}@byteinn.test`;
  let testUserId = "";

  before(async () => {
    let role = await prisma.role.findFirst({ where: { name: "RECEPTIONIST" } });
    if (!role) {
      role = await prisma.role.create({
        data: { name: "RECEPTIONIST", description: "Test receptionist" },
      });
    }

    const initialHash = await AuthService.hashPassword("InitialPass@123");
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Test Rotate User",
        passwordHash: initialHash,
        roleId: role.id,
        status: "ACTIVE",
        mustChangePassword: false,
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

  it("should parse CLI arguments correctly", () => {
    assert.deepEqual(parseArgs(["--all-seeded"]), { allSeeded: true });
    assert.deepEqual(parseArgs(["--email", "test@byteinn.local"]), { email: "test@byteinn.local" });
    assert.deepEqual(parseArgs(["--all-seeded", "--disable"]), { allSeeded: true, disable: true });
  });

  it("should reject passwords shorter than 12 characters", async () => {
    await assert.rejects(
      async () => {
        await rotatePasswords(prisma, { email: testEmail }, "short123");
      },
      /at least 12 characters/
    );
  });

  it("should successfully rotate password and set must_change_password = true", async () => {
    const newStrongPass = "BrandNewSuperSecret@2026!";
    const res = await rotatePasswords(prisma, { email: testEmail }, newStrongPass);

    assert.equal(res.action, "ROTATED");
    assert.equal(res.count, 1);

    const updated = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.ok(updated);
    assert.equal(updated.mustChangePassword, true);
    assert.equal(updated.tokenVersion, 2);

    const verified = await AuthService.verifyPassword(newStrongPass, updated.passwordHash);
    assert.equal(verified, true);
  });

  it("should support disabling accounts via --disable flag", async () => {
    const res = await rotatePasswords(prisma, { email: testEmail, disable: true });

    assert.equal(res.action, "DISABLED");
    assert.equal(res.count, 1);

    const disabledUser = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.ok(disabledUser);
    assert.equal(disabledUser.status, "DISABLED");
    assert.equal(disabledUser.tokenVersion, 3);
  });
});
