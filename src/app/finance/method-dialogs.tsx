"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
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
import type { FinancialAccountWithBalanceDTO } from "@/modules/financial-accounts/financial-accounts.types"
import type { PaymentMethodDTO } from "@/modules/payment-methods/payment-methods.types"

// ----------------------------------------------------------------------------
// Create Payment Method Dialog
// ----------------------------------------------------------------------------
export function CreatePaymentMethodDialog({
  isOpen,
  onClose,
  propertyId,
  accounts,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  accounts: FinancialAccountWithBalanceDTO[]
  onSuccess: () => void
}) {
  const [name, setName] = React.useState("")
  const [code, setCode] = React.useState("")
  const [defaultAccountId, setDefaultAccountId] = React.useState<string>("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Payment method name is required.")
      return
    }

    const cleanedCode = code.toUpperCase().trim()
    if (!cleanedCode) {
      setError("Code slug is required (e.g. UPI, CARD, CASH).")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          name: name.trim(),
          code: cleanedCode,
          defaultAccountId: defaultAccountId || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to create payment method")
      }

      toast.success("Payment method created successfully")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred"
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Payment Method</DialogTitle>
          <DialogDescription>
            Configure a payment option available to receptionists at checkout.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pmName" className="text-xs font-medium">Method Name *</Label>
            <Input
              id="pmName"
              placeholder="e.g. Reception UPI QR, Pine Labs POS"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!code) {
                  // Suggest code slug
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9_]/g, "_")
                      .slice(0, 20)
                  )
                }
              }}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pmCode" className="text-xs font-medium">Code Slug (Uppercase Alphanumeric) *</Label>
            <Input
              id="pmCode"
              placeholder="e.g. UPI, CARD, CASH, WALLET"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))
              }
              className="font-mono uppercase text-xs"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Unique identifier stored on receipts and printed guest folios.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pmDefaultAcc" className="text-xs font-medium">
              Suggested Destination Account (Optional)
            </Label>
            <select
              id="pmDefaultAcc"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-xs outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/20"
              value={defaultAccountId}
              onChange={(e) => setDefaultAccountId(e.target.value)}
            >
              <option value="">None (Prompt receptionist to select account)</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName} ({acc.accountType}) {acc.isDefault ? "[Default Operating]" : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              When receptionists choose this payment method, this account will be automatically pre-selected.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="font-semibold">
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Method"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// Edit Payment Method Dialog
// ----------------------------------------------------------------------------
export function EditPaymentMethodDialog({
  method,
  isOpen,
  onClose,
  propertyId,
  accounts,
  onSuccess,
}: {
  method: PaymentMethodDTO | null
  isOpen: boolean
  onClose: () => void
  propertyId: string
  accounts: FinancialAccountWithBalanceDTO[]
  onSuccess: () => void
}) {
  if (!method) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {isOpen && (
        <EditPaymentMethodForm
          key={method.id}
          method={method}
          propertyId={propertyId}
          accounts={accounts}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  )
}

function EditPaymentMethodForm({
  method,
  propertyId,
  accounts,
  onClose,
  onSuccess,
}: {
  method: PaymentMethodDTO
  propertyId: string
  accounts: FinancialAccountWithBalanceDTO[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = React.useState(method.name)
  const [defaultAccountId, setDefaultAccountId] = React.useState<string>(
    method.defaultAccountId || ""
  )
  const [isActive, setIsActive] = React.useState(method.isActive)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Method name cannot be empty.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/payment-methods/${method.id}?propertyId=${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          defaultAccountId: defaultAccountId || null,
          isActive,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update payment method")
      }

      toast.success("Payment method updated successfully")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred"
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Payment Method</DialogTitle>
          <DialogDescription>
            Modify name, default routing account, or active status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="editPmName" className="text-xs font-medium">Method Name *</Label>
            <Input
              id="editPmName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Code Slug</Label>
            <div className="h-10 w-full rounded-md border border-input bg-muted/40 px-3 py-2.5 font-mono text-xs text-muted-foreground">
              {method.code}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Code slugs cannot be modified to preserve transaction history integrity.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="editPmDefaultAcc" className="text-xs font-medium">
              Suggested Destination Account
            </Label>
            <select
              id="editPmDefaultAcc"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-xs outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/20"
              value={defaultAccountId}
              onChange={(e) => setDefaultAccountId(e.target.value)}
            >
              <option value="">None (Prompt receptionist to select account)</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName} ({acc.accountType}) {acc.isDefault ? "[Default Operating]" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-border/60">
            <input
              type="checkbox"
              id="editPmIsActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
            />
            <Label htmlFor="editPmIsActive" className="text-xs cursor-pointer font-normal">
              Method is Active (Visible to receptionists)
            </Label>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="font-semibold">
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
  )
}
