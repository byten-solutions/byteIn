"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface AllocationProps {
  id: string;
  roomId: string;
  roomNo: string;
  roomStatus: string;
  categoryName: string;
  displayName: string | null;
  buildingName: string;
  floorNo: number;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  adults: number;
  children: number;
  bookedNightlyRate: string;
  roomSubtotal: number;
  status: "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";
  checkedInAt: string | null;
  checkedOutAt: string | null;
}

interface CustomerProps {
  id: string;
  firstName: string;
  lastName: string | null;
  idProofType: string | null;
  idProofNumber: string | null;
}

export function AllocationActionRow({
  allocation: initialAllocation,
  customer,
}: {
  allocation: AllocationProps;
  customer: CustomerProps;
}) {
  const router = useRouter();
  const [allocation, setAllocation] = useState(initialAllocation);

  // Check-In Dialog State
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [idType, setIdType] = useState(customer.idProofType || "Passport");
  const [idNumber, setIdNumber] = useState(customer.idProofNumber || "");
  const [checkInNotes, setCheckInNotes] = useState("");
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  // Check-Out Dialog State
  const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
  const [checkOutNotes, setCheckOutNotes] = useState("");
  const [submittingCheckOut, setSubmittingCheckOut] = useState(false);
  const [checkOutError, setCheckOutError] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Confirmed
          </Badge>
        );
      case "CHECKED_IN":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
            <LogIn className="h-3.5 w-3.5 mr-1" />
            Checked In
          </Badge>
        );
      case "CHECKED_OUT":
        return (
          <Badge variant="secondary" className="bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/30">
            <LogOut className="h-3.5 w-3.5 mr-1" />
            Checked Out
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30">
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCheckIn = async () => {
    setCheckInError(null);
    setSubmittingCheckIn(true);

    try {
      const res = await fetch(`/api/room-allocations/${allocation.id}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verifiedIdType: idType,
          verifiedIdNumber: idNumber,
          notes: checkInNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to check in room allocation");
      }

      setAllocation((prev) => ({
        ...prev,
        status: "CHECKED_IN",
        roomStatus: "OCCUPIED",
        checkedInAt: new Date().toISOString(),
      }));

      setIsCheckInOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check in";
      setCheckInError(msg);
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckOutError(null);
    setSubmittingCheckOut(true);

    try {
      const res = await fetch(`/api/room-allocations/${allocation.id}/check-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: checkOutNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to check out room allocation");
      }

      setAllocation((prev) => ({
        ...prev,
        status: "CHECKED_OUT",
        roomStatus: "VACANT_DIRTY",
        checkedOutAt: new Date().toISOString(),
      }));

      setIsCheckOutOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check out";
      setCheckOutError(msg);
    } finally {
      setSubmittingCheckOut(false);
    }
  };

  const guestName = `${customer.firstName} ${customer.lastName || ""}`.trim();

  return (
    <div className="p-4 space-y-3">
      {/* Allocation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-base">
            Room {allocation.roomNo}
          </span>
          <Badge variant="secondary" className="text-xs">
            {allocation.categoryName}
          </Badge>
          {allocation.displayName && (
            <span className="text-xs text-muted-foreground">
              • {allocation.displayName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(allocation.status)}

          {/* Action Buttons */}
          {allocation.status === "CONFIRMED" && (
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                setCheckInError(null);
                setIsCheckInOpen(true);
              }}
            >
              <LogIn className="h-3 w-3 mr-1" />
              Check In
            </Button>
          )}

          {allocation.status === "CHECKED_IN" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
              onClick={() => {
                setCheckOutError(null);
                setIsCheckOutOpen(true);
              }}
            >
              <LogOut className="h-3 w-3 mr-1" />
              Check Out
            </Button>
          )}
        </div>
      </div>

      {/* Grid of stay details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-muted/20 p-2.5 rounded-lg border">
        <div>
          <span className="text-muted-foreground block text-[10px]">Location & Status</span>
          <span>
            {allocation.buildingName}, Fl {allocation.floorNo}
          </span>
          <span className="text-[10px] text-muted-foreground block font-mono">
            Physical: {allocation.roomStatus}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground block text-[10px]">Stay Interval</span>
          <span className="font-medium">
            {allocation.arrivalDate} → {allocation.departureDate}
          </span>
          <span className="text-[10px] text-muted-foreground block">
            ({allocation.nights} night{allocation.nights === 1 ? "" : "s"})
          </span>
        </div>

        <div>
          <span className="text-muted-foreground block text-[10px]">Guests</span>
          <span>
            {allocation.adults} Adult{allocation.adults === 1 ? "" : "s"}
            {allocation.children > 0 && `, ${allocation.children} Child`}
          </span>
          {allocation.checkedInAt && (
            <span className="text-[10px] text-muted-foreground block">
              In: {new Date(allocation.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {allocation.checkedOutAt && (
            <span className="text-[10px] text-muted-foreground block">
              Out: {new Date(allocation.checkedOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        <div>
          <span className="text-muted-foreground block text-[10px]">Snapshotted Rate</span>
          <span className="font-mono font-semibold text-primary">
            ${parseFloat(allocation.bookedNightlyRate).toFixed(2)} / nt
          </span>
          <span className="text-[10px] text-muted-foreground block">
            Subtotal: ${allocation.roomSubtotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Check-In Dialog */}
      <Dialog open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <LogIn className="h-5 w-5 text-emerald-600" />
              Check In Room {allocation.roomNo}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Verify guest identity and confirm physical room readiness for guest arrival.
            </DialogDescription>
          </DialogHeader>

          {checkInError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{checkInError}</span>
            </div>
          )}

          <div className="space-y-3.5 py-1 text-xs">
            {/* Room Condition Card */}
            <div className="rounded-lg border p-3 bg-muted/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium">Physical Room Condition:</span>
                <Badge
                  variant={allocation.roomStatus === "VACANT_CLEAN" ? "default" : "destructive"}
                  className="text-[11px]"
                >
                  {allocation.roomStatus}
                </Badge>
              </div>
              {allocation.roomStatus !== "VACANT_CLEAN" && (
                <p className="text-[11px] text-destructive">
                  Warning: Room status must be VACANT_CLEAN to check in. Please inspect and update the room status first.
                </p>
              )}
            </div>

            {/* Guest Verification */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Guest Identity Verification ({guestName})
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">ID Type</Label>
                  <select
                    className="w-full text-xs h-8 rounded-md border border-input bg-transparent px-2 shadow-xs"
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                  >
                    <option value="Passport">Passport</option>
                    <option value="National ID">National ID</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">ID Number</Label>
                  <Input
                    className="h-8 text-xs font-mono"
                    placeholder="Document #"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs">Check-In Reception Notes</Label>
              <Input
                className="h-8 text-xs"
                placeholder="Key card issued, luggage stored, etc."
                value={checkInNotes}
                onChange={(e) => setCheckInNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCheckInOpen(false)}
              disabled={submittingCheckIn}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCheckIn}
              disabled={submittingCheckIn}
            >
              {submittingCheckIn ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Checking In...
                </>
              ) : (
                "Confirm Check-In"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check-Out Dialog */}
      <Dialog open={isCheckOutOpen} onOpenChange={setIsCheckOutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <LogOut className="h-5 w-5 text-blue-600" />
              Check Out Room {allocation.roomNo}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete guest departure for Room {allocation.roomNo} ({allocation.categoryName}).
            </DialogDescription>
          </DialogHeader>

          {checkOutError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{checkOutError}</span>
            </div>
          )}

          <div className="space-y-3 py-1 text-xs">
            <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
              <p className="font-medium text-foreground">Turnover Invariant Notice:</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Checking out Room {allocation.roomNo} will strictly transition its physical state to{" "}
                <strong className="text-foreground">VACANT_DIRTY</strong>. The room will require housekeeping cleaning and inspection before becoming ready for subsequent guests.
              </p>
            </div>

            <div>
              <Label className="text-xs">Check-Out Notes (Optional)</Label>
              <Input
                className="h-8 text-xs"
                placeholder="Key cards returned, minibar verified, etc."
                value={checkOutNotes}
                onChange={(e) => setCheckOutNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCheckOutOpen(false)}
              disabled={submittingCheckOut}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleCheckOut}
              disabled={submittingCheckOut}
            >
              {submittingCheckOut ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Checking Out...
                </>
              ) : (
                "Confirm Check-Out"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
