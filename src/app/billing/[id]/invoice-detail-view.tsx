"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { InvoiceStatus, InvoiceItemType, PaymentStatus } from "@prisma/client"
import type {
  InvoiceDetailDTO,
  PaymentDTO,
  PaymentReceiptDTO,
} from "@/modules/billing/billing.types"
import {
  ArrowLeft,
  Plus,
  Printer,
  Receipt,
  Trash2,
  Ban,
  CreditCard,
  Send,
  Loader2,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  StatusBadge,
  MoneyText,
  ConfirmDialog,
  RowActionsMenu,
} from "@/components/ui-kit"
import { formatDate, formatDateTime } from "@/lib/date-format"
import { formatQuantity, getPaymentMethodLabel, formatStaffName } from "@/lib/currency"
import { AddItemDialog } from "./add-item-dialog"
import { RecordPaymentDialog } from "./record-payment-dialog"
import { ReceiptModal } from "./receipt-modal"
import { cn } from "@/lib/utils"

interface InvoiceDetailViewProps {
  initialInvoice: InvoiceDetailDTO
}

export function InvoiceDetailView({ initialInvoice }: InvoiceDetailViewProps) {
  const [invoice, setInvoice] = React.useState<InvoiceDetailDTO>(initialInvoice)
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false)
  const [isAddItemOpen, setIsAddItemOpen] = React.useState(false)
  const [receiptData, setReceiptData] = React.useState<PaymentReceiptDTO | null>(null)
  const [isReceiptOpen, setIsReceiptOpen] = React.useState(false)
  const [actionLoading, setActionLoading] = React.useState(false)

  // ConfirmDialog States
  const [itemToDelete, setItemToDelete] = React.useState<string | null>(null)
  const [paymentToVoid, setPaymentToVoid] = React.useState<string | null>(null)

  const balanceDueNum = parseFloat(invoice.balanceDue || "0")
  const discountTotalNum = parseFloat(invoice.discountTotal || "0")
  const taxTotalNum = parseFloat(invoice.taxTotal || "0")

  const handleIssueInvoice = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/issue`, {
        method: "POST",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to issue invoice")
      setInvoice(json.data)
      toast.success("Invoice issued successfully")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to issue invoice"
      toast.error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmRemoveItem = async () => {
    if (!itemToDelete) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/items/${itemToDelete}`, {
        method: "DELETE",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to remove item")
      setInvoice(json.data)
      toast.success("Line item removed")
      setItemToDelete(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove item"
      toast.error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmVoidPayment = async () => {
    if (!paymentToVoid) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments/${paymentToVoid}/void`, {
        method: "POST",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to void payment")
      setInvoice(json.data)
      toast.success("Payment voided")
      setPaymentToVoid(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to void payment"
      toast.error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  const handlePaymentSuccess = (
    updatedInvoice: InvoiceDetailDTO,
    receipt: PaymentReceiptDTO
  ) => {
    setInvoice(updatedInvoice)
    setReceiptData(receipt)
    setIsReceiptOpen(true)
  }

  const handleViewReceipt = (payment: PaymentDTO) => {
    setReceiptData({
      receiptNumber: `REC-${payment.id.slice(-8).toUpperCase()}`,
      paymentId: payment.id,
      invoiceNumber: invoice.invoiceNumber,
      reservationNo: invoice.reservationNo,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerPhone: invoice.customerPhone,
      amountPaid: payment.amount,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      paidAt: payment.paidAt,
      recordedByName: payment.creatorName || "Staff",
      invoiceGrandTotal: invoice.grandTotal,
      invoiceTotalPaid: invoice.totalPaid,
      remainingBalance: invoice.balanceDue,
      invoiceStatus: invoice.status,
    })
    setIsReceiptOpen(true)
  }

  const isDraft = invoice.status === InvoiceStatus.DRAFT

  return (
    <div className="space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center gap-2">
        <Link
          href="/billing"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Invoices</span>
        </Link>
      </div>

      {/* Invoice Header Card */}
      <div className="flex flex-col gap-6 rounded-xl border border-border/80 bg-card p-6 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
              Invoice #{invoice.invoiceNumber}
            </h1>
            <StatusBadge status={invoice.status} />
          </div>

          <div className="flex items-center gap-x-4 gap-y-1 text-xs text-muted-foreground flex-wrap">
            <span>
              Reservation:{" "}
              <Link
                href={`/reservations/${invoice.reservationId}`}
                className="font-mono font-medium text-primary hover:underline"
              >
                #{invoice.reservationNo}
              </Link>
            </span>
            <span>•</span>
            <span>
              Guest:{" "}
              <Link
                href={`/customers/${invoice.customerId}`}
                className="font-medium text-primary hover:underline"
              >
                {invoice.customerName}
              </Link>
            </span>
            <span>•</span>
            <span>
              Created {formatDate(invoice.createdAt)}
            </span>
          </div>
        </div>

        {/* Balance Due / Paid in Full & Primary Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0">
          {balanceDueNum === 0 && invoice.status === InvoiceStatus.PAID ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2 text-left sm:text-right">
              <Check className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 block">
                  Paid in full
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Total <MoneyText value={invoice.grandTotal} className="font-semibold text-foreground" /> (Paid <MoneyText value={invoice.totalPaid} className="font-semibold text-foreground" />)
                </span>
              </div>
            </div>
          ) : (
            <div className="text-left sm:text-right">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Balance Due
              </span>
              <MoneyText
                value={invoice.balanceDue}
                className={cn(
                  "text-2xl font-extrabold tracking-tight block",
                  balanceDueNum > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                )}
              />
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {balanceDueNum > 0 && invoice.status !== InvoiceStatus.PAID && (
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 font-semibold gap-1.5"
                onClick={() => setIsPaymentOpen(true)}
              >
                <CreditCard className="size-4" />
                <span>Record Payment</span>
              </Button>
            )}

            {isDraft && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-xs gap-1.5"
                onClick={handleIssueInvoice}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                <span>Issue</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-10 text-xs gap-1.5"
              onClick={() => window.open(`/billing/${invoice.id}/print`, "_blank")}
            >
              <Printer className="size-4" />
              <span>Print</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-muted/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Folio Line Items ({invoice.items.length})
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setIsAddItemOpen(true)}
            disabled={invoice.status === InvoiceStatus.VOID}
          >
            <Plus className="size-3.5" />
            <span>Add charge</span>
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold">Description</TableHead>
              <TableHead className="text-xs font-semibold">Type</TableHead>
              <TableHead className="text-right text-xs font-semibold">Qty</TableHead>
              <TableHead className="text-right text-xs font-semibold">Unit Price</TableHead>
              <TableHead className="text-right text-xs font-semibold">Total</TableHead>
              <TableHead className="w-[44px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items.map((item) => {
              const isRoom = item.itemType === InvoiceItemType.ROOM_CHARGE
              return (
                <TableRow key={item.id} className="text-xs h-14 hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <span className="text-foreground font-semibold block">{item.description}</span>
                  </TableCell>

                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border",
                        isRoom
                          ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                          : "bg-muted text-muted-foreground border-border/60"
                      )}
                    >
                      {item.itemType === InvoiceItemType.ROOM_CHARGE ? "Room Charge" : "Extra Charge"}
                    </span>
                  </TableCell>

                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatQuantity(item.quantity)}
                  </TableCell>

                  <TableCell className="text-right font-mono">
                    <MoneyText value={item.unitPrice} />
                  </TableCell>

                  <TableCell className="text-right font-mono font-semibold text-foreground">
                    <MoneyText value={item.lineTotal} />
                  </TableCell>

                  <TableCell className="text-right p-0 pr-3">
                    {!isRoom ? (
                      <RowActionsMenu
                        items={[
                          {
                            label: "Remove item",
                            icon: <Trash2 className="size-3.5" />,
                            variant: "destructive",
                            onClick: () => setItemToDelete(item.id),
                          },
                        ]}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {/* Totals Block Aligned Right */}
        <div className="p-5 border-t border-border/60 bg-muted/10 flex justify-end">
          <div className="w-72 space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <MoneyText value={invoice.subtotal} className="font-mono text-foreground font-medium" />
            </div>

            {discountTotalNum > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount:</span>
                <MoneyText value={invoice.discountTotal} sign="always" className="text-emerald-600 dark:text-emerald-400 font-mono" />
              </div>
            )}

            {taxTotalNum > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax:</span>
                <MoneyText value={invoice.taxTotal} sign="always" className="font-mono text-foreground" />
              </div>
            )}

            <div className="flex justify-between font-bold text-sm pt-2 border-t border-border/60 text-foreground">
              <span>Grand Total:</span>
              <MoneyText value={invoice.grandTotal} className="font-bold text-base text-foreground" />
            </div>

            <div className="flex justify-between text-muted-foreground">
              <span>Total Paid:</span>
              <MoneyText value={invoice.totalPaid} className="text-emerald-600 dark:text-emerald-400 font-medium" />
            </div>

            <div className="flex justify-between font-bold pt-2 border-t text-foreground">
              <span>Balance Due:</span>
              <MoneyText
                value={invoice.balanceDue}
                className={cn(
                  "font-bold text-base",
                  balanceDueNum > 0 ? "text-amber-600 dark:text-amber-400 font-extrabold" : "text-foreground"
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recorded Payments List */}
      <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-muted/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Recorded Payments ({invoice.payments.length})
          </h2>
          {balanceDueNum > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-primary"
              onClick={() => setIsPaymentOpen(true)}
            >
              <CreditCard className="size-3.5 mr-1" />
              Record Payment
            </Button>
          )}
        </div>

        {invoice.payments.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No payments recorded yet for this invoice.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {invoice.payments.map((p) => {
              const isVoid = p.status === PaymentStatus.VOIDED
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 text-xs gap-3 transition-colors",
                    isVoid ? "opacity-60 bg-muted/30" : "hover:bg-muted/20"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {getPaymentMethodLabel(p.paymentMethod)}
                      </span>
                      {p.referenceNumber && (
                        <span className="font-mono text-muted-foreground text-[11px]">
                          Ref {p.referenceNumber}
                        </span>
                      )}
                      <StatusBadge status={p.status} size="sm" />
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      {formatDateTime(p.paidAt)}
                      {p.creatorName && ` • Processed by ${formatStaffName(p.creatorName)}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <MoneyText
                      value={p.amount}
                      className={cn(
                        "text-sm font-bold",
                        isVoid ? "line-through text-muted-foreground" : "text-foreground"
                      )}
                    />

                    {!isVoid && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => handleViewReceipt(p)}
                      >
                        <Receipt className="size-3.5" />
                        <span>Receipt</span>
                      </Button>
                    )}

                    {!isVoid && (
                      <RowActionsMenu
                        items={[
                          {
                            label: "Void payment",
                            icon: <Ban className="size-3.5" />,
                            variant: "destructive",
                            onClick: () => setPaymentToVoid(p.id),
                          },
                        ]}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CONFIRM DIALOGS */}
      <ConfirmDialog
        open={itemToDelete !== null}
        onOpenChange={(open) => !open && setItemToDelete(null)}
        title="Remove Line Item"
        description="Are you sure you want to remove this extra charge from the invoice? The totals will be recomputed immediately."
        confirmText="Remove Item"
        variant="destructive"
        isPending={actionLoading}
        onConfirm={handleConfirmRemoveItem}
      />

      <ConfirmDialog
        open={paymentToVoid !== null}
        onOpenChange={(open) => !open && setPaymentToVoid(null)}
        title="Void Payment Record"
        description="Are you sure you want to void this recorded payment? The outstanding invoice balance will be restored immediately."
        confirmText="Void Payment"
        variant="destructive"
        isPending={actionLoading}
        onConfirm={handleConfirmVoidPayment}
      />

      {/* MODALS */}
      <AddItemDialog
        invoice={invoice}
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onSuccess={(updated) => setInvoice(updated)}
      />

      <RecordPaymentDialog
        invoice={invoice}
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <ReceiptModal
        receipt={receiptData}
        invoiceId={invoice.id}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
      />
    </div>
  )
}
