import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

export default async function ReportsPage(props: {
  searchParams?: Promise<{
    propertyId?: string
    date?: string
  }>
}) {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  const searchParams = props.searchParams ? await props.searchParams : {}
  const propertyId = searchParams.propertyId || session.propertyId

  const q = new URLSearchParams()
  if (propertyId) q.set("propertyId", propertyId)
  if (searchParams.date) q.set("date", searchParams.date)

  const queryString = q.toString() ? `?${q.toString()}` : ""
  redirect(`/reports/daily-operations${queryString}`)
}
