import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth-guard"
import { BillingService } from "@/modules/billing/billing.service"
import { AppShell } from "@/components/app-shell"
import { InvoiceList } from "./invoice-list"

export default async function BillingPage() {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }
  if (session.mustChangePassword) {
    redirect("/change-password")
  }

  const initialData = await BillingService.getInvoices({ page: 1, limit: 25 })

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
        <InvoiceList initialData={initialData} />
      </div>
    </AppShell>
  )
}
