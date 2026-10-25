import { redirect } from "next/navigation"
import { getSession, resolveScope } from "@/lib/auth-guard"
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination"
import { CustomerService } from "@/modules/customers/customer.service"
import { AppShell } from "@/components/app-shell"
import { CustomerList } from "./customer-list"

export default async function CustomersPage(props: {
  searchParams?: Promise<{ propertyId?: string; page?: string; limit?: string; search?: string; tab?: string }>
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

  const page = searchParams?.page ? parseInt(searchParams.page, 10) : 1
  const limit = searchParams?.limit ? parseInt(searchParams.limit, 10) : DEFAULT_PAGE_SIZE
  const tabParam = searchParams?.tab
  const tab =
    tabParam === "IN_HOUSE" || tabParam === "UPCOMING" || tabParam === "REPEAT"
      ? tabParam
      : undefined

  let result: Awaited<ReturnType<typeof CustomerService.getCustomers>> = {
    customers: [],
    pagination: {
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? DEFAULT_PAGE_SIZE : limit,
      total: 0,
      totalPages: 1,
    },
  }

  try {
    result = await CustomerService.getCustomers({
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? DEFAULT_PAGE_SIZE : limit,
      search: searchParams?.search,
      tab,
      propertyId: scope ?? undefined,
    })
  } catch (err) {
    console.error("Failed to load customers in CustomersPage:", err)
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
          initialTab={tab || "ALL"}
        />
      </div>
    </AppShell>
  )
}
