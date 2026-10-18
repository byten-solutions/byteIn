import { redirect } from "next/navigation"
import { getSession, resolveScope } from "@/lib/auth-guard"
import { BillingService } from "@/modules/billing/billing.service"
import { AppShell } from "@/components/app-shell"
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

  const initialData = await BillingService.getInvoices({
    page: 1,
    limit: 25,
    propertyId: scope ?? undefined,
  })

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
        <InvoiceList initialData={initialData} />
      </div>
    </AppShell>
  )
}
