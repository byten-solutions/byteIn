import { redirect } from "next/navigation"
import { getSession, resolveScope } from "@/lib/auth-guard"
import { RoomCategoryService } from "@/modules/rooms/room.service"
import { AppShell } from "@/components/app-shell"
import { NewReservationForm } from "./new-reservation-form"

export default async function NewReservationPage(props: {
  searchParams?: Promise<{ propertyId?: string }>
}) {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  const searchParams = props.searchParams ? await props.searchParams : undefined
  const scope = resolveScope(session, searchParams?.propertyId, { allowSuperAdminGlobal: true })

  let categories: Awaited<ReturnType<typeof RoomCategoryService.getCategories>> = []
  try {
    categories = await RoomCategoryService.getCategories(scope ?? undefined)
  } catch (err) {
    console.error("Failed to load categories for new reservation:", err)
  }
  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    basePrice: c.basePrice.toString(),
    maxOccupancy: c.maxOccupancy,
  }))

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
        <NewReservationForm categories={serializedCategories} />
      </div>
    </AppShell>
  )
}
