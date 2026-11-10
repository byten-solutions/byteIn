import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { RoleName } from "@prisma/client";
import { AuthService } from "../src/modules/auth/auth.service";
import FinancePage from "../src/app/finance/page";
import { getNavItems } from "../src/components/app-sidebar";
import { NextRequest } from "next/server";

// Next.js redirect errors have a digest property formatted like "NEXT_REDIRECT;replace;/target;307;"
function getRedirectTarget(error: unknown): string | null {
  if (error && typeof error === "object" && "digest" in error) {
    const digest = String((error as { digest: unknown }).digest);
    if (digest.startsWith("NEXT_REDIRECT")) {
      const parts = digest.split(";");
      return parts[2] || parts[1] || null;
    }
  }
  return null;
}

function makeReq(
  url: string,
  method: string,
  token?: string,
  body?: object
): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["cookie"] = `byteinn_session=${token}`;
  }
  return new NextRequest(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("Phase 2 Stage 4: Finance Admin UI & Access Control", () => {
  let propA: { id: string; name: string };
  let propB: { id: string; name: string };

  let tokenSuperAdmin: string;
  let tokenAdminA: string;
  let tokenRecepA: string;

  let superAdminUser: { id: string };
  let adminAUser: { id: string };
  let recepAUser: { id: string };

  before(async () => {
    // 1. Roles
    const superAdminRole = await prisma.role.upsert({
      where: { name: RoleName.SUPER_ADMIN },
      update: {},
      create: { name: RoleName.SUPER_ADMIN, description: "Platform super admin" },
    });
    const adminRole = await prisma.role.upsert({
      where: { name: RoleName.ADMIN },
      update: {},
      create: { name: RoleName.ADMIN, description: "Hotel Admin" },
    });
    const recepRole = await prisma.role.upsert({
      where: { name: RoleName.RECEPTIONIST },
      update: {},
      create: { name: RoleName.RECEPTIONIST, description: "Hotel Receptionist" },
    });

    // 2. Properties
    propA = await prisma.property.create({
      data: {
        name: `Finance UI Hotel A ${Date.now()}`,
        status: "ACTIVE",
        address: "100 Sea Beach Rd",
        city: "Goa",
      },
    });
    propB = await prisma.property.create({
      data: {
        name: `Finance UI Hotel B ${Date.now()}`,
        status: "ACTIVE",
        address: "200 Mountain Peak Rd",
        city: "Manali",
      },
    });

    const passwordHash = await AuthService.hashPassword("Password@123");

    // 3. Users
    superAdminUser = await prisma.user.create({
      data: {
        name: "Super Admin",
        email: `super_ui_${Date.now()}@byteinn.local`,
        passwordHash,
        roleId: superAdminRole.id,
        status: "ACTIVE",
      },
    });

    adminAUser = await prisma.user.create({
      data: {
        name: "Admin Hotel A",
        email: `admin_ui_a_${Date.now()}@byteinn.local`,
        passwordHash,
        roleId: adminRole.id,
        propertyId: propA.id,
        status: "ACTIVE",
      },
    });

    recepAUser = await prisma.user.create({
      data: {
        name: "Receptionist Hotel A",
        email: `recep_ui_a_${Date.now()}@byteinn.local`,
        passwordHash,
        roleId: recepRole.id,
        propertyId: propA.id,
        status: "ACTIVE",
      },
    });

    // 4. Tokens
    tokenSuperAdmin = await AuthService.createSessionToken({
      sub: superAdminUser.id,
      email: "super_ui@byteinn.local",
      name: "Super Admin",
      role: RoleName.SUPER_ADMIN,
      tokenVersion: 1,
      mustChangePassword: false,
    });

    tokenAdminA = await AuthService.createSessionToken({
      sub: adminAUser.id,
      email: "admin_ui_a@byteinn.local",
      name: "Admin Hotel A",
      role: RoleName.ADMIN,
      propertyId: propA.id,
      tokenVersion: 1,
      mustChangePassword: false,
    });

    tokenRecepA = await AuthService.createSessionToken({
      sub: recepAUser.id,
      email: "recep_ui_a@byteinn.local",
      name: "Receptionist Hotel A",
      role: RoleName.RECEPTIONIST,
      propertyId: propA.id,
      tokenVersion: 1,
      mustChangePassword: false,
    });
  });

  after(async () => {
    // Cleanup in foreign key order
    const propIds = [propA?.id, propB?.id].filter(Boolean);
    if (propIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { user: { id: { in: [superAdminUser?.id, adminAUser?.id, recepAUser?.id].filter(Boolean) } } },
      }).catch(() => {});

      await prisma.paymentMethod.deleteMany({
        where: { propertyId: { in: propIds } },
      }).catch(() => {});

      await prisma.financialAccount.deleteMany({
        where: { propertyId: { in: propIds } },
      }).catch(() => {});
    }

    await prisma.user.deleteMany({
      where: { id: { in: [superAdminUser?.id, adminAUser?.id, recepAUser?.id].filter(Boolean) } },
    }).catch(() => {});

    await prisma.property.deleteMany({
      where: { id: { in: propIds } },
    }).catch(() => {});
  });

  describe("Server Page Route Guards (src/app/finance/page.tsx)", () => {
    it("redirects unauthenticated users to /login", async () => {
      try {
        await FinancePage({});
        assert.fail("Should have redirected");
      } catch (err: unknown) {
        const dest = getRedirectTarget(err);
        assert.strictEqual(dest, "/login");
      }
    });

    it("verifies session role restrictions via auth guard", async () => {
      // In the auth-guard system, requireAuth(['ADMIN', 'SUPER_ADMIN']) rejects RECEPTIONIST with 403 AuthError
      const { requireAuth, AuthError } = await import("../src/lib/auth-guard");

      // Verify RECEPTIONIST is rejected with 403
      await assert.rejects(
        async () => {
          await requireAuth([RoleName.ADMIN, RoleName.SUPER_ADMIN], tokenRecepA);
        },
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );

      // Verify ADMIN is authorized
      const adminSession = await requireAuth(
        [RoleName.ADMIN, RoleName.SUPER_ADMIN],
        tokenAdminA
      );
      assert.strictEqual(adminSession.role, RoleName.ADMIN);
      assert.strictEqual(adminSession.propertyId, propA.id);

      // Verify SUPER_ADMIN is authorized
      const superSession = await requireAuth(
        [RoleName.ADMIN, RoleName.SUPER_ADMIN],
        tokenSuperAdmin
      );
      assert.strictEqual(superSession.role, RoleName.SUPER_ADMIN);
    });
  });

  describe("Sidebar Navigation Invariants (src/components/app-sidebar.tsx)", () => {
    it("confirms Finance navigation item is exposed to ADMIN and SUPER_ADMIN, and hidden from RECEPTIONIST", () => {
      const superAdminNav = getNavItems(RoleName.SUPER_ADMIN);
      const adminNav = getNavItems(RoleName.ADMIN);
      const recepNav = getNavItems(RoleName.RECEPTIONIST);

      const hasFinance = (sections: ReturnType<typeof getNavItems>) =>
        sections.some((sec) => sec.items.some((item) => item.href === "/finance"));

      assert.strictEqual(hasFinance(superAdminNav), true, "SUPER_ADMIN must have Finance item");
      assert.strictEqual(hasFinance(adminNav), true, "ADMIN must have Finance item");
      assert.strictEqual(hasFinance(recepNav), false, "RECEPTIONIST must NOT have Finance item");
    });
  });

  describe("API Route Authorization Enforcement", () => {
    it("RECEPTIONIST is strictly forbidden from creating financial accounts (403)", async () => {
      const { POST } = await import("../src/app/api/financial-accounts/route");

      const req = makeReq("http://localhost:3000/api/financial-accounts", "POST", tokenRecepA, {
        propertyId: propA.id,
        accountName: "Unauthorized Cash Box",
        accountType: "CASH",
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.ok(
        json.error.includes("Access denied") ||
          json.error.includes("Forbidden") ||
          json.error.includes("insufficient permissions")
      );
    });

    it("RECEPTIONIST is strictly forbidden from executing account transfers (403)", async () => {
      const { POST } = await import("../src/app/api/account-transfers/route");

      const req = makeReq("http://localhost:3000/api/account-transfers", "POST", tokenRecepA, {
        propertyId: propA.id,
        fromAccountId: "any-account-id",
        toAccountId: "other-account-id",
        amount: 500,
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 403);
    });

    it("RECEPTIONIST is strictly forbidden from creating or modifying payment methods (403)", async () => {
      const { POST } = await import("../src/app/api/payment-methods/route");

      const req = makeReq("http://localhost:3000/api/payment-methods", "POST", tokenRecepA, {
        propertyId: propA.id,
        code: "BITCOIN",
        name: "Bitcoin Crypto",
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 403);
    });

    it("ADMIN can successfully create accounts and configure methods for their own property", async () => {
      const { POST: createAccount } = await import("../src/app/api/financial-accounts/route");
      const { POST: createMethod } = await import("../src/app/api/payment-methods/route");

      // 1. Create Account
      const accReq = makeReq("http://localhost:3000/api/financial-accounts", "POST", tokenAdminA, {
        propertyId: propA.id,
        accountName: "Front Desk Cash Float",
        accountType: "CASH",
        openingBalance: 1500,
        isDefault: true,
      });

      const accRes = await createAccount(accReq);
      assert.strictEqual(accRes.status, 201);
      const accData = await accRes.json();
      assert.ok(accData.account.id);
      assert.strictEqual(accData.account.accountName, "Front Desk Cash Float");

      // 2. Create Payment Method linked to default account
      const pmReq = makeReq("http://localhost:3000/api/payment-methods", "POST", tokenAdminA, {
        propertyId: propA.id,
        code: "CASH_FRONT_DESK",
        name: "Front Desk Cash",
        defaultAccountId: accData.account.id,
      });

      const pmRes = await createMethod(pmReq);
      assert.strictEqual(pmRes.status, 201);
      const pmData = await pmRes.json();
      assert.strictEqual(pmData.paymentMethod.code, "CASH_FRONT_DESK");
      assert.strictEqual(pmData.paymentMethod.defaultAccountId, accData.account.id);
    });
  });
});
