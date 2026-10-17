"use client"

import * as React from "react"
import Link from "next/link"
import { BedDouble, LogOut, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ReservationHeaderActionsProps {
  invoiceId?: string | null
  nextConfirmedRoom?: {
    id: string
    roomNo: string
  } | null
  nextCheckedInRoom?: {
    id: string
    roomNo: string
  } | null
}

export function ReservationHeaderActions({
  invoiceId,
  nextConfirmedRoom,
  nextCheckedInRoom,
}: ReservationHeaderActionsProps) {
  const triggerAction = (allocationId: string, action: "checkin" | "checkout") => {
    // Scroll smoothly to room card
    const elem = document.getElementById(`room-${allocationId}`)
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth", block: "center" })
    }
    // Dispatch custom event to trigger client modal in AllocationActionRow
    window.dispatchEvent(
      new CustomEvent("byteinn:open-action", {
        detail: { allocationId, action },
      })
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">

      {nextConfirmedRoom && (
        <Button
          onClick={() => triggerAction(nextConfirmedRoom.id, "checkin")}
          className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 text-xs font-semibold gap-1.5 shadow-xs"
        >
          <BedDouble className="size-3.5" />
          <span>Check In Room {nextConfirmedRoom.roomNo}</span>
        </Button>
      )}

      {nextCheckedInRoom && (
        <Button
          onClick={() => triggerAction(nextCheckedInRoom.id, "checkout")}
          variant={nextConfirmedRoom ? "outline" : "default"}
          className={`h-10 text-xs font-semibold gap-1.5 shadow-xs ${
            !nextConfirmedRoom
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : ""
          }`}
        >
          <LogOut className="size-3.5" />
          <span>Check Out Room {nextCheckedInRoom.roomNo}</span>
        </Button>
      )}

      {!nextConfirmedRoom && !nextCheckedInRoom && !invoiceId && (
        <Link href="/reservations/new">
          <Button variant="outline" className="h-10 text-xs gap-1.5">
            <Plus className="size-3.5" />
            <span>New Reservation</span>
          </Button>
        </Link>
      )}
    </div>
  )
}
