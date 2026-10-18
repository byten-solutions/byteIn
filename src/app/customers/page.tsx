import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth-guard"
import { CustomerService } from "@/modules/customers/customer.service"
import { AppShell } from "@/components/app-shell"
import { CustomerList } from "./customer-list"

export default async function CustomersPage() {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }
  if (session.mustChangePassword) {
    redirect("/change-password")
  }

  const result = await CustomerService.getCustomers({ page: 1, limit: 20 })

  const serializedCustomers = result.customers.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    email: c.email,
    nationality: c.nationality,
    address: c.address,
    idProofType: c.idProofType,
    idProofNumber: c.idProofNumber,
    remarks: c.remarks,
    reservationsCount: c._count.reservations,
    createdAt: c.createdAt.toISOString(),
    reservations: c.reservations?.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      rooms: r.rooms.map((rm) => ({
        arrivalDate: rm.arrivalDate.toISOString().split("T")[0],
        departureDate: rm.departureDate.toISOString().split("T")[0],
        status: rm.status,
      })),
    })) || [],
  }))

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
        <CustomerList
          initialCustomers={serializedCustomers}
          initialPagination={result.pagination}
        />
      </div>
    </AppShell>
  )
}
