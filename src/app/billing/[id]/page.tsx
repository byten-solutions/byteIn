import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth-guard"
import { BillingService } from "@/modules/billing/billing.service"
import { AppShell } from "@/components/app-shell"
import { InvoiceDetailView } from "./invoice-detail-view"

interface InvoicePageProps {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: InvoicePageProps) {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  const { id } = await params
  let invoice
  try {
    invoice = await BillingService.getInvoiceById(id)
  } catch {
    notFound()
  }

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
        <InvoiceDetailView initialInvoice={invoice} />
      </div>
    </AppShell>
  )
}
