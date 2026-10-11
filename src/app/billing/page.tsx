import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";
import { Navbar } from "@/components/navbar";
import { InvoiceList } from "./invoice-list";

export default async function BillingPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const initialData = await BillingService.getInvoices({ page: 1, limit: 25 });

  return (
    <div className="min-h-svh bg-muted/15 flex flex-col">
      <Navbar />
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-8 flex-1">
        <InvoiceList initialData={initialData} />
      </main>
    </div>
  );
}
