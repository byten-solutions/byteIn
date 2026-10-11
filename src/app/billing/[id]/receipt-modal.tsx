"use client";

import { PaymentReceiptDTO } from "@/modules/billing/billing.types";
import { Printer, X, CheckCircle2, ShieldCheck } from "lucide-react";

interface ReceiptModalProps {
  receipt: PaymentReceiptDTO | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiptModal({ receipt, isOpen, onClose }: ReceiptModalProps) {
  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-card border rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden print:shadow-none print:border-none print:m-0 print:p-0">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600" />
            <span className="text-sm font-bold text-foreground">Official Payment Receipt</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition cursor-pointer shadow-xs"
            >
              <Printer className="size-3.5" />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              type="button"
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Content */}
        <div className="p-8 space-y-6 print:p-6" id="printable-receipt">
          {/* Header */}
          <div className="text-center pb-6 border-b border-dashed">
            <div className="font-extrabold text-2xl tracking-tight text-foreground font-mono">
              byteInn PMS
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reception Desk • Payment Receipt & Acknowledgment
            </p>
            <div className="inline-flex items-center gap-1 px-3 py-1 mt-3 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <CheckCircle2 className="size-3.5" />
              Payment Confirmed
            </div>
          </div>

          {/* Key Receipt Info Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                Receipt Number
              </span>
              <span className="font-mono font-bold text-foreground">
                {receipt.receiptNumber}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                Invoice Number
              </span>
              <span className="font-mono font-bold text-foreground">
                {receipt.invoiceNumber}
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
              <span className="font-mono text-foreground">{receipt.reservationNo}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                Date & Time
              </span>
              <span>{new Date(receipt.paidAt).toLocaleString()}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                Payment Method
              </span>
              <span className="font-semibold text-foreground">
                {receipt.paymentMethod}
                {receipt.referenceNumber ? ` (${receipt.referenceNumber})` : ""}
              </span>
            </div>
          </div>

          {/* Amount Paid Callout */}
          <div className="p-5 rounded-xl bg-muted/30 border text-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Amount Paid
            </span>
            <span className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
              ${receipt.amountPaid}
            </span>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Processed by: {receipt.recordedByName}
            </span>
          </div>

          {/* Financial Summary */}
          <div className="space-y-1.5 pt-2 text-xs border-t">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Invoice Grand Total:</span>
              <span className="font-mono text-foreground">${receipt.invoiceGrandTotal}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Total Payments Recorded:</span>
              <span className="font-mono text-emerald-600 font-semibold">
                ${receipt.invoiceTotalPaid}
              </span>
            </div>
            <div className="flex justify-between py-1 font-bold text-sm border-t pt-2">
              <span>Remaining Balance:</span>
              <span
                className={`font-mono ${
                  parseFloat(receipt.remainingBalance) === 0
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}
              >
                ${receipt.remainingBalance}
              </span>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center text-[11px] text-muted-foreground pt-4 border-t border-dashed">
            Thank you for staying with us. Please retain this receipt for your records.
          </div>
        </div>

        {/* Modal Close Footer */}
        <div className="px-6 py-3 bg-muted/10 border-t flex justify-end print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
