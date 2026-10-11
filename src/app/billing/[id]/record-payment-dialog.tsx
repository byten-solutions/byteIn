"use client";

import { useState } from "react";
import { PaymentReceiptDTO, InvoiceDetailDTO } from "@/modules/billing/billing.types";
import { CreditCard, DollarSign, X, CheckCircle2, AlertCircle } from "lucide-react";

interface RecordPaymentDialogProps {
  invoice: InvoiceDetailDTO;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (invoice: InvoiceDetailDTO, receipt: PaymentReceiptDTO) => void;
}

export function RecordPaymentDialog({
  invoice,
  isOpen,
  onClose,
  onPaymentSuccess,
}: RecordPaymentDialogProps) {
  const [amount, setAmount] = useState(invoice.balanceDue);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          paymentMethod,
          referenceNumber: referenceNumber.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to record payment");
      }

      onPaymentSuccess(json.data.invoice, json.data.receipt);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-card border rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          type="button"
          disabled={submitting}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <DollarSign className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Record Payment</h2>
            <p className="text-xs text-muted-foreground">
              Invoice #{invoice.invoiceNumber} • Outstanding: ${invoice.balanceDue}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-foreground">Payment Amount ($)</label>
              <button
                type="button"
                onClick={() => setAmount(invoice.balanceDue)}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Pay Full Balance (${invoice.balanceDue})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={parseFloat(invoice.balanceDue)}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 text-sm bg-muted/30 border rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "CASH", label: "Cash" },
                { id: "CARD", label: "Credit/Debit Card" },
                { id: "UPI", label: "UPI" },
                { id: "BANK_TRANSFER", label: "Bank Transfer" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`p-2.5 rounded-lg border text-xs font-medium text-left transition cursor-pointer flex items-center gap-2 ${
                    paymentMethod === m.id
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border hover:bg-muted/30 text-foreground"
                  }`}
                >
                  <CreditCard className="size-3.5" />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Reference / Transaction ID (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. TXN-984214, UPI ref, or last 4 digits"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg border hover:bg-muted transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || parseFloat(amount) <= 0}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                "Processing..."
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  Confirm Payment (${parseFloat(amount || "0").toFixed(2)})
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
