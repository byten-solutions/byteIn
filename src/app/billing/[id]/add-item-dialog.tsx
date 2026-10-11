"use client"

import * as React from "react"
import { toast } from "sonner"
import type { InvoiceDetailDTO } from "@/modules/billing/billing.types"
import { InvoiceItemType } from "@prisma/client"
import { Plus, Loader2 } from "lucide-react"
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

interface AddItemDialogProps {
  invoice: InvoiceDetailDTO
  isOpen: boolean
  onClose: () => void
  onSuccess: (updated: InvoiceDetailDTO) => void
}

const COMMON_PRESETS = [
  { name: "Minibar Charges", price: 500.0 },
  { name: "Room Service", price: 800.0 },
  { name: "Laundry Service", price: 400.0 },
  { name: "Airport Transfer", price: 1500.0 },
  { name: "Late Checkout Fee", price: 1000.0 },
  { name: "Extra Bedding / Linen", price: 600.0 },
]

export function AddItemDialog({
  invoice,
  isOpen,
  onClose,
  onSuccess,
}: AddItemDialogProps) {
  const [description, setDescription] = React.useState("")
  const [quantity, setQuantity] = React.useState("1")
  const [unitPrice, setUnitPrice] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handlePresetClick = (preset: { name: string; price: number }) => {
    setDescription(preset.name)
    setUnitPrice(preset.price.toFixed(2))
  }

  const qtyNum = parseFloat(quantity) || 0
  const priceNum = parseFloat(unitPrice) || 0
  const calculatedTotal = qtyNum * priceNum

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!description.trim()) {
      setError("Item description is required.")
      return
    }
    if (qtyNum <= 0) {
      setError("Quantity must be greater than zero.")
      return
    }
    if (priceNum < 0) {
      setError("Unit price cannot be negative.")
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          quantity: qtyNum,
          unitPrice: priceNum,
          itemType: InvoiceItemType.EXTRA_CHARGE,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to add charge")
      }

      toast.success("Extra charge added to invoice")
      onSuccess(json.data)
      onClose()
      setDescription("")
      setUnitPrice("")
      setQuantity("1")
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
          <DialogTitle>Add Extra Charge</DialogTitle>
          <DialogDescription>
            Add supplementary items or services to Invoice #{invoice.invoiceNumber}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive font-medium">
              {error}
            </div>
          )}

          {/* Quick Presets as chips */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Quick Presets</Label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted hover:border-primary/40 transition-colors cursor-pointer"
                >
                  {preset.name} (₹{preset.price.toLocaleString("en-IN")})
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Item Description *</Label>
            <Input
              placeholder="e.g. Minibar, Room Service, Laundry..."
              className="h-10 text-xs sm:text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Quantity *</Label>
              <Input
                type="number"
                min="0.01"
                step="any"
                className="h-10 text-xs sm:text-sm font-mono"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Unit Price *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground select-none">
                  ₹
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-7 h-10 text-xs sm:text-sm font-mono"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Calculated Line Total */}
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">Line Total:</span>
            <MoneyText value={calculatedTotal} className="text-sm font-bold text-foreground" />
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
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-1.5 size-3.5" />
                  Add Charge
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
