import { notFound, redirect } from "next/navigation"
import { getSession, resolveScope } from "@/lib/auth-guard"
import { CustomerService } from "@/modules/customers/customer.service"
import { AppShell } from "@/components/app-shell"
import { CustomerDetailView } from "./customer-detail-view"

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  const { id } = await params
  const scope = resolveScope(session, null, { allowSuperAdminGlobal: true })
  let customer
  try {
    customer = await CustomerService.getCustomerById(id, scope ?? undefined)
  } catch {
    notFound()
  }

  const serializedCustomer = {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: customer.email,
    nationality: customer.nationality,
    address: customer.address,
    idProofType: customer.idProofType,
    idProofNumber: customer.idProofNumber,
    remarks: customer.remarks,
    createdAt: customer.createdAt.toISOString(),
    reservations: customer.reservations.map((r) => ({
      id: r.id,
      reservationNo: r.reservationNo,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      rooms: r.rooms.map((rm) => ({
        id: rm.id,
        roomNo: rm.room.roomNo,
        categoryName: rm.roomCategory.name,
        arrivalDate: rm.arrivalDate.toISOString().split("T")[0]!,
        departureDate: rm.departureDate.toISOString().split("T")[0]!,
        bookedNightlyRate: rm.bookedNightlyRate.toString(),
        status: rm.status,
      })),
    })),
  }

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
        <CustomerDetailView customer={serializedCustomer} />
      </div>
    </AppShell>
  )
}
