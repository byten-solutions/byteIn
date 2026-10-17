"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  LogIn,
  LogOut,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusBadge, MoneyText } from "@/components/ui-kit"
import { getIdProofOptions } from "@/lib/constants"
import { formatDateTime, formatStayRange } from "@/lib/date-format"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { InvoiceDetailDTO } from "@/modules/billing/billing.types"

export interface AllocationProps {
  id: string
  roomId: string
  roomNo: string
  roomStatus: string
  categoryName: string
  displayName: string | null
  buildingName: string
  floorNo: number
  arrivalDate: string
  departureDate: string
  nights: number
  adults: number
  children: number
  bookedNightlyRate: string
  roomSubtotal: number
  status: "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW"
  checkedInAt: string | null
  checkedOutAt: string | null
}

interface CustomerProps {
  id: string
  firstName: string
  lastName: string | null
  idProofType: string | null
  idProofNumber: string | null
}

export function AllocationActionRow({
  allocation: initialAllocation,
  customer,
  invoice = null,
  estimatedTotal = 0,
}: {
  allocation: AllocationProps
  customer: CustomerProps
  invoice?: InvoiceDetailDTO | null
  estimatedTotal?: number
}) {
  const router = useRouter()
  const [allocation, setAllocation] = React.useState(initialAllocation)

  // Check-In Dialog State
  const [isCheckInOpen, setIsCheckInOpen] = React.useState(false)
  const [showIdVerification, setShowIdVerification] = React.useState(false)
  const [idType, setIdType] = React.useState(customer.idProofType || "Passport")
  const [idNumber, setIdNumber] = React.useState(customer.idProofNumber || "")
  const [checkInNotes, setCheckInNotes] = React.useState("")
  const [submittingCheckIn, setSubmittingCheckIn] = React.useState(false)
  const [checkInError, setCheckInError] = React.useState<string | null>(null)

  // Check-Out Dialog State
  const [isCheckOutOpen, setIsCheckOutOpen] = React.useState(false)
  const [checkOutNotes, setCheckOutNotes] = React.useState("")
  const [submittingCheckOut, setSubmittingCheckOut] = React.useState(false)
  const [checkOutError, setCheckOutError] = React.useState<string | null>(null)

  // Listen for header action triggers
  React.useEffect(() => {
    const handleOpenAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ allocationId: string; action: "checkin" | "checkout" }>
      if (customEvent.detail && customEvent.detail.allocationId === allocation.id) {
        if (customEvent.detail.action === "checkout") {
          setIsCheckOutOpen(true)
        } else if (customEvent.detail.action === "checkin") {
          setIsCheckInOpen(true)
        }
      }
    }

    window.addEventListener("byteinn:open-action", handleOpenAction)
    return () => {
      window.removeEventListener("byteinn:open-action", handleOpenAction)
    }
  }, [allocation.id])

  const handleCheckIn = async () => {
    setCheckInError(null)
    setSubmittingCheckIn(true)

    try {
      const res = await fetch(`/api/room-allocations/${allocation.id}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verifiedIdType: idType,
          verifiedIdNumber: idNumber,
          notes: checkInNotes,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to check in room allocation")
      }

      setAllocation((prev) => ({
        ...prev,
        status: "CHECKED_IN",
        roomStatus: "OCCUPIED",
        checkedInAt: new Date().toISOString(),
      }))

      setIsCheckInOpen(false)
      toast.success(`Room ${allocation.roomNo} checked in successfully`)
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check in"
      setCheckInError(msg)
      toast.error(msg)
    } finally {
      setSubmittingCheckIn(false)
    }
  }

  const handleCheckOut = async () => {
    setCheckOutError(null)
    setSubmittingCheckOut(true)

    try {
      const res = await fetch(`/api/room-allocations/${allocation.id}/check-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: checkOutNotes,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to check out room allocation")
      }

      setAllocation((prev) => ({
        ...prev,
        status: "CHECKED_OUT",
        roomStatus: "VACANT_DIRTY",
        checkedOutAt: new Date().toISOString(),
      }))

      setIsCheckOutOpen(false)
      toast.success(`Room ${allocation.roomNo} checked out (transferred to Vacant Dirty)`)
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check out"
      setCheckOutError(msg)
      toast.error(msg)
    } finally {
      setSubmittingCheckOut(false)
    }
  }

  const isClean = allocation.roomStatus === "VACANT_CLEAN"

  return (
    <div className="p-4 space-y-3 transition-colors hover:bg-muted/20">
      {/* Main row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono font-bold text-base text-foreground">
              Room {allocation.roomNo}
            </span>
            <span className="text-xs text-muted-foreground">
              • {allocation.categoryName}
            </span>
            <StatusBadge status={allocation.roomStatus} size="sm" />
          </div>

          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>
              {formatStayRange(allocation.arrivalDate, allocation.departureDate)}
            </span>
            <span>•</span>
            <span>{allocation.nights} night{allocation.nights === 1 ? "" : "s"}</span>
            <span>•</span>
            <span>
              {allocation.adults} adult{allocation.adults === 1 ? "" : "s"}
              {allocation.children > 0 && `, ${allocation.children} child`}
            </span>
          </div>

          {/* Timestamps */}
          {(allocation.checkedInAt || allocation.checkedOutAt) && (
            <div className="text-[11px] text-muted-foreground/80 flex items-center gap-3 pt-0.5">
              {allocation.checkedInAt && (
                <span>
                  Checked in: {formatDateTime(allocation.checkedInAt)}
                </span>
              )}
              {allocation.checkedOutAt && (
                <span>
                  Checked out: {formatDateTime(allocation.checkedOutAt)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0 self-start sm:self-center">
          <div className="text-right">
            <MoneyText value={allocation.roomSubtotal} className="text-sm font-bold text-foreground block" />
            <span className="text-[11px] text-muted-foreground">
              <MoneyText value={allocation.bookedNightlyRate} /> / night
            </span>
          </div>

          {/* Actions */}
          {allocation.status === "CONFIRMED" && (
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                setCheckInError(null)
                setIsCheckInOpen(true)
              }}
            >
              <LogIn className="size-3.5 mr-1" />
              Check In
            </Button>
          )}

          {allocation.status === "CHECKED_IN" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => {
                setCheckOutError(null)
                setIsCheckOutOpen(true)
              }}
            >
              <LogOut className="size-3.5 mr-1" />
              Check Out
            </Button>
          )}

          {allocation.status === "CHECKED_OUT" && (
            <StatusBadge status="CHECKED_OUT" size="sm" label="Checked Out" />
          )}

          {allocation.status === "CANCELLED" && (
            <StatusBadge status="CANCELLED" size="sm" label="Cancelled" />
          )}

          {allocation.status === "NO_SHOW" && (
            <StatusBadge status="CANCELLED" size="sm" label="No Show" />
          )}
        </div>
      </div>

      {/* CHECK-IN DIALOG */}
      <Dialog open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Check In — Room {allocation.roomNo}</DialogTitle>
            <DialogDescription>
              Confirm guest arrival and transition physical room state to Occupied.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {checkInError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                {checkInError}
              </div>
            )}

            {/* Room Condition Notice */}
            {!isClean ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Room Not Clean</span>
                  Room {allocation.roomNo} is currently <strong>{allocation.roomStatus}</strong>.
                  Physical rooms must be strictly VACANT_CLEAN to check in.
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-700 dark:text-emerald-300">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>Room is VACANT_CLEAN and ready for occupancy.</span>
              </div>
            )}

            {/* Collapsed ID Verification */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowIdVerification(!showIdVerification)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                {showIdVerification ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                <span>Verify ID proof (optional)</span>
              </button>

              {showIdVerification && (
                <div className="mt-2.5 space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3.5 animate-in fade-in-50">
                  <div className="space-y-1">
                    <Label className="text-[11px]">ID Document Type</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-xs"
                      value={idType}
                      onChange={(e) => setIdType(e.target.value)}
                    >
                      {getIdProofOptions(idType).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">ID Number</Label>
                    <Input
                      placeholder="e.g. Passport or ID Number"
                      className="h-9 text-xs font-mono"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Check-in Notes */}
            <div className="space-y-1">
              <Label className="text-[11px]">Front Desk Notes (Optional)</Label>
              <Textarea
                placeholder="Key card issued, luggage notes, special arrangements..."
                rows={2}
                className="text-xs"
                value={checkInNotes}
                onChange={(e) => setCheckInNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCheckInOpen(false)}
              disabled={submittingCheckIn}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCheckIn}
              disabled={submittingCheckIn || !isClean}
            >
              {submittingCheckIn ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Checking In...
                </>
              ) : (
                "Confirm Check In"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CHECK-OUT DIALOG */}
      <Dialog open={isCheckOutOpen} onOpenChange={setIsCheckOutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Check Out — Room {allocation.roomNo}</DialogTitle>
            <DialogDescription>
              Complete room stay and release inventory to housekeeping turnover.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {checkOutError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                {checkOutError}
              </div>
            )}

            {/* BILLING SAFEGUARD & BALANCE STATUS */}
            {invoice ? (
              <div
                className={cn(
                  "rounded-lg border p-3.5 space-y-2.5",
                  parseFloat(invoice.balanceDue) > 0
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                )}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5">
                    {parseFloat(invoice.balanceDue) > 0 ? (
                      <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    <span>
                      {parseFloat(invoice.balanceDue) > 0
                        ? "Outstanding Balance Notice"
                        : "Billing Fully Settled"}
                    </span>
                  </span>
                  <StatusBadge status={invoice.status} size="sm" />
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-border/40">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Grand Total</span>
                    <MoneyText value={invoice.grandTotal} className="font-semibold text-foreground" />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Paid</span>
                    <MoneyText value={invoice.totalPaid} className="font-semibold text-foreground" />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Balance Due</span>
                    <MoneyText
                      value={invoice.balanceDue}
                      className={cn(
                        "font-bold",
                        parseFloat(invoice.balanceDue) > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-foreground"
                      )}
                    />
                  </div>
                </div>

                {parseFloat(invoice.balanceDue) > 0 && (
                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-amber-500/20">
                    <span className="text-[11px] text-amber-800 dark:text-amber-300">
                      Unpaid balance remains on this reservation.
                    </span>
                    <Link
                      href={`/billing/${invoice.id}`}
                      target="_blank"
                      className="shrink-0"
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] font-semibold gap-1 bg-card hover:bg-card/80 text-foreground"
                      >
                        <span>Collect Payment</span>
                        <ExternalLink className="size-3" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1.5 text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="size-4 text-amber-600 shrink-0" />
                  <span>No Invoice Generated</span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  This reservation does not yet have an active invoice. Estimated stay value:{" "}
                  <strong>{formatMoney(estimatedTotal)}</strong>.
                </p>
              </div>
            )}

            {/* Turnover Notice */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-muted-foreground">
              Checking out transitions Room {allocation.roomNo} to <strong>VACANT_DIRTY</strong> for housekeeping turnover.
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Turnover Notes / Minibar (Optional)</Label>
              <Textarea
                placeholder="Keys returned, minibar consumed, inspection notes..."
                rows={2}
                className="text-xs"
                value={checkOutNotes}
                onChange={(e) => setCheckOutNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCheckOutOpen(false)}
              disabled={submittingCheckOut}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCheckOut}
              disabled={submittingCheckOut}
              className={
                parseFloat(invoice?.balanceDue || "0") > 0
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : ""
              }
            >
              {submittingCheckOut ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Checking Out...
                </>
              ) : parseFloat(invoice?.balanceDue || "0") > 0 ? (
                "Confirm Check Out with Pending Balance"
              ) : (
                "Confirm Check Out"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
