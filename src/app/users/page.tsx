import { redirect } from "next/navigation";
import { RoleName } from "@prisma/client";
import { getSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { UserService } from "@/modules/users/user.service";
import { AppShell } from "@/components/app-shell";
import { UserManagement } from "./user-management";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.mustChangePassword) {
    redirect("/change-password");
  }

  // Only SUPER_ADMIN and ADMIN are allowed to access user management
  if (
    session.role !== RoleName.SUPER_ADMIN &&
    session.role !== RoleName.ADMIN
  ) {
    redirect("/");
  }

  // Fetch users within caller's scope
  let users: Awaited<ReturnType<typeof UserService.listUsers>> = [];
  try {
    users = await UserService.listUsers(session);
  } catch (err) {
    console.error("Failed to list users:", err);
  }

  // Fetch assignable roles
  let allRoles: Awaited<ReturnType<typeof prisma.role.findMany>> = [];
  try {
    allRoles = await prisma.role.findMany({
      orderBy: { name: "asc" },
    });
  } catch (err) {
    console.error("Failed to fetch roles:", err);
  }
  const assignableRoles =
    session.role === RoleName.ADMIN
      ? allRoles.filter((r) => r.name === RoleName.RECEPTIONIST)
      : allRoles;

  // Fetch properties
  let properties: { id: string; name: string; status: string }[] = [];
  try {
    properties =
      session.role === RoleName.SUPER_ADMIN
        ? await prisma.property.findMany({
            select: { id: true, name: true, status: true },
            orderBy: { name: "asc" },
          })
        : session.property
        ? [{ id: session.property.id, name: session.property.name, status: "ACTIVE" }]
        : [];
  } catch (err) {
    console.error("Failed to fetch properties:", err);
  }

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roleId: u.roleId,
    role: u.role,
    propertyId: u.propertyId,
    property: u.property,
    status: u.status,
    mustChangePassword: u.mustChangePassword,
    tokenVersion: u.tokenVersion,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <UserManagement
          session={session}
          initialUsers={serializedUsers}
          roles={assignableRoles}
          properties={properties}
        />
      </div>
    </AppShell>
  );
}
