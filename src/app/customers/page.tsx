import { redirect } from "next/navigation"
import { getSession, resolveScope } from "@/lib/auth-guard"
import { CustomerService } from "@/modules/customers/customer.service"
import { AppShell } from "@/components/app-shell"
import { CustomerList } from "./customer-list"

export default async function CustomersPage(props: {
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

  let result: Awaited<ReturnType<typeof CustomerService.getCustomers>> = {
    customers: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    },
  }

  try {
    result = await CustomerService.getCustomers({
      page: 1,
      limit: 20,
      propertyId: scope ?? undefined,
    })
  } catch (err) {
    console.error("Failed to load customers:", err)
  }

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
