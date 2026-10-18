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
  Pencil,
  Phone,
  Mail,
  MapPin,
  Calendar,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  EmptyState,
} from "@/components/ui-kit"
import { getIdProofOptions } from "@/lib/constants"
import { formatDate, formatStayRange } from "@/lib/date-format"
import { cn } from "@/lib/utils"

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
  const [isEditing, setIsEditing] = React.useState(false)

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
  const [isReplacingId, setIsReplacingId] = React.useState(false)
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
    setIsReplacingId(false)
    setIsEditing(false)
  }

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

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
      const nextData = {
        ...formData,
        idProofNumber: data.customer?.idProofNumber || "",
      }
      setSavedData(nextData)
      setFormData(nextData)
      setIsReplacingId(false)
      setIsEditing(false)
      toast.success("Guest profile updated successfully")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update guest details"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const fullName = `${customer.firstName} ${customer.lastName || ""}`.trim()
  const initials = `${customer.firstName[0] || ""}${customer.lastName?.[0] || ""}`.toUpperCase()
  const registeredDateStr = formatDate(customer.createdAt)

  // Calculate stay duration helper
  const getStayNights = (arrival: string, departure: string) => {
    const a = new Date(arrival).getTime()
    const d = new Date(departure).getTime()
    const diff = Math.round((d - a) / (1000 * 60 * 60 * 24))
    return Math.max(1, diff)
  }

  return (
    <div className="space-y-6 pb-24">
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

      {/* Guest Profile Header: Avatar, Name, Quick Info, Single "Book a Stay" Button */}
      <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          <div className="size-14 sm:size-16 rounded-full bg-primary/10 text-primary font-bold text-lg sm:text-xl flex items-center justify-center shrink-0 border border-primary/20">
            {initials}
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {fullName}
            </h1>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-muted-foreground">
              {customer.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5 text-muted-foreground/70" />
                  <span className="font-mono text-foreground">{customer.phone}</span>
                </span>
              )}
              {customer.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3.5 text-muted-foreground/70" />
                  <span>{customer.email}</span>
                </span>
              )}
              {(customer.address || customer.nationality) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5 text-muted-foreground/70" />
                  <span>
                    {customer.address
                      ? customer.nationality
                        ? `${customer.address} · ${customer.nationality}`
                        : customer.address
                      : customer.nationality}
                  </span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-muted-foreground/70">
                <Calendar className="size-3.5" />
                <span>Registered {registeredDateStr}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Header Action: Single "Book a Stay" button */}
        <div className="shrink-0 flex items-center gap-2">
          <Link href={`/reservations/new?customerId=${customer.id}`}>
            <Button
              size="sm"
              className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-1.5 shadow-2xs"
            >
              <Plus className="size-4" />
              <span>Book a Stay</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2 Columns: Left = Profile Details (Read-only or Edit mode), Right = Stay Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Guest Information (7 cols on lg) */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs space-y-6">
            {/* Card Header with Edit toggle button */}
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div>
                <h2 className="text-base font-semibold text-foreground">Guest Information</h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isEditing) {
                    handleDiscard()
                  } else {
                    setIsEditing(true)
                  }
                }}
                className="h-8 text-xs gap-1.5 font-medium"
              >
                {isEditing ? (
                  <>
                    <X className="size-3.5" />
                    <span>Cancel</span>
                  </>
                ) : (
                  <>
                    <Pencil className="size-3.5" />
                    <span>Edit Profile</span>
                  </>
                )}
              </Button>
            </div>

            {isEditing ? (
              /* EDIT MODE: Editable Form */
              <form onSubmit={handleUpdate} className="space-y-6">
                {/* Section 1: Contact Information */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">First Name *</Label>
                      <Input
                        className="h-9 text-xs sm:text-sm"
                        value={formData.firstName}
                        onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Last Name</Label>
                      <Input
                        className="h-9 text-xs sm:text-sm"
                        value={formData.lastName}
                        onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Phone</Label>
                      <Input
                        placeholder="+91 98765 43210"
                        className="h-9 text-xs sm:text-sm font-mono"
                        value={formData.phone}
                        onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Email</Label>
                      <Input
                        type="email"
                        placeholder="e.g. guest@example.com"
                        className="h-9 text-xs sm:text-sm"
                        value={formData.email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Identity & Address */}
                <div className="space-y-3 pt-3 border-t border-border/60">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Identity & Address
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Nationality</Label>
                      <Input
                        placeholder="e.g. Indian"
                        className="h-9 text-xs sm:text-sm"
                        value={formData.nationality}
                        onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">ID Proof Type</Label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-xs text-foreground"
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

                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-medium">ID Proof Number</Label>
                      {savedData.idProofNumber && !isReplacingId ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 flex-1 items-center rounded-md border border-input bg-muted/30 px-3 font-mono text-xs text-foreground select-all">
                            {formData.idProofNumber || savedData.idProofNumber}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 text-xs"
                            onClick={() => {
                              setIsReplacingId(true)
                              setFormData((prev) => ({ ...prev, idProofNumber: "" }))
                            }}
                          >
                            Replace
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Enter new ID (stored as •••• 1234)"
                            className="h-9 text-xs font-mono flex-1"
                            value={formData.idProofNumber}
                            onChange={(e) => setFormData((prev) => ({ ...prev, idProofNumber: e.target.value }))}
                            autoFocus={isReplacingId}
                          />
                          {savedData.idProofNumber && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setIsReplacingId(false)
                                setFormData((prev) => ({ ...prev, idProofNumber: savedData.idProofNumber }))
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-medium">Residential Address</Label>
                      <Input
                        placeholder="City, State"
                        className="h-9 text-xs sm:text-sm"
                        value={formData.address}
                        onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Notes & Preferences */}
                <div className="space-y-3 pt-3 border-t border-border/60">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Notes & Preferences
                  </h3>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Remarks</Label>
                    <Textarea
                      rows={3}
                      className="text-xs sm:text-sm resize-none"
                      placeholder="Guest preferences, room requests, notes..."
                      value={formData.remarks}
                      onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDiscard}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={saving}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Profile"
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              /* READ-ONLY SUMMARY: Clean definition list */
              <div className="space-y-6 text-xs sm:text-sm">
                {/* Section 1: Contact Information */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Full Name</span>
                      <span className="font-medium text-foreground">{fullName}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Phone</span>
                      <span className="font-mono text-foreground">{customer.phone || "—"}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[11px] text-muted-foreground block">Email</span>
                      <span className="text-foreground">{customer.email || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Identity & Address */}
                <div className="space-y-3 pt-4 border-t border-border/60">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Identity & Address
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Nationality</span>
                      <span className="text-foreground">{customer.nationality || "—"}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-muted-foreground block">
                        {customer.idProofType || "ID Proof"}
                      </span>
                      {customer.idProofNumber ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono font-medium text-foreground">
                            {customer.idProofNumber.startsWith("••••")
                              ? customer.idProofNumber
                              : `•••• ${customer.idProofNumber.slice(-4)}`}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[11px] text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => {
                              setIsEditing(true)
                              setIsReplacingId(true)
                            }}
                          >
                            Replace
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60 italic">Unrecorded</span>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-[11px] text-muted-foreground block">Residential Address</span>
                      <span className="text-foreground">{customer.address || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Notes & Preferences */}
                <div className="space-y-3 pt-4 border-t border-border/60">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Notes & Preferences
                  </h3>
                  <div>
                    {customer.remarks ? (
                      <p className="text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/60">
                        {customer.remarks}
                      </p>
                    ) : (
                      <span className="text-muted-foreground/60 italic">No notes or special requests recorded.</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Stay History Timeline (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-base font-semibold text-foreground">
              Stay History ({customer.reservations.length})
            </h2>
          </div>

          {customer.reservations.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title="No stays recorded"
              description="This guest has not booked any reservations yet."
              action={
                <Link href={`/reservations/new?customerId=${customer.id}`}>
                  <Button size="sm" variant="outline">
                    Book First Stay
                  </Button>
                </Link>
              }
            />
          ) : (
            /* Simple vertical timeline */
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-px before:bg-border">
              {customer.reservations.map((res) => {
                const arrivals = res.rooms.map((r) => r.arrivalDate).sort()
                const departures = res.rooms.map((r) => r.departureDate).sort()
                const earliestArrival = arrivals[0]
                const latestDeparture = departures[departures.length - 1]

                const stayDateStr = earliestArrival && latestDeparture
                  ? formatStayRange(earliestArrival, latestDeparture)
                  : formatDate(res.createdAt)

                const nights = earliestArrival && latestDeparture
                  ? getStayNights(earliestArrival, latestDeparture)
                  : 1

                return (
                  <div key={res.id} className="relative group">
                    {/* Timeline bullet node */}
                    <div className="absolute -left-6 top-1.5 size-5 rounded-full border-2 border-background bg-muted flex items-center justify-center group-hover:bg-primary transition-colors">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          res.status === "CHECKED_IN" && "bg-emerald-500",
                          res.status === "CONFIRMED" && "bg-blue-500",
                          res.status === "CHECKED_OUT" && "bg-muted-foreground",
                          res.status === "CANCELLED" && "bg-destructive"
                        )}
                      />
                    </div>

                    {/* Timeline item card */}
                    <Link
                      href={`/reservations/${res.id}`}
                      className="block rounded-xl border border-border/70 bg-card p-4 hover:border-primary/40 transition-colors shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors">
                          #{res.reservationNo}
                        </span>
                        {/* Dot + text status tag */}
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={cn(
                              "size-1.5 rounded-full shrink-0",
                              res.status === "CHECKED_IN" && "bg-emerald-500",
                              res.status === "CONFIRMED" && "bg-blue-500",
                              res.status === "CHECKED_OUT" && "bg-muted-foreground/60",
                              res.status === "CANCELLED" && "bg-destructive/60"
                            )}
                          />
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {res.status.replace("_", " ").toLowerCase()}
                          </span>
                        </div>
                      </div>

                      {/* Stay dates */}
                      <div className="mt-1.5 text-xs text-foreground font-medium flex items-center justify-between">
                        <span>{stayDateStr}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {nights} night{nights === 1 ? "" : "s"}
                        </span>
                      </div>

                      {/* Room badges */}
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                        {res.rooms.map((rm) => (
                          <span
                            key={rm.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-[11px] font-mono text-foreground border border-border/50"
                          >
                            <BedDouble className="size-3 text-muted-foreground" />
                            <span>Room {rm.roomNo}</span>
                            <span className="text-muted-foreground">({rm.categoryName})</span>
                          </span>
                        ))}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Booked on {formatDate(res.createdAt)}</span>
                        <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                      </div>
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Save Bar (only visible when isDirty in edit mode) */}
      {isDirty && isEditing && (
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
                onClick={() => handleUpdate()}
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
