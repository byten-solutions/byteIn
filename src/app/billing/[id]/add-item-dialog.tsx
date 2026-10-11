"use client";

import { useState } from "react";
import { InvoiceDetailDTO } from "@/modules/billing/billing.types";
import { InvoiceItemType } from "@prisma/client";
import { Plus, X, AlertCircle } from "lucide-react";

interface AddItemDialogProps {
  invoice: InvoiceDetailDTO;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: InvoiceDetailDTO) => void;
}

const COMMON_PRESETS = [
  { name: "Minibar Charges", price: 15.0 },
  { name: "Room Service", price: 35.0 },
  { name: "Laundry Service", price: 20.0 },
  { name: "Airport Transfer", price: 45.0 },
  { name: "Late Checkout Fee", price: 30.0 },
  { name: "Extra Bedding / Linen", price: 25.0 },
];

export function AddItemDialog({
  invoice,
  isOpen,
  onClose,
  onSuccess,
}: AddItemDialogProps) {
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePresetClick = (preset: { name: string; price: number }) => {
    setDescription(preset.name);
    setUnitPrice(preset.price.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          quantity: parseFloat(quantity),
          unitPrice: parseFloat(unitPrice),
          itemType: InvoiceItemType.EXTRA_CHARGE,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to add charge");
      }

      onSuccess(json.data);
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
            <Plus className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Add Extra Charge</h2>
            <p className="text-xs text-muted-foreground">
              Add supplementary items or services to Invoice #{invoice.invoiceNumber}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick presets */}
        <div className="mb-4">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            Quick Presets
          </span>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handlePresetClick(p)}
                className="px-2.5 py-1 text-xs rounded-md bg-muted/50 hover:bg-muted text-foreground border border-border/60 transition cursor-pointer"
              >
                {p.name} (${p.price})
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Description *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Minibar beverages, Laundry, Airport shuttle"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Quantity *
              </label>
              <input
                type="number"
                step="1"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Unit Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.00"
                required
                placeholder="0.00"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div className="p-3 bg-muted/20 border rounded-lg flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Estimated Line Total:</span>
            <span className="font-bold font-mono text-primary text-sm">
              ${(
                (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0)
              ).toFixed(2)}
            </span>
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
              disabled={submitting || !description.trim() || !unitPrice}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Add to Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
