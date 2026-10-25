import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth-guard"
import { BillingService } from "@/modules/billing/billing.service"
import { ReservationService } from "@/modules/reservations/reservation.service"

interface PrintReservationPageProps {
  params: Promise<{ id: string }>
}

export default async function PrintReservationPage({ params }: PrintReservationPageProps) {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  const { id } = await params

  // 1. If an invoice exists for this reservation, redirect directly to its invoice print page
  const invoice = await BillingService.getInvoiceByReservationId(id).catch(() => null)
  if (invoice) {
    redirect(`/billing/${invoice.id}/print`)
  }

  // 2. Otherwise verify reservation exists or 404
  const reservation = await ReservationService.getReservationById(id).catch(() => null)
  if (!reservation) {
    notFound()
  }

  // Fallback: If no invoice yet, redirect to reservation detail page with instructions
  redirect(`/reservations/${id}`)
}
