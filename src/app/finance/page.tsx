import { redirect } from "next/navigation";
import { RoleName } from "@prisma/client";
import { getSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { FinanceView } from "./finance-view";

export default async function FinancePage(props: {
  searchParams?: Promise<{ propertyId?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.mustChangePassword) {
    redirect("/change-password");
  }

  // Only SUPER_ADMIN and ADMIN are permitted to access Finance management
  if (
    session.role !== RoleName.SUPER_ADMIN &&
    session.role !== RoleName.ADMIN
  ) {
    redirect("/");
  }

  const searchParams = props.searchParams ? await props.searchParams : undefined;

  let properties: { id: string; name: string; city: string | null; status: string }[] = [];
  try {
    properties =
      session.role === RoleName.SUPER_ADMIN
        ? await prisma.property.findMany({
            select: { id: true, name: true, city: true, status: true },
            orderBy: { name: "asc" },
          })
        : session.property
        ? [{ id: session.property.id, name: session.property.name, city: null, status: "ACTIVE" }]
        : [];
  } catch (err) {
    console.error("Failed to load properties in FinancePage:", err);
  }

  const initialPropertyId =
    session.role === RoleName.ADMIN
      ? session.propertyId || ""
      : searchParams?.propertyId || properties[0]?.id || "";

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <FinanceView
          session={session}
          properties={properties}
          initialPropertyId={initialPropertyId}
        />
      </div>
    </AppShell>
  );
}
