import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";
import { AppShell } from "@/components/app-shell";
import { InvoiceList } from "./invoice-list";

export default async function BillingPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const initialData = await BillingService.getInvoices({ page: 1, limit: 25 });

  return (
    <AppShell session={session}>
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <InvoiceList initialData={initialData} />
      </div>
    </AppShell>
  );
}
