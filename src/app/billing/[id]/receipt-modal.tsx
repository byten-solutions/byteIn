"use client"

import * as React from "react"
import type { PaymentReceiptDTO } from "@/modules/billing/billing.types"
import { Printer, ShieldCheck, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { MoneyText } from "@/components/ui-kit"
import { formatDateTime } from "@/lib/date-format"
import { getPaymentMethodLabel, formatStaffName } from "@/lib/currency"

interface ReceiptModalProps {
  receipt: PaymentReceiptDTO | null
  invoiceId?: string
  isOpen: boolean
  onClose: () => void
}

export function ReceiptModal({ receipt, invoiceId, isOpen, onClose }: ReceiptModalProps) {
  if (!receipt) return null

  const handlePrint = () => {
    if (invoiceId && receipt.paymentId) {
      window.open(`/billing/${invoiceId}/receipts/${receipt.paymentId}/print`, "_blank")
    } else {
      window.print()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden print:p-0 print:border-none print:shadow-none">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
            <DialogTitle className="text-sm font-bold text-foreground">
              Official Payment Receipt
            </DialogTitle>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Printer className="size-3.5" />
            Print Receipt
          </Button>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-8 space-y-6 text-xs print:p-6" id="printable-receipt">
          {/* Header */}
          <div className="text-center pb-5 border-b border-dashed border-border/80">
            <div className="font-extrabold text-2xl tracking-tight text-foreground font-mono">
              byteInn PMS
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reception Desk • Payment Receipt & Acknowledgment
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-3 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="size-3.5" />
              <span>Payment Confirmed</span>
            </div>
          </div>

          {/* Receipt Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                Receipt Number
              </span>
              <span className="font-mono font-bold text-foreground text-sm">
                {receipt.receiptNumber}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                Invoice Number
              </span>
              <span className="font-mono font-bold text-foreground text-sm">
                #{receipt.invoiceNumber}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                Guest Name
              </span>
              <span className="font-medium text-foreground">{receipt.customerName}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                Reservation #
              </span>
              <span className="font-mono text-foreground">#{receipt.reservationNo}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                Date & Time
              </span>
              <span className="text-foreground">
                {formatDateTime(receipt.paidAt)}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                Payment Method
              </span>
              <span className="font-medium text-foreground">
                {getPaymentMethodLabel(receipt.paymentMethod)}
                {receipt.referenceNumber ? ` • Ref ${receipt.referenceNumber}` : ""}
              </span>
            </div>
          </div>

          {/* Amount Paid Callout */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/70 flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">Amount Paid</span>
            <MoneyText value={receipt.amountPaid} className="text-xl font-extrabold text-foreground" />
          </div>

          {/* Folio Balance Summary */}
          <div className="space-y-1.5 pt-2 border-t text-muted-foreground">
            <div className="flex justify-between">
              <span>Invoice Total:</span>
              <MoneyText value={receipt.invoiceGrandTotal} className="text-foreground font-medium" />
            </div>
            <div className="flex justify-between">
              <span>Total Paid to Date:</span>
              <MoneyText value={receipt.invoiceTotalPaid} className="text-foreground font-medium" />
            </div>
            <div className="flex justify-between font-bold pt-1 border-t text-foreground">
              <span>Remaining Balance:</span>
              <MoneyText
                value={receipt.remainingBalance}
                className={parseFloat(receipt.remainingBalance) > 0 ? "text-foreground font-bold" : "text-muted-foreground"}
              />
            </div>
          </div>

          {/* Footer Staff attribution */}
          <div className="pt-4 border-t text-[11px] text-muted-foreground text-center">
            Issued by <strong className="text-foreground">{formatStaffName(receipt.recordedByName)}</strong> • byteInn Property Management System
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
