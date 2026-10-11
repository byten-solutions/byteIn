"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  CalendarDays,
  Plus,
  Loader2,
  ChevronRight,
  BedDouble,
  Check,
  Undo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  PageHeader,
  StatusBadge,
  FormSection,
  EmptyState,
} from "@/components/ui-kit"
import { getIdProofOptions } from "@/lib/constants"
import { formatDate, formatStayRange } from "@/lib/date-format"

interface SerializedCustomerDetail {
  id: string
  firstName: string
  lastName: string | null
  phone: string | null
  email: string | null
  nationality: string | null
  address: string | null
  idProofType: string | null
  idProofNumber: string | null
  remarks: string | null
  createdAt: string
  reservations: {
    id: string
    reservationNo: string
    status: string
    createdAt: string
    rooms: {
      id: string
      roomNo: string
      categoryName: string
      arrivalDate: string
      departureDate: string
      bookedNightlyRate: string
      status: string
    }[]
  }[]
}

export function CustomerDetailView({
  customer: initialCustomer,
}: {
  customer: SerializedCustomerDetail
}) {
  const [customer, setCustomer] = React.useState(initialCustomer)

  const initialFormData = React.useMemo(
    () => ({
      firstName: initialCustomer.firstName,
      lastName: initialCustomer.lastName || "",
      phone: initialCustomer.phone || "",
      email: initialCustomer.email || "",
      nationality: initialCustomer.nationality || "",
      address: initialCustomer.address || "",
      idProofType: initialCustomer.idProofType || "Passport",
      idProofNumber: initialCustomer.idProofNumber || "",
      remarks: initialCustomer.remarks || "",
    }),
    [initialCustomer]
  )

  const [formData, setFormData] = React.useState(initialFormData)
  const [savedData, setSavedData] = React.useState(initialFormData)
  const [saving, setSaving] = React.useState(false)

  // Compute dirty state
  const isDirty = React.useMemo(() => {
    return (
      formData.firstName !== savedData.firstName ||
      formData.lastName !== savedData.lastName ||
      formData.phone !== savedData.phone ||
      formData.email !== savedData.email ||
      formData.nationality !== savedData.nationality ||
      formData.address !== savedData.address ||
      formData.idProofType !== savedData.idProofType ||
      formData.idProofNumber !== savedData.idProofNumber ||
      formData.remarks !== savedData.remarks
    )
  }, [formData, savedData])

  const handleDiscard = () => {
    setFormData(savedData)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.firstName.trim()) {
      toast.error("First name is required.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update guest details")
      }

      setCustomer((prev) => ({
        ...prev,
        ...data.customer,
      }))
      setSavedData(formData)
      toast.success("Guest profile updated successfully")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update guest details"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const fullName = `${customer.firstName} ${customer.lastName || ""}`.trim()
  const registeredDateStr = formatDate(customer.createdAt)

  return (
    <div className="space-y-8 pb-24">
      {/* Top Navigation */}
      <div className="flex items-center gap-2">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Guests</span>
        </Link>
      </div>

      {/* Profile Page Header */}
      <PageHeader
        title={fullName}
        description={`Registered ${registeredDateStr} • ${customer.reservations.length} total stay${customer.reservations.length === 1 ? "" : "s"}`}
        action={
          <Link href="/reservations/new">
            <Button size="sm" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-1.5">
              <Plus className="size-4" />
              <span>Book a Stay</span>
            </Button>
          </Link>
        }
      />

      {/* 2 Columns on lg: Left = Edit Profile, Right = Reservation History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form in 3 FormSections (7 cols on lg) */}
        <div className="lg:col-span-7">
          <form onSubmit={handleUpdate} className="space-y-6 rounded-xl border border-border/80 bg-card p-6 shadow-xs">
            {/* FormSection 1: Contact */}
            <FormSection
              title="Contact Information"
              description="Primary name and reachability channels"
              withSeparator
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">First Name *</Label>
                  <Input
                    className="h-10 text-xs sm:text-sm"
                    value={formData.firstName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Last Name</Label>
                  <Input
                    className="h-10 text-xs sm:text-sm"
                    value={formData.lastName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Phone</Label>
                  <Input
                    placeholder="+91 98765 43210"
                    className="h-10 text-xs sm:text-sm font-mono"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email</Label>
                  <Input
                    type="email"
                    placeholder="e.g. guest@example.com"
                    className="h-10 text-xs sm:text-sm"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>
            </FormSection>

            {/* FormSection 2: Identity */}
            <FormSection
              title="Identity & Address"
              description="Legal identification documents and home residence"
              withSeparator
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nationality</Label>
                  <Input
                    placeholder="e.g. Indian"
                    className="h-10 text-xs sm:text-sm"
                    value={formData.nationality}
                    onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">ID Proof Type</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-xs"
                    value={formData.idProofType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, idProofType: e.target.value }))}
                  >
                    {getIdProofOptions(formData.idProofType).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">ID Proof Number</Label>
                  <Input
                    placeholder="e.g. Pass No or National ID"
                    className="h-10 text-xs sm:text-sm font-mono"
                    value={formData.idProofNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, idProofNumber: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Residential Address</Label>
                  <Input
                    placeholder="City, State"
                    className="h-10 text-xs sm:text-sm"
                    value={formData.address}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </div>
              </div>
            </FormSection>

            {/* FormSection 3: Notes & Preferences */}
            <FormSection
              title="Notes & Preferences"
              description="VIP status, special accommodations, or staff observations"
            >
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Remarks</Label>
                <Textarea
                  rows={3}
                  className="text-xs"
                  placeholder="Guest preferences, frequent requests, notes..."
                  value={formData.remarks}
                  onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                />
              </div>
            </FormSection>
          </form>
        </div>

        {/* Right Column: Reservation History (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-sm font-semibold text-foreground">
              Stay History ({customer.reservations.length})
            </h2>
            <Link
              href="/reservations/new"
              className="text-xs font-medium text-primary hover:underline"
            >
              + New Stay
            </Link>
          </div>

          {customer.reservations.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title="No stays recorded"
              description="This guest has not booked any reservations yet."
              action={
                <Link href="/reservations/new">
                  <Button size="sm" variant="outline">
                    Book First Stay
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {customer.reservations.map((res) => {
                const earliestArrival = res.rooms.map((r) => r.arrivalDate).sort()[0]
                const latestDeparture = res.rooms.map((r) => r.departureDate).sort().slice(-1)[0]
                const dateStr = earliestArrival && latestDeparture
                  ? formatStayRange(earliestArrival, latestDeparture)
                  : formatDate(res.createdAt)

                return (
                  <Link
                    key={res.id}
                    href={`/reservations/${res.id}`}
                    className="block rounded-xl border border-border/80 bg-card p-4 hover:border-primary/40 transition-colors shadow-xs group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-foreground">
                        #{res.reservationNo}
                      </span>
                      <StatusBadge status={res.status} size="sm" />
                    </div>

                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {res.rooms.map((rm) => (
                        <span
                          key={rm.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/80 text-[11px] font-mono text-foreground border border-border/60"
                        >
                          <BedDouble className="size-3 text-muted-foreground" />
                          <span>Room {rm.roomNo}</span>
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
                      <span>{dateStr}</span>
                      <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Save Bar (only visible when isDirty) */}
      {isDirty && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-background/95 border-t border-border p-4 backdrop-blur shadow-2xl animate-in slide-in-from-bottom-2">
          <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground font-medium">
              You have unsaved changes to this guest profile.
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                disabled={saving}
                className="h-9 gap-1.5"
              >
                <Undo2 className="size-3.5" />
                <span>Discard</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleUpdate}
                disabled={saving}
                className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
