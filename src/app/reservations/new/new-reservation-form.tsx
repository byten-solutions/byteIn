"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  User,
  AlertCircle,
  Plus,
  Trash2,
  Search,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  PageHeader,
  MoneyText,
  FormSection,
  DateRangePicker,
} from "@/components/ui-kit"
import { getIdProofOptions } from "@/lib/constants"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"

interface CategoryOption {
  id: string
  name: string
  basePrice: string
  maxOccupancy: number
}

interface AvailableRoom {
  id: string
  roomNo: string
  displayName: string | null
  capacity: number
  status: string
  building: { id: string; name: string }
  floor: { id: string; floorNo: number; name: string | null }
  category: {
    id: string
    name: string
    basePrice: string
    maxOccupancy: number
  }
  effectiveRate: string
}

interface AllocationDraft {
  roomId: string
  roomNo: string
  categoryName: string
  categoryBasePrice?: number
  arrivalDate: string
  departureDate: string
  bookedNightlyRate: string
  rateOverrideReason?: string
  adults: number
  children: number
  maxCapacity: number
}

interface CustomerOption {
  id: string
  firstName: string
  lastName: string | null
  phone: string | null
  email: string | null
}

const STEPS = [
  { id: 1, label: "Dates & Rooms" },
  { id: 2, label: "Guest" },
  { id: 3, label: "Review & Book" },
]

