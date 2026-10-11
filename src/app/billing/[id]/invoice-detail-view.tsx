"use client";

import { useState } from "react";
import Link from "next/link";
import { InvoiceStatus, InvoiceItemType, PaymentStatus } from "@prisma/client";
import {
  InvoiceDetailDTO,
  PaymentDTO,
  PaymentReceiptDTO,
} from "@/modules/billing/billing.types";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { AddItemDialog } from "./add-item-dialog";
import { ReceiptModal } from "./receipt-modal";
import {
  ArrowLeft,
  CreditCard,
  Plus,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Trash2,
  Receipt,
  User,
  Calendar,
  DollarSign,
  Ban,
} from "lucide-react";

interface InvoiceDetailViewProps {
  initialInvoice: InvoiceDetailDTO;
}

export function InvoiceDetailView({ initialInvoice }: InvoiceDetailViewProps) {
  const [invoice, setInvoice] = useState<InvoiceDetailDTO>(initialInvoice);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<PaymentReceiptDTO | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleIssueInvoice = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/issue`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to issue invoice");
      setInvoice(json.data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to issue invoice");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to remove this line item?")) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/items/${itemId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove item");
      setInvoice(json.data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to remove item");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidPayment = async (paymentId: string) => {
    if (!confirm("Are you sure you want to void this recorded payment?")) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments/${paymentId}/void`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to void payment");
      setInvoice(json.data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to void payment");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaymentSuccess = (
    updatedInvoice: InvoiceDetailDTO,
    receipt: PaymentReceiptDTO
  ) => {
    setInvoice(updatedInvoice);
    setReceiptData(receipt);
    setIsReceiptOpen(true);
  };

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
    });
    setIsReceiptOpen(true);
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3.5" />
            Fully Paid
          </span>
        );
      case InvoiceStatus.PARTIALLY_PAID:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <Clock className="size-3.5" />
            Partially Paid
          </span>
        );
      case InvoiceStatus.ISSUED:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            <AlertCircle className="size-3.5" />
            Issued (Unpaid)
          </span>
        );
      case InvoiceStatus.DRAFT:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border border-zinc-500/20">
            <FileText className="size-3.5" />
            Draft
          </span>
        );
      case InvoiceStatus.VOID:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20">
            Void
          </span>
        );
    }
  };

  const canRecordPayment =
    invoice.status !== InvoiceStatus.VOID &&
    parseFloat(invoice.balanceDue) > 0;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/billing"
            className="p-2 rounded-lg border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {invoice.invoiceNumber}
              </h1>
              {getStatusBadge(invoice.status)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Created on {new Date(invoice.createdAt).toLocaleDateString()} •{" "}
              <Link
                href={`/reservations/${invoice.reservationId}`}
                className="text-primary hover:underline font-mono"
              >
                Reservation #{invoice.reservationNo}
              </Link>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {invoice.status === InvoiceStatus.DRAFT && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleIssueInvoice}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="size-3.5" />
              Issue Invoice
            </button>
          )}

          <button
            type="button"
            disabled={invoice.status === InvoiceStatus.VOID}
            onClick={() => setIsAddItemOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border bg-card hover:bg-muted text-foreground transition cursor-pointer disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            Add Extra Charge
          </button>

          {canRecordPayment && (
            <button
              type="button"
              onClick={() => setIsPaymentOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
            >
              <DollarSign className="size-4" />
              Record Payment
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <Printer className="size-3.5" />
            Print
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Items and Payments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Itemized Table */}
          <div className="bg-card border rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b flex items-center justify-between bg-muted/20">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Receipt className="size-4 text-primary" />
                Billed Items & Room Charges
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                {invoice.items.length} item{invoice.items.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b uppercase text-[10px] tracking-wider text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Item & Description</th>
                    <th className="py-2.5 px-4 text-center">Type</th>
                    <th className="py-2.5 px-4 text-right">Qty</th>
                    <th className="py-2.5 px-4 text-right">Unit Rate</th>
                    <th className="py-2.5 px-4 text-right">Line Total</th>
                    <th className="py-2.5 px-2 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/15 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-medium text-foreground block">
                          {item.description}
                        </span>
                        {item.reservationRoomId && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Allocation #{item.reservationRoomId.slice(-6)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.itemType === InvoiceItemType.ROOM_CHARGE
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                              : "bg-purple-500/10 text-purple-700 dark:text-purple-400"
                          }`}
                        >
                          {item.itemType === InvoiceItemType.ROOM_CHARGE
                            ? "Room Stay"
                            : "Extra"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        {parseFloat(item.quantity)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                        ${item.unitPrice}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        ${item.lineTotal}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {item.itemType !== InvoiceItemType.ROOM_CHARGE &&
                          invoice.status !== InvoiceStatus.VOID && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-muted-foreground hover:text-red-600 p-1 rounded-md hover:bg-red-500/10 transition cursor-pointer"
                              title="Remove extra charge"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-card border rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b flex items-center justify-between bg-muted/20">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <CreditCard className="size-4 text-emerald-600" />
                Payments & Receipts
              </h2>
              {canRecordPayment && (
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(true)}
                  className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="size-3" />
                  Record New
                </button>
              )}
            </div>

            {invoice.payments.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                <Clock className="size-6 mx-auto mb-2 opacity-40" />
                No payments recorded yet for this invoice.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b uppercase text-[10px] tracking-wider text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Date & Time</th>
                      <th className="py-2.5 px-4">Method & Ref</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {invoice.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/15 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-medium text-foreground block">
                            {new Date(p.paidAt).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(p.paidAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-foreground">
                            {p.paymentMethod}
                          </span>
                          {p.referenceNumber && (
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              Ref: {p.referenceNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p.status === PaymentStatus.RECORDED ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                              Recorded
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-700 dark:text-red-400">
                              Voided
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                          ${p.amount}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          {p.status === PaymentStatus.RECORDED && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleViewReceipt(p)}
                                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition cursor-pointer"
                              >
                                Receipt
                              </button>
                              <button
                                type="button"
                                onClick={() => handleVoidPayment(p.id)}
                                className="px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition cursor-pointer"
                                title="Void Payment"
                              >
                                <Ban className="size-3.5 inline" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Customer Info & Financial Summary */}
        <div className="space-y-6">
          {/* Financial Breakdown Card */}
          <div className="bg-card border rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <DollarSign className="size-4 text-primary" />
              Financial Summary
            </h3>

            <div className="space-y-2 text-xs divide-y divide-border/60">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono font-medium text-foreground">
                  ${invoice.subtotal}
                </span>
              </div>

              {parseFloat(invoice.discountTotal) > 0 && (
                <div className="flex justify-between py-1 text-emerald-600">
                  <span>Discount</span>
                  <span className="font-mono font-medium">
                    -${invoice.discountTotal}
                  </span>
                </div>
              )}

              {parseFloat(invoice.taxTotal) > 0 && (
                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>Tax Total</span>
                  <span className="font-mono font-medium text-foreground">
                    +${invoice.taxTotal}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-2 text-sm font-bold">
                <span className="text-foreground">Grand Total</span>
                <span className="font-mono text-primary text-base">
                  ${invoice.grandTotal}
                </span>
              </div>

              <div className="flex justify-between py-1 text-emerald-600 dark:text-emerald-400">
                <span className="font-medium">Total Paid</span>
                <span className="font-mono font-bold">${invoice.totalPaid}</span>
              </div>

              <div className="flex justify-between py-2.5 font-bold text-sm bg-muted/20 px-2 rounded-lg mt-2">
                <span className="text-foreground">Balance Due</span>
                <span
                  className={`font-mono text-base ${
                    parseFloat(invoice.balanceDue) === 0
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}
                >
                  ${invoice.balanceDue}
                </span>
              </div>
            </div>

            {canRecordPayment && (
              <button
                type="button"
                onClick={() => setIsPaymentOpen(true)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <DollarSign className="size-4" />
                Pay Balance (${invoice.balanceDue})
              </button>
            )}
          </div>

          {/* Billed Customer Card */}
          <div className="bg-card border rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <User className="size-3.5 text-primary" />
              Billed Guest
            </h3>
            <div>
              <Link
                href={`/customers/${invoice.customerId}`}
                className="text-base font-bold text-foreground hover:text-primary transition"
              >
                {invoice.customerName}
              </Link>
              {invoice.customerEmail && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {invoice.customerEmail}
                </div>
              )}
              {invoice.customerPhone && (
                <div className="text-xs text-muted-foreground">
                  {invoice.customerPhone}
                </div>
              )}
            </div>
          </div>

          {/* Reservation Card */}
          <div className="bg-card border rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Calendar className="size-3.5 text-primary" />
              Linked Reservation
            </h3>
            <div>
              <Link
                href={`/reservations/${invoice.reservationId}`}
                className="font-mono font-bold text-primary hover:underline"
              >
                Reservation #{invoice.reservationNo}
              </Link>
              <div className="text-xs text-muted-foreground mt-1">
                Room allocations and stay dates are locked to this booking.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <RecordPaymentDialog
        invoice={invoice}
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <AddItemDialog
        invoice={invoice}
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onSuccess={(updated) => setInvoice(updated)}
      />

      <ReceiptModal
        receipt={receiptData}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
      />
    </div>
  );
}
