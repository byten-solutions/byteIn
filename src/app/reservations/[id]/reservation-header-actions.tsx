"use client"

import * as React from "react"
import Link from "next/link"
import { Printer, Receipt, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ReservationHeaderActionsProps {
  invoiceId?: string | null
  reservationId?: string
}

export function ReservationHeaderActions({
  invoiceId,
  reservationId,
}: ReservationHeaderActionsProps) {
  const printUrl = invoiceId
    ? `/billing/${invoiceId}/print`
    : reservationId
      ? `/reservations/${reservationId}/print`
      : null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {printUrl && (
        <a
          href={printUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-xs font-medium gap-1.5 cursor-pointer"
          >
            <Printer className="size-3.5" />
            <span>Print</span>
          </Button>
        </a>
      )}

      {invoiceId && (
        <Link href={`/billing/${invoiceId}`} className="inline-flex">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-xs font-medium gap-1.5 cursor-pointer"
          >
            <Receipt className="size-3.5" />
            <span>Invoice</span>
          </Button>
        </Link>
      )}

      <Link href="/reservations/new" className="inline-flex">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 text-xs font-medium gap-1.5 cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>New Reservation</span>
        </Button>
      </Link>
    </div>
  )
}
