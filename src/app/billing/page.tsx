import { redirect } from "next/navigation"
import { getSession, resolveScope } from "@/lib/auth-guard"
import { BillingService } from "@/modules/billing/billing.service"
import { AppShell } from "@/components/app-shell"
import type { InvoiceListResponse } from "@/modules/billing/billing.types"
import { InvoiceList } from "./invoice-list"

export default async function BillingPage(props: {
  searchParams?: Promise<{ propertyId?: string }>
}) {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }
  if (session.mustChangePassword) {
    redirect("/change-password")
  }

  const searchParams = props.searchParams ? await props.searchParams : undefined
  const scope = resolveScope(session, searchParams?.propertyId, { allowSuperAdminGlobal: true })

  let initialData: InvoiceListResponse
  try {
    initialData = await BillingService.getInvoices({
      page: 1,
      limit: 25,
      propertyId: scope ?? undefined,
    })
  } catch (err) {
    console.error("Failed to load initial invoices in BillingPage:", err)
    initialData = {
      invoices: [],
      total: 0,
      page: 1,
      limit: 25,
      totalPages: 1,
      summary: {
        totalInvoiced: "0.00",
        totalCollected: "0.00",
        totalOutstanding: "0.00",
      },
    }
  }

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
        <InvoiceList initialData={initialData} />
      </div>
    </AppShell>
  )
}
