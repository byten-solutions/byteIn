import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { BillingService } from "@/modules/billing/billing.service";
import { Navbar } from "@/components/navbar";
import { InvoiceDetailView } from "./invoice-detail-view";

interface InvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: InvoicePageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  let invoice;
  try {
    invoice = await BillingService.getInvoiceById(id);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-svh bg-muted/15 flex flex-col">
      <Navbar />
      <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-8 flex-1">
        <InvoiceDetailView initialInvoice={invoice} />
      </main>
    </div>
  );
}
