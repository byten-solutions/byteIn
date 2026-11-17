"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Search,
  Receipt,
  Loader2,
  AlertCircle,
  CreditCard,
  User,
  BedDouble,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RecordPaymentDialog } from "@/app/billing/[id]/record-payment-dialog"
import { formatMoney } from "@/lib/currency"
import type { InvoiceDetailDTO, PaymentReceiptDTO } from "@/modules/billing/billing.types"

interface RawInvoiceItem {
  id: string
  invoiceNumber: string
  customerName?: string | null
  status: string
  grandTotal: string | number
  payments?: Array<{ status: string; amount: string | number }>
  reservation?: {
    reservationNo?: string | null
    customer?: { firstName: string; lastName?: string | null } | null
    rooms?: Array<{ room?: { roomNo?: string | null } | null }>
  } | null
}

interface InvoiceListItem {
  id: string
  invoiceNumber: string
  customerName?: string | null
  status: string
  grandTotal: string
  totalPaid: string
  balanceDue: string
  reservationNo?: string | null
  roomNumbers?: string[]
}

function mapRawInvoices(rawItems: RawInvoiceItem[]): InvoiceListItem[] {
  return rawItems
    .map((inv) => {
      const grandTotal = Number(inv.grandTotal ?? 0)
      const payments = Array.isArray(inv.payments)
        ? inv.payments
            .filter((p) => p.status === "RECORDED")
            .reduce((acc, p) => acc + Number(p.amount ?? 0), 0)
        : 0
      const balanceDue = Math.max(0, grandTotal - payments)

      const rooms: string[] = []
      if (inv.reservation?.rooms) {
        for (const r of inv.reservation.rooms) {
          if (r.room?.roomNo) rooms.push(r.room.roomNo)
        }
      }

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName:
          inv.customerName ||
          (inv.reservation?.customer
            ? `${inv.reservation.customer.firstName} ${inv.reservation.customer.lastName || ""}`.trim()
            : "Walk-in Guest"),
        status: inv.status,
        grandTotal: grandTotal.toFixed(2),
        totalPaid: payments.toFixed(2),
        balanceDue: balanceDue.toFixed(2),
        reservationNo: inv.reservation?.reservationNo || null,
        roomNumbers: rooms,
      }
    })
    .filter((inv) => Number(inv.balanceDue) > 0 && inv.status !== "VOID")
}

interface CollectPaymentQuickDialogProps {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  onSuccess?: () => void
}

export function CollectPaymentQuickDialog({
  isOpen,
  onClose,
  propertyId,
  onSuccess,
}: CollectPaymentQuickDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {isOpen && (
        <CollectPaymentQuickContent
          propertyId={propertyId}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  )
}

function CollectPaymentQuickContent({
  propertyId,
  onSuccess,
}: {
  propertyId: string
  onSuccess?: () => void
}) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [invoices, setInvoices] = React.useState<InvoiceListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Payment Recording Modal state
  const [selectedInvoice, setSelectedInvoice] = React.useState<InvoiceDetailDTO | null>(null)
  const [loadingInvoiceDetail, setLoadingInvoiceDetail] = React.useState(false)
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = React.useState(false)

  // Initial load
  React.useEffect(() => {
    let active = true

    async function loadInitial() {
      try {
        const res = await fetch(`/api/invoices?propertyId=${propertyId}&limit=15`)
        const data = await res.json()
        if (!active) return

        if (!res.ok) {
          throw new Error(data.error || "Failed to search invoices")
        }

        const rawItems: RawInvoiceItem[] = Array.isArray(data.data?.invoices)
          ? data.data.invoices
          : []
        setInvoices(mapRawInvoices(rawItems))
      } catch (err: unknown) {
        if (!active) return
        const msg = err instanceof Error ? err.message : "Error fetching invoices"
        setError(msg)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadInitial()

    return () => {
      active = false
    }
  }, [propertyId])

  // Explicit user-triggered search
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        propertyId,
        limit: "15",
      })
      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim())
      }

      const res = await fetch(`/api/invoices?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to search invoices")
      }

      const rawItems: RawInvoiceItem[] = Array.isArray(data.data?.invoices)
        ? data.data.invoices
        : []
      setInvoices(mapRawInvoices(rawItems))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error fetching invoices"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectInvoice = async (invoiceId: string) => {
    setLoadingInvoiceDetail(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to load invoice details")
      }
      setSelectedInvoice(data.data)
      setIsRecordPaymentOpen(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load invoice"
      toast.error(msg)
    } finally {
      setLoadingInvoiceDetail(false)
    }
  }

  const handlePaymentSuccess = (
    _updatedInvoice: InvoiceDetailDTO,
    receipt: PaymentReceiptDTO
  ) => {
    toast.success(`Payment of ${formatMoney(receipt.amountPaid)} collected successfully!`)
    setIsRecordPaymentOpen(false)
    setSelectedInvoice(null)
    onSuccess?.()
  }

  return (
    <>
      <DialogContent className="max-w-2xl sm:max-w-3xl">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Receipt className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Quick Collect Payment
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Search unpaid guest invoices by guest name, invoice number, or reservation number
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="pt-2 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by guest name, invoice # (e.g. INV-), or reservation #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className="h-9 text-xs px-4 gap-1.5"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Search"}
          </Button>
        </form>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Table / Results */}
        <div className="rounded-lg border border-border/80 overflow-hidden max-h-[360px] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-xs">Searching unpaid invoices...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-1">
              <Receipt className="size-8 mx-auto stroke-1 text-muted-foreground/50" />
              <p className="text-xs font-medium">No outstanding unpaid invoices found</p>
              <p className="text-[11px] text-muted-foreground/80">
                {searchTerm ? "Try searching with a different term" : "All current invoices are settled"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 text-[11px]">
                  <TableHead className="w-28 font-mono">Invoice #</TableHead>
                  <TableHead>Guest / Reservation</TableHead>
                  <TableHead className="text-right">Grand Total</TableHead>
                  <TableHead className="text-right font-semibold">Balance Due</TableHead>
                  <TableHead className="w-28 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id} className="text-xs hover:bg-muted/20">
                    <TableCell className="font-mono font-semibold text-foreground">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium text-foreground flex items-center gap-1.5">
                          <User className="size-3 text-muted-foreground" />
                          {inv.customerName}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          {inv.reservationNo && (
                            <span>Res: #{inv.reservationNo}</span>
                          )}
                          {inv.roomNumbers && inv.roomNumbers.length > 0 && (
                            <span className="flex items-center gap-0.5">
                              <BedDouble className="size-3" />
                              Rm {inv.roomNumbers.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatMoney(inv.grandTotal)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                      {formatMoney(inv.balanceDue)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingInvoiceDetail}
                        onClick={() => handleSelectInvoice(inv.id)}
                        className="h-7 text-[11px] gap-1 hover:bg-primary hover:text-primary-foreground border-primary/40"
                      >
                        <CreditCard className="size-3" />
                        Collect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>

      {/* Embedded Billing Record Payment Dialog */}
      {selectedInvoice && (
        <RecordPaymentDialog
          invoice={selectedInvoice}
          isOpen={isRecordPaymentOpen}
          onClose={() => {
            setIsRecordPaymentOpen(false)
            setSelectedInvoice(null)
          }}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </>
  )
}
