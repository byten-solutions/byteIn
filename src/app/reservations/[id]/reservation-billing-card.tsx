"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { InvoiceDetailDTO } from "@/modules/billing/billing.types"
import { CreditCard, ExternalLink, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge, MoneyText } from "@/components/ui-kit"

interface ReservationBillingCardProps {
  reservationId: string
  initialInvoice: InvoiceDetailDTO | null
  estimatedTotal: number
}

export function ReservationBillingCard({
  reservationId,
  initialInvoice,
  estimatedTotal,
}: ReservationBillingCardProps) {
  const router = useRouter()
  const [invoice, setInvoice] = React.useState<InvoiceDetailDTO | null>(initialInvoice)
  const [creating, setCreating] = React.useState(false)

  const handleCreateInvoice = async () => {
    setCreating(true)
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          autoIssue: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to create invoice")
      setInvoice(json.data)
      toast.success("Invoice generated successfully")
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create invoice"
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-3 pt-3 border-t border-border/60 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
          <CreditCard className="size-3.5 text-muted-foreground" />
          Billing & Invoicing
        </span>
        {invoice && <StatusBadge status={invoice.status} size="sm" />}
      </div>

      {invoice ? (
        <div className="space-y-2">
          <div className="flex justify-between text-muted-foreground">
            <span>Invoice No</span>
            <span className="font-mono text-foreground font-medium">#{invoice.invoiceNumber}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Grand Total</span>
            <MoneyText value={invoice.grandTotal} className="text-foreground" />
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Paid</span>
            <MoneyText value={invoice.totalPaid} className="text-foreground" />
          </div>
          <div className="flex justify-between font-semibold pt-1 border-t border-border/40">
            <span className="text-foreground">Balance Due</span>
            <MoneyText
              value={invoice.balanceDue}
              className={parseFloat(invoice.balanceDue) > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-foreground"}
            />
          </div>

          <div className="pt-2">
            <Link href={`/billing/${invoice.id}`} className="block w-full">
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5">
                <span>Open Invoice</span>
                <ExternalLink className="size-3" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex justify-between text-muted-foreground">
            <span>Estimated Total</span>
            <MoneyText value={estimatedTotal} className="text-foreground font-medium" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            No invoice generated yet for this reservation.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreateInvoice}
            disabled={creating}
            className="w-full h-8 text-xs gap-1.5"
          >
            {creating ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Plus className="size-3" />
                Generate Invoice
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
