import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  User,
  ShieldCheck,
  FileText,
  BedDouble,
  ChevronRight,
} from "lucide-react"
import { getSession } from "@/lib/auth-guard"
import { ReservationService } from "@/modules/reservations/reservation.service"
import { BillingService } from "@/modules/billing/billing.service"
import { AppShell } from "@/components/app-shell"
import {
  StatusBadge,
  MoneyText,
} from "@/components/ui-kit"
import { formatDate, formatStayRange } from "@/lib/date-format"
import { AllocationActionRow } from "./allocation-action-row"
import { ReservationBillingCard } from "./reservation-billing-card"
import { ReservationHeaderActions } from "./reservation-header-actions"

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  const { id } = await params
  let reservation
  try {
    reservation = await ReservationService.getReservationById(id)
  } catch {
    notFound()
  }

  const invoice = await BillingService.getInvoiceByReservationId(reservation.id)
  const guestFullName = `${reservation.customer.firstName} ${reservation.customer.lastName || ""}`.trim()

  const getNights = (arrival: Date, departure: Date) => {
    return Math.max(
      1,
      Math.round((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24))
    )
  }

  const totalNights = reservation.rooms.reduce(
    (sum, r) => sum + getNights(r.arrivalDate, r.departureDate),
    0
  )

  const totalBookingValue = reservation.rooms.reduce(
    (sum, r) =>
      sum +
      getNights(r.arrivalDate, r.departureDate) * parseFloat(r.bookedNightlyRate.toString()),
    0
  )

  // Calculate stay dates range
  const arrivalDates = reservation.rooms.map((r) => r.arrivalDate.getTime()).sort()
  const departureDates = reservation.rooms.map((r) => r.departureDate.getTime()).sort()
  const earliestArrival = new Date(arrivalDates[0]!)
  const latestDeparture = new Date(departureDates[departureDates.length - 1]!)

  const stayRangeStr = formatStayRange(earliestArrival, latestDeparture)

  // Contextual primary button selection
  const nextConfirmedRoom = reservation.rooms.find((r) => r.status === "CONFIRMED")
  const nextCheckedInRoom = reservation.rooms.find((r) => r.status === "CHECKED_IN")

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10 space-y-8">
        {/* Top Navigation Back link */}
        <div className="flex items-center gap-2">
          <Link
            href="/reservations"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Reservations</span>
          </Link>
        </div>

        {/* Summary Header */}
        <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-6 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
                #{reservation.reservationNo}
              </h1>
              <StatusBadge status={reservation.status} />
              <span className="text-muted-foreground/40">•</span>
              <Link
                href={`/customers/${reservation.customer.id}`}
                className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                <span>{guestFullName}</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </div>

            <div className="flex items-center gap-x-4 gap-y-1 text-xs text-muted-foreground flex-wrap">
              <span>{stayRangeStr}</span>
              <span>•</span>
              <span>{totalNights} night{totalNights === 1 ? "" : "s"} total</span>
              <span>•</span>
              <span>
                Balance Due:{" "}
                <MoneyText
                  value={invoice ? invoice.balanceDue : totalBookingValue}
                  className="font-bold text-foreground"
                />
              </span>
            </div>
          </div>

          {/* Contextual Header Actions */}
          <div className="shrink-0 self-start lg:self-center">
            <ReservationHeaderActions
              invoiceId={invoice?.id}
              nextConfirmedRoom={
                nextConfirmedRoom
                  ? { id: nextConfirmedRoom.id, roomNo: nextConfirmedRoom.room.roomNo }
                  : null
              }
              nextCheckedInRoom={
                nextCheckedInRoom
                  ? { id: nextCheckedInRoom.id, roomNo: nextCheckedInRoom.room.roomNo }
                  : null
              }
            />
          </div>
        </div>

        {/* 2-Column Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Column: Rooms List (2 Cols on lg) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/10">
                <div className="flex items-center gap-2">
                  <BedDouble className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Allocated Rooms ({reservation.rooms.length})
                  </h2>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {totalNights} night{totalNights === 1 ? "" : "s"}
                </span>
              </div>

              <div className="divide-y divide-border/60">
                {reservation.rooms.map((allocation) => {
                  const arrStr = allocation.arrivalDate.toISOString().split("T")[0]!
                  const depStr = allocation.departureDate.toISOString().split("T")[0]!
                  const nights = getNights(allocation.arrivalDate, allocation.departureDate)
                  const nightlyRate = parseFloat(allocation.bookedNightlyRate.toString())
                  const roomSubtotal = nights * nightlyRate

                  return (
                    <div key={allocation.id} id={`room-${allocation.id}`}>
                      <AllocationActionRow
                        allocation={{
                          id: allocation.id,
                          roomId: allocation.roomId,
                          roomNo: allocation.room.roomNo,
                          roomStatus: allocation.room.status,
                          categoryName: allocation.roomCategory.name,
                          displayName: allocation.room.displayName,
                          buildingName: allocation.room.building.name,
                          floorNo: allocation.room.floor.floorNo,
                          arrivalDate: arrStr,
                          departureDate: depStr,
                          nights,
                          adults: allocation.adults,
                          children: allocation.children,
                          bookedNightlyRate: allocation.bookedNightlyRate.toString(),
                          roomSubtotal,
                          status: allocation.status,
                          checkedInAt: allocation.checkedInAt
                            ? allocation.checkedInAt.toISOString()
                            : null,
                          checkedOutAt: allocation.checkedOutAt
                            ? allocation.checkedOutAt.toISOString()
                            : null,
                        }}
                        customer={{
                          id: reservation.customer.id,
                          firstName: reservation.customer.firstName,
                          lastName: reservation.customer.lastName,
                          idProofType: reservation.customer.idProofType,
                          idProofNumber: reservation.customer.idProofNumber,
                        }}
                        invoice={invoice}
                        estimatedTotal={totalBookingValue}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Rooms list footer with totals */}
              <div className="p-4 border-t border-border/60 bg-muted/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  Total booking value ({reservation.rooms.length} room{reservation.rooms.length === 1 ? "" : "s"}, {totalNights} night{totalNights === 1 ? "" : "s"})
                </span>
                <MoneyText value={totalBookingValue} className="text-base font-bold text-foreground" />
              </div>
            </div>
          </div>

          {/* Side Rail (Quiet, no heavy cards) */}
          <div className="space-y-6 rounded-xl border border-border/80 bg-card p-5 text-xs shadow-xs">
            {/* Primary Guest Details */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                  <User className="size-3.5 text-muted-foreground" />
                  Primary Guest
                </span>
                <Link
                  href={`/customers/${reservation.customer.id}`}
                  className="text-[11px] text-primary hover:underline"
                >
                  Profile
                </Link>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="font-medium text-foreground text-sm">{guestFullName}</div>
                  {reservation.customer.phone && (
                    <div className="text-muted-foreground">{reservation.customer.phone}</div>
                  )}
                  {reservation.customer.email && (
                    <div className="text-muted-foreground">{reservation.customer.email}</div>
                  )}
                </div>

                {reservation.customer.nationality && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Nationality:</span>
                    <span className="text-foreground">{reservation.customer.nationality}</span>
                  </div>
                )}

                {reservation.customer.idProofNumber && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>ID ({reservation.customer.idProofType || "Document"}):</span>
                    <span className="font-mono text-foreground">{reservation.customer.idProofNumber}</span>
                  </div>
                )}

                {reservation.customer.address && (
                  <div className="text-muted-foreground pt-1 border-t border-border/40">
                    <span className="block text-[11px]">Address:</span>
                    <span className="text-foreground">{reservation.customer.address}</span>
                  </div>
                )}

                {reservation.customer.remarks && (
                  <div className="text-muted-foreground pt-1 border-t border-border/40">
                    <span className="block text-[11px]">Guest Notes:</span>
                    <span className="italic text-foreground">{reservation.customer.remarks}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Special Requests */}
            {reservation.specialRequests && (
              <div className="space-y-2 pt-3 border-t border-border/60">
                <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                  <FileText className="size-3.5 text-muted-foreground" />
                  Special Requests
                </span>
                <p className="text-muted-foreground italic leading-relaxed">
                  &quot;{reservation.specialRequests}&quot;
                </p>
              </div>
            )}

            {/* Booked By Record */}
            <div className="space-y-2 pt-3 border-t border-border/60">
              <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-muted-foreground" />
                Booked By
              </span>
              <div className="space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Staff:</span>
                  <span className="font-medium text-foreground">{reservation.creator.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Role:</span>
                  <span className="text-foreground">{reservation.creator.role.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span className="text-foreground">{formatDate(reservation.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Billing & Invoicing Section */}
            <ReservationBillingCard
              reservationId={reservation.id}
              initialInvoice={invoice}
              estimatedTotal={totalBookingValue}
            />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
