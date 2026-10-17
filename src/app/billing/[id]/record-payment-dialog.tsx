"use client"

import * as React from "react"
import { toast } from "sonner"
import type { PaymentReceiptDTO, InvoiceDetailDTO } from "@/modules/billing/billing.types"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MoneyText } from "@/components/ui-kit"
import { cn } from "@/lib/utils"

interface RecordPaymentDialogProps {
  invoice: InvoiceDetailDTO
  isOpen: boolean
  onClose: () => void
  onPaymentSuccess: (invoice: InvoiceDetailDTO, receipt: PaymentReceiptDTO) => void
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Credit / Debit Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "UPI", label: "UPI" },
  { value: "OTHER", label: "Other" },
]

export function RecordPaymentDialog({
  invoice,
  isOpen,
  onClose,
  onPaymentSuccess,
}: RecordPaymentDialogProps) {
  const [amount, setAmount] = React.useState(invoice.balanceDue)
  const [paymentMethod, setPaymentMethod] = React.useState("CASH")
  const [referenceNumber, setReferenceNumber] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid payment amount greater than zero.")
      return
    }

    setSubmitting(true)

    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          amount: parsedAmount,
          paymentMethod,
          referenceNumber: referenceNumber.trim() || undefined,
          idempotencyKey,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to record payment")
      }

      toast.success("Payment recorded successfully", { duration: 3000 })
      onPaymentSuccess(json.data.invoice, json.data.receipt)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred"
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record guest settlement against Invoice #{invoice.invoiceNumber}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive font-medium">
              {error}
            </div>
          )}

          {/* Amount field with Pay Full Balance action */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Payment Amount *</Label>
              <button
                type="button"
                onClick={() => setAmount(invoice.balanceDue)}
                className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
              >
                Pay Full Balance (<MoneyText value={invoice.balanceDue} />)
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground select-none">
                ₹
              </span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                className="pl-7 h-10 text-xs sm:text-sm font-mono font-bold"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Payment Method Segmented Control */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Payment Method *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const active = paymentMethod === m.value
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value)}
                    className={cn(
                      "p-2.5 rounded-lg border text-xs font-medium text-left transition-colors cursor-pointer",
                      active
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/70 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Reference / Transaction ID */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Reference / Transaction Number (Optional)</Label>
            <Input
              placeholder="e.g. TXN-98421, Last 4 digits, Cheque no..."
              className="h-10 text-xs sm:text-sm font-mono"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Check className="mr-1.5 size-3.5" />
                  Confirm Payment (<MoneyText value={parseFloat(amount || "0")} />)
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