export function NewReservationForm({
  categories,
}: {
  categories: CategoryOption[]
}) {
  const router = useRouter()

  // Helper date defaults
  const today = React.useMemo(() => new Date().toISOString().split("T")[0]!, [])
  const tomorrow = React.useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split("T")[0]!
  }, [])

  // Wizard Step
  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3>(1)

  // Step 1: Availability Search State
  const [stayRange, setStayRange] = React.useState({ from: today, to: tomorrow })
  const [searchCategoryId, setSearchCategoryId] = React.useState("")
  const [availableRooms, setAvailableRooms] = React.useState<AvailableRoom[]>([])
  const [checkingAvailability, setCheckingAvailability] = React.useState(false)
  const [availabilityChecked, setAvailabilityChecked] = React.useState(false)

  // Step 1 & 3: Allocations Cart
  const [allocations, setAllocations] = React.useState<AllocationDraft[]>([])
  const [expandedRoomId, setExpandedRoomId] = React.useState<string | null>(null)

  // Step 2: Guest State
  const [guestMode, setGuestMode] = React.useState<"new" | "existing">("existing")
  const [selectedCustomer, setSelectedCustomer] = React.useState<CustomerOption | null>(null)
  const [customerSearchQuery, setCustomerSearchQuery] = React.useState("")
  const [customerSearchResults, setCustomerSearchResults] = React.useState<CustomerOption[]>([])
  const [searchingCustomer, setSearchingCustomer] = React.useState(false)
  const [showIdAddress, setShowIdAddress] = React.useState(false)

  const [newCustomer, setNewCustomer] = React.useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    nationality: "",
    address: "",
    idProofType: "Passport",
    idProofNumber: "",
    remarks: "",
  })

  // Step 3: Special Requests & Submission
  const [specialRequests, setSpecialRequests] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  // Auto-search availability when stayRange changes
  const handleCheckAvailability = React.useCallback(async () => {
    if (!stayRange.from || !stayRange.to) return
    if (stayRange.to <= stayRange.from) {
      toast.error("Departure date must be strictly after arrival date.")
      return
    }

    setCheckingAvailability(true)
    setAvailabilityChecked(true)
    setFormError(null)

    try {
      let url = `/api/availability?arrivalDate=${stayRange.from}&departureDate=${stayRange.to}&limit=25`
      if (searchCategoryId) {
        url += `&roomCategoryId=${encodeURIComponent(searchCategoryId)}`
      }

      const res = await fetch(url)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to check room availability")
      }

      setAvailableRooms(data.rooms || [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to search available rooms"
      toast.error(message)
    } finally {
      setCheckingAvailability(false)
    }
  }, [stayRange.from, stayRange.to, searchCategoryId])

  // Initial check on mount
  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleCheckAvailability()
    }, 0)
    return () => clearTimeout(timer)
  }, [handleCheckAvailability])

  // Debounced search for existing guests
  React.useEffect(() => {
    if (guestMode !== "existing" || !customerSearchQuery.trim()) {
      return
    }

    let isMounted = true
    const timer = setTimeout(async () => {
      setSearchingCustomer(true)
      try {
        const res = await fetch(
          `/api/customers?search=${encodeURIComponent(customerSearchQuery.trim())}&limit=5`
        )
        const data = await res.json()
        if (isMounted && data.success) {
          setCustomerSearchResults(data.customers || [])
        }
      } catch (err) {
        console.error("Failed to search customers:", err)
      } finally {
        if (isMounted) {
          setSearchingCustomer(false)
        }
      }
    }, 250)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [customerSearchQuery, guestMode])

  // Add room to draft allocations
  const handleToggleRoom = (room: AvailableRoom) => {
    const isAdded = allocations.some((a) => a.roomId === room.id)
    if (isAdded) {
      setAllocations((prev) => prev.filter((a) => a.roomId !== room.id))
      return
    }

    const basePriceNum = parseFloat(room.category.basePrice) || 0
    const effectiveRateNum = parseFloat(room.effectiveRate) || 0
    const isBelowBase = effectiveRateNum < basePriceNum

    const newAllocation: AllocationDraft = {
      roomId: room.id,
      roomNo: room.roomNo,
      categoryName: room.category.name,
      categoryBasePrice: basePriceNum,
      arrivalDate: stayRange.from,
      departureDate: stayRange.to,
      bookedNightlyRate: room.effectiveRate,
      rateOverrideReason: isBelowBase ? "Configured room price override applied" : "",
      adults: 1,
      children: 0,
      maxCapacity: room.capacity,
    }

    setAllocations((prev) => [...prev, newAllocation])
  }

  // Update allocation attributes in Step 3
  const handleUpdateAllocation = (
    index: number,
    field: keyof AllocationDraft,
    value: string | number
  ) => {
    setAllocations((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index]!, [field]: value }
      return copy
    })
  }

  // Apply default search dates to all allocations
  const handleApplyDatesToAll = () => {
    if (!stayRange.from || !stayRange.to) return
    setAllocations((prev) =>
      prev.map((a) => ({
        ...a,
        arrivalDate: stayRange.from,
        departureDate: stayRange.to,
      }))
    )
    toast.success("Dates applied to all rooms")
  }

  // Calculate stay duration (nights)
  const getNights = (arrivalStr: string, departureStr: string) => {
    const arr = new Date(arrivalStr)
    const dep = new Date(departureStr)
    return Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)))
  }

  // Calculate booking summary
  const totalNights = allocations.reduce(
    (acc, a) => acc + getNights(a.arrivalDate, a.departureDate),
    0
  )
  const totalEstimatedCost = allocations.reduce((acc, a) => {
    const nights = getNights(a.arrivalDate, a.departureDate)
    const rate = parseFloat(a.bookedNightlyRate) || 0
    return acc + nights * rate
  }, 0)

  // Step Validations
  const isStep1Valid = allocations.length > 0
  const isStep2Valid =
    guestMode === "existing"
      ? selectedCustomer !== null
      : newCustomer.firstName.trim().length > 0

  const handleNext = () => {
    if (currentStep === 1) {
      if (!isStep1Valid) {
        toast.error("Please add at least one available room to continue.")
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      if (!isStep2Valid) {
        toast.error(
          guestMode === "existing"
            ? "Please search and select a guest."
            : "Guest first name is required."
        )
        return
      }
      setCurrentStep(3)
    }
  }

  const handlePrev = () => {
    if (currentStep === 3) setCurrentStep(2)
    else if (currentStep === 2) setCurrentStep(1)
  }

  // Submit Reservation
  const handleSubmitBooking = async () => {
    setFormError(null)

    if (allocations.length === 0) {
      setFormError("Please allocate at least one room to this reservation.")
      return
    }

    for (const alloc of allocations) {
      if (alloc.departureDate <= alloc.arrivalDate) {
        setFormError(
          `Departure date must be after arrival date for Room ${alloc.roomNo}.`
        )
        return
      }
      const totalGuests = (alloc.adults || 1) + (alloc.children || 0)
      if (totalGuests > alloc.maxCapacity) {
        setFormError(
          `Room ${alloc.roomNo} exceeds maximum occupancy of ${alloc.maxCapacity} guests.`
        )
        return
      }
    }

    if (guestMode === "new") {
      if (!newCustomer.firstName.trim()) {
        setFormError("Guest first name is required.")
        return
      }
    } else {
      if (!selectedCustomer) {
        setFormError("Please select an existing primary guest.")
        return
      }
    }

    setSubmitting(true)

    try {
      const payload: {
        specialRequests: string | null
        allocations: {
          roomId: string
          arrivalDate: string
          departureDate: string
          bookedNightlyRate: number
          rateOverrideReason?: string
          adults: number
          children: number
        }[]
        newCustomer?: {
          firstName: string
          lastName: string | null
          phone: string | null
          email: string | null
          nationality: string | null
          address: string | null
          idProofType: string | null
          idProofNumber: string | null
          remarks: string | null
        }
        customerId?: string
      } = {
        specialRequests: specialRequests.trim() || null,
        allocations: allocations.map((a) => {
          const rateNum = parseFloat(a.bookedNightlyRate) || 0
          const isBelowBase = a.categoryBasePrice !== undefined ? rateNum < a.categoryBasePrice : false
          return {
            roomId: a.roomId,
            arrivalDate: a.arrivalDate,
            departureDate: a.departureDate,
            bookedNightlyRate: rateNum,
            ...(isBelowBase
              ? {
                  rateOverrideReason:
                    a.rateOverrideReason?.trim() || "Configured room price override applied",
                }
              : {}),
            adults: parseInt(a.adults.toString(), 10) || 1,
            children: parseInt(a.children.toString(), 10) || 0,
          }
        }),
      }

      if (guestMode === "new") {
        payload.newCustomer = {
          firstName: newCustomer.firstName.trim(),
          lastName: newCustomer.lastName.trim() || null,
          phone: newCustomer.phone.trim() || null,
          email: newCustomer.email.trim() || null,
          nationality: newCustomer.nationality.trim() || null,
          address: newCustomer.address.trim() || null,
          idProofType: newCustomer.idProofType.trim() || null,
          idProofNumber: newCustomer.idProofNumber.trim() || null,
          remarks: newCustomer.remarks.trim() || null,
        }
      } else if (selectedCustomer) {
        payload.customerId = selectedCustomer.id
      }

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create reservation")
      }

      toast.success(`Reservation #${data.reservation.reservationNo} booked successfully`)
      router.push(`/reservations/${data.reservation.id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create reservation"
      setFormError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Summary Card Component (reused on desktop right rail and mobile bar)
  const summaryContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground">Booking Summary</h3>
        <span className="text-xs font-mono font-medium text-muted-foreground">
          {allocations.length} {allocations.length === 1 ? "room" : "rooms"}
        </span>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>Total Stay Nights</span>
          <span className="font-mono font-medium text-foreground">{totalNights}</span>
        </div>

        {selectedCustomer && (
          <div className="flex justify-between text-muted-foreground">
            <span>Primary Guest</span>
            <span className="font-medium text-foreground truncate max-w-[140px]">
              {selectedCustomer.firstName} {selectedCustomer.lastName || ""}
            </span>
          </div>
        )}

        {guestMode === "new" && newCustomer.firstName && (
          <div className="flex justify-between text-muted-foreground">
            <span>Primary Guest</span>
            <span className="font-medium text-foreground truncate max-w-[140px]">
              {newCustomer.firstName} {newCustomer.lastName}
            </span>
          </div>
        )}

        {allocations.length > 0 && (
          <div className="pt-2 border-t border-border/40 space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Selected Rooms
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {allocations.map((a) => (
                <div key={a.roomId} className="flex justify-between text-[11px]">
                  <span className="font-mono text-foreground">Room {a.roomNo}</span>
                  <MoneyText
                    value={parseFloat(a.bookedNightlyRate) * getNights(a.arrivalDate, a.departureDate)}
                    className="text-muted-foreground"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-border/60 flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">Estimated Total</span>
        <MoneyText value={totalEstimatedCost} className="text-lg font-bold text-foreground" />
      </div>

      {currentStep < 3 ? (
        <Button
          type="button"
          onClick={handleNext}
          disabled={currentStep === 1 ? !isStep1Valid : !isStep2Valid}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10"
        >
          <span>Continue</span>
          <ArrowRight className="ml-2 size-4" />
        </Button>
      ) : (
        <Button
          type="button"
          onClick={handleSubmitBooking}
          disabled={submitting || allocations.length === 0}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 font-semibold"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Booking...
            </>
          ) : (
            <>
              <Check className="mr-2 size-4" />
              Confirm & Book
            </>
          )}
        </Button>
      )}
    </div>
  )

  return (
    <div className="space-y-8 pb-20 lg:pb-0">
      {/* Page Header */}
      <PageHeader
        title="New Reservation"
        description="Book guest accommodations with conflict-safe physical room allocations"
        action={
          <Link href="/reservations">
            <Button variant="outline" size="sm" className="h-9">
              <ArrowLeft className="mr-1.5 size-4" />
              Cancel
            </Button>
          </Link>
        }
      />

      {/* Stepper Navigation */}
      <div className="flex items-center justify-between max-w-3xl mx-auto border-b border-border/60 pb-4">
        {STEPS.map((s, idx) => {
          const isActive = currentStep === s.id
          const isPassed = currentStep > s.id
          return (
            <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => {
                  if (s.id < currentStep) setCurrentStep(s.id as 1 | 2 | 3)
                  else if (s.id === 2 && isStep1Valid) setCurrentStep(2)
                  else if (s.id === 3 && isStep1Valid && isStep2Valid) setCurrentStep(3)
                }}
                className={cn(
                  "flex items-center gap-2.5 text-xs font-medium cursor-pointer transition-colors outline-hidden",
                  isActive
                    ? "text-primary font-semibold"
                    : isPassed
                    ? "text-foreground"
                    : "text-muted-foreground/60"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[11px] font-mono transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground font-bold"
                      : isPassed
                      ? "bg-primary/20 text-primary font-semibold"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isPassed ? <Check className="size-3" /> : s.id}
                </span>
                <span>{s.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 mx-3 transition-colors",
                    currentStep > s.id ? "bg-primary/40" : "bg-border/60"
                  )}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Validation Error Banner */}
      {formError && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive max-w-3xl">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{formError}</div>
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Column: Form Content */}
        <div className="flex-1 w-full max-w-3xl space-y-6">
          {/* STEP 1: Dates & Rooms */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in-50">
              <FormSection
                title="1. Search Stay Dates & Category"
                description="Select reservation arrival and departure dates to search live available inventory."
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Stay Dates */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Stay Dates (Check-in & Check-out) *
                    </Label>
                    <DateRangePicker
                      from={stayRange.from}
                      to={stayRange.to}
                      minDate={today}
                      onChange={setStayRange}
                    />
                  </div>

                  {/* Room Category */}
                  <div className="space-y-1.5">
                    <Label htmlFor="searchCat" className="text-xs font-medium">
                      Room Category (Optional)
                    </Label>
                    <select
                      id="searchCat"
                      className="h-10 w-full rounded-md border border-input bg-card px-3 text-xs outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/20"
                      value={searchCategoryId}
                      onChange={(e) => setSearchCategoryId(e.target.value)}
                    >
                      <option value="">All Categories ({categories.length})</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({formatMoney(c.basePrice)}/night, max {c.maxOccupancy})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={handleCheckAvailability}
                    disabled={checkingAvailability}
                    variant="outline"
                    size="sm"
                    className="h-9"
                  >
                    {checkingAvailability ? (
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                    ) : (
                      <Search className="mr-2 size-3.5" />
                    )}
                    Search Available Rooms
                  </Button>
                </div>
              </FormSection>

              {/* Available Rooms List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Available Rooms ({availableRooms.length})
                  </h3>
                  {allocations.length > 0 && (
                    <span className="text-xs text-primary font-medium">
                      {allocations.length} selected
                    </span>
                  )}
                </div>

                {checkingAvailability ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-14 rounded-xl border border-border/60 bg-muted/20 animate-pulse" />
                    ))}
                  </div>
                ) : availableRooms.length === 0 && availabilityChecked ? (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-8 text-center text-xs text-muted-foreground">
                    No physical rooms are available for the selected dates and category. Try adjusting your dates.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card overflow-hidden">
                    {availableRooms.map((room) => {
                      const isAdded = allocations.some((a) => a.roomId === room.id)
                      return (
                        <div
                          key={room.id}
                          className={cn(
                            "flex items-center justify-between p-3.5 text-xs transition-colors",
                            isAdded ? "bg-primary/5" : "hover:bg-muted/30"
                          )}
                        >
                          <div className="space-y-0.5 min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-foreground">
                                Room {room.roomNo}
                              </span>
                              <span className="text-muted-foreground truncate">
                                • {room.category.name}
                              </span>
                            </div>
                            <div className="text-muted-foreground text-[11px] truncate">
                              Floor {room.floor.floorNo} • {room.building.name} • Max {room.capacity} guests
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <MoneyText value={room.effectiveRate} className="font-semibold text-foreground block text-sm" />
                              <span className="text-[10px] text-muted-foreground">per night</span>
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              variant={isAdded ? "default" : "outline"}
                              className={cn("h-8 text-xs gap-1.5", isAdded && "bg-primary text-primary-foreground")}
                              onClick={() => handleToggleRoom(room)}
                            >
                              {isAdded ? (
                                <>
                                  <Check className="size-3.5" />
                                  Added
                                </>
                              ) : (
                                <>
                                  <Plus className="size-3.5" />
                                  Add
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Guest Details */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in-50">
              <FormSection
                title="2. Primary Guest Information"
                description="Select an existing guest from directory records or register a new guest."
              >
                {/* Segmented Guest Mode */}
                <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-1 w-full max-w-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setGuestMode("existing")
                      setFormError(null)
                      setCustomerSearchResults([])
                    }}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center cursor-pointer",
                      guestMode === "existing"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Existing Guest
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGuestMode("new")
                      setFormError(null)
                      setCustomerSearchResults([])
                    }}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center cursor-pointer",
                      guestMode === "new"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    New Guest
                  </button>
                </div>

                {/* Existing Guest Search & Selection */}
                {guestMode === "existing" && (
                  <div className="space-y-3 pt-2">
                    {selectedCustomer ? (
                      <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="size-4 text-primary" />
                            <span className="font-semibold text-sm text-foreground">
                              {selectedCustomer.firstName} {selectedCustomer.lastName || ""}
                            </span>
                          </div>
                          <div className="text-muted-foreground">
                            {selectedCustomer.phone || "No phone"} • {selectedCustomer.email || "No email"}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            setSelectedCustomer(null)
                            setCustomerSearchQuery("")
                            setCustomerSearchResults([])
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            placeholder="Search guest by name, phone, or email..."
                            className="pl-9 h-10 text-xs sm:text-sm bg-card"
                            value={customerSearchQuery}
                            onChange={(e) => {
                              setCustomerSearchQuery(e.target.value)
                              if (!e.target.value.trim()) setCustomerSearchResults([])
                            }}
                            autoFocus
                          />
                        </div>

                        {searchingCustomer && (
                          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" />
                            Searching guest records...
                          </div>
                        )}

                        {customerSearchResults.length > 0 && (
                          <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card overflow-hidden">
                            {customerSearchResults.map((cust) => (
                              <div
                                key={cust.id}
                                className="flex items-center justify-between p-3.5 text-xs hover:bg-muted/30 transition-colors"
                              >
                                <div>
                                  <div className="font-medium text-foreground">
                                    {cust.firstName} {cust.lastName || ""}
                                  </div>
                                  <div className="text-muted-foreground text-[11px]">
                                    {cust.phone || "No phone"} • {cust.email || "No email"}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  onClick={() => setSelectedCustomer(cust)}
                                >
                                  Select
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {customerSearchQuery && !searchingCustomer && customerSearchResults.length === 0 && (
                          <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                            No guests found matching &quot;{customerSearchQuery}&quot;. Switch to &quot;New Guest&quot; tab to register them.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* New Guest Registration Form */}
                {guestMode === "new" && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">First Name *</Label>
                        <Input
                          placeholder="e.g. John"
                          className="h-10 text-xs sm:text-sm"
                          value={newCustomer.firstName}
                          onChange={(e) =>
                            setNewCustomer((prev) => ({ ...prev, firstName: e.target.value }))
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Last Name</Label>
                        <Input
                          placeholder="e.g. Doe"
                          className="h-10 text-xs sm:text-sm"
                          value={newCustomer.lastName}
                          onChange={(e) =>
                            setNewCustomer((prev) => ({ ...prev, lastName: e.target.value }))
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Phone</Label>
                        <Input
                          placeholder="+91 98765 43210"
                          className="h-10 text-xs sm:text-sm font-mono"
                          value={newCustomer.phone}
                          onChange={(e) =>
                            setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Email</Label>
                        <Input
                          type="email"
                          placeholder="e.g. guest@example.com"
                          className="h-10 text-xs sm:text-sm"
                          value={newCustomer.email}
                          onChange={(e) =>
                            setNewCustomer((prev) => ({ ...prev, email: e.target.value }))
                          }
                        />
                      </div>
                    </div>

                    {/* Collapsed ID and Address section */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowIdAddress(!showIdAddress)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
                      >
                        {showIdAddress ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        <span>ID proof & address (optional)</span>
                      </button>

                      {showIdAddress && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-border/70 bg-muted/20 animate-in fade-in-50">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Nationality</Label>
                            <Input
                              placeholder="e.g. Indian"
                              className="h-10 text-xs"
                              value={newCustomer.nationality}
                              onChange={(e) =>
                                setNewCustomer((prev) => ({ ...prev, nationality: e.target.value }))
                              }
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">ID Proof Type</Label>
                            <select
                              className="h-10 w-full rounded-md border border-input bg-card px-3 text-xs"
                              value={newCustomer.idProofType}
                              onChange={(e) =>
                                setNewCustomer((prev) => ({ ...prev, idProofType: e.target.value }))
                              }
                            >
                              {getIdProofOptions(newCustomer.idProofType).map((opt) => (
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
                              className="h-10 text-xs font-mono"
                              value={newCustomer.idProofNumber}
                              onChange={(e) =>
                                setNewCustomer((prev) => ({ ...prev, idProofNumber: e.target.value }))
                              }
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Address</Label>
                            <Input
                              placeholder="City, State"
                              className="h-10 text-xs"
                              value={newCustomer.address}
                              onChange={(e) =>
                                setNewCustomer((prev) => ({ ...prev, address: e.target.value }))
                              }
                            />
                          </div>

                          <div className="sm:col-span-2 space-y-1.5">
                            <Label className="text-xs font-medium">Guest Remarks / Notes</Label>
                            <Input
                              placeholder="Preferences, VIP status, etc."
                              className="h-10 text-xs"
                              value={newCustomer.remarks}
                              onChange={(e) =>
                                setNewCustomer((prev) => ({ ...prev, remarks: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </FormSection>
            </div>
          )}

          {/* STEP 3: Review & Finalize */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in-50">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    3. Review Allocated Rooms ({allocations.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Configure individual room stay dates, guest occupancy, and rates.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleApplyDatesToAll}
                >
                  Apply search dates to all
                </Button>
              </div>

              {/* Room items list */}
              <div className="space-y-3">
                {allocations.map((alloc, idx) => {
                  const nights = getNights(alloc.arrivalDate, alloc.departureDate)
                  const lineTotal = (parseFloat(alloc.bookedNightlyRate) || 0) * nights
                  const isExpanded = expandedRoomId === alloc.roomId

                  return (
                    <div
                      key={alloc.roomId}
                      className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="font-mono font-bold text-sm text-foreground">
                            Room {alloc.roomNo}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {alloc.categoryName}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <MoneyText value={lineTotal} className="font-bold text-foreground text-sm" />
                          <button
                            type="button"
                            onClick={() => setExpandedRoomId(isExpanded ? null : alloc.roomId)}
                            className="text-xs font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{isExpanded ? "Done" : "Adjust"}</span>
                            {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAllocations((prev) => prev.filter((a) => a.roomId !== alloc.roomId))}
                            className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
                            title="Remove room"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Dates line */}
                      <div className="space-y-1 text-xs">
                        <Label className="text-[11px] text-muted-foreground">Stay Dates</Label>
                        <DateRangePicker
                          from={alloc.arrivalDate}
                          to={alloc.departureDate}
                          minDate={today}
                          onChange={(range) => {
                            handleUpdateAllocation(idx, "arrivalDate", range.from)
                            handleUpdateAllocation(idx, "departureDate", range.to)
                          }}
                        />
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        {nights} night{nights === 1 ? "" : "s"} @{" "}
                        <MoneyText value={alloc.bookedNightlyRate} className="font-mono font-medium" /> / night
                      </div>

                      {/* Expandable Adjust Drawer */}
                      {isExpanded && (
                        <div className="pt-3 border-t border-border/60 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in-50">
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium">Adults (min 1)</Label>
                            <Input
                              type="number"
                              min="1"
                              max={alloc.maxCapacity}
                              className="h-8 text-xs font-mono"
                              value={alloc.adults}
                              onChange={(e) =>
                                handleUpdateAllocation(
                                  idx,
                                  "adults",
                                  parseInt(e.target.value, 10) || 1
                                )
                              }
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium">Children</Label>
                            <Input
                              type="number"
                              min="0"
                              max={alloc.maxCapacity - 1}
                              className="h-8 text-xs font-mono"
                              value={alloc.children}
                              onChange={(e) =>
                                handleUpdateAllocation(
                                  idx,
                                  "children",
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium">Rate Override</Label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground select-none">
                                ₹
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="pl-6 h-8 text-xs font-mono"
                                value={alloc.bookedNightlyRate}
                                onChange={(e) =>
                                  handleUpdateAllocation(idx, "bookedNightlyRate", e.target.value)
                                }
                              />
                            </div>
                          </div>

                          {alloc.categoryBasePrice !== undefined &&
                            (parseFloat(alloc.bookedNightlyRate) || 0) < alloc.categoryBasePrice && (
                              <div className="space-y-1 sm:col-span-3 pt-1">
                                <Label className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                  Reason for Rate Override (Below base ₹{alloc.categoryBasePrice}) *
                                </Label>
                                <Input
                                  placeholder="e.g. Configured room price override / Management concession"
                                  className="h-8 text-xs border-amber-500/40 focus:border-amber-500"
                                  value={alloc.rateOverrideReason || ""}
                                  onChange={(e) =>
                                    handleUpdateAllocation(idx, "rateOverrideReason", e.target.value)
                                  }
                                  required
                                />
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Special Requests */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-medium">Special Requests (Optional)</Label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {specialRequests.length}/1000
                  </span>
                </div>
                <Textarea
                  placeholder="Guest preferences, early arrival notes, airport pickup..."
                  maxLength={1000}
                  rows={3}
                  className="text-xs"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Stepper Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-border/60">
            {currentStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={handlePrev}
              >
                <ArrowLeft className="mr-1.5 size-4" />
                Back
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2">
              {currentStep < 3 ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleNext}
                  disabled={currentStep === 1 ? !isStep1Valid : !isStep2Valid}
                >
                  <span>Next Step</span>
                  <ArrowRight className="ml-1.5 size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  onClick={handleSubmitBooking}
                  disabled={submitting || allocations.length === 0}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <Check className="mr-1.5 size-4" />
                      Confirm & Book Reservation
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Rail: Persistent Summary (lg and up) */}
        <div className="w-80 shrink-0 hidden lg:block sticky top-20">
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs">
            {summaryContent}
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar (below lg) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-background/95 border-t border-border p-3.5 backdrop-blur z-30 flex items-center justify-between shadow-lg">
        <div>
          <div className="text-[11px] text-muted-foreground">
            {allocations.length} {allocations.length === 1 ? "room" : "rooms"} • {totalNights} night{totalNights === 1 ? "" : "s"}
          </div>
          <MoneyText value={totalEstimatedCost} className="text-base font-bold text-foreground" />
        </div>

        {currentStep < 3 ? (
          <Button
            type="button"
            size="sm"
            onClick={handleNext}
            disabled={currentStep === 1 ? !isStep1Valid : !isStep2Valid}
            className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <span>Next</span>
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={handleSubmitBooking}
            disabled={submitting || allocations.length === 0}
            className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {submitting ? "Booking..." : "Confirm & Book"}
          </Button>
        )}
      </div>
    </div>
  )
}
