"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, AlertCircle, ArrowRightLeft } from "lucide-react"
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
import type { FinancialAccountWithBalanceDTO } from "@/modules/financial-accounts/financial-accounts.types"

export function CreateTransferDialog({
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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {isOpen && (
        <CreateTransferForm
          onClose={onClose}
          propertyId={propertyId}
          accounts={accounts}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  )
}

function CreateTransferForm({
  onClose,
  propertyId,
  accounts,
  onSuccess,
}: {
  onClose: () => void
  propertyId: string
  accounts: FinancialAccountWithBalanceDTO[]
  onSuccess: () => void
}) {
  const activeAccounts = React.useMemo(() => accounts.filter((a) => a.isActive), [accounts])

  const [fromAccountId, setFromAccountId] = React.useState(activeAccounts[0]?.id || "")
  const [toAccountId, setToAccountId] = React.useState(activeAccounts[1]?.id || "")
  const [amount, setAmount] = React.useState("")
  const [transferDate, setTransferDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [description, setDescription] = React.useState("")
  const [referenceNumber, setReferenceNumber] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const sourceAccount = React.useMemo(
    () => activeAccounts.find((a) => a.id === fromAccountId),
    [activeAccounts, fromAccountId]
  )

  const availableBalance = sourceAccount
    ? parseFloat(sourceAccount.currentBalance || "0")
    : 0

  const parsedAmount = parseFloat(amount || "0")
  const isOverspending =
    !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount > availableBalance

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fromAccountId || !toAccountId) {
      setError("Please select both source and destination accounts.")
      return
    }

    if (fromAccountId === toAccountId) {
      setError("Source and destination accounts must be different.")
      return
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Transfer amount must be strictly greater than zero.")
      return
    }

    if (parsedAmount > availableBalance) {
      setError(
        `Insufficient balance. Source account only has ₹${availableBalance.toFixed(
          2
        )} available.`
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/account-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          fromAccountId,
          toAccountId,
          amount: parsedAmount,
          transferDate,
          description: description.trim() || undefined,
          referenceNumber: referenceNumber.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute transfer")
      }

      toast.success("Account transfer executed successfully")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred"
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (activeAccounts.length < 2) {
    return (
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Inter-Account Transfer</DialogTitle>
        </DialogHeader>
        <div className="py-6 text-center space-y-2">
          <AlertCircle className="size-8 text-amber-500 mx-auto" />
          <p className="text-sm font-semibold">At least 2 active accounts required</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            You must have at least two active financial accounts in this hotel to execute funds transfers.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    )
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ArrowRightLeft className="size-4 text-primary" />
          Execute Inter-Account Transfer
        </DialogTitle>
        <DialogDescription>
          Transfer liquid funds between physical drawers and bank accounts.
        </DialogDescription>
      </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive font-medium">
              {error}
            </div>
          )}

          {/* Source Account */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="fromAcc" className="text-xs font-medium">Source Account (Debit) *</Label>
              {sourceAccount && (
                <span className="text-[11px] font-mono text-muted-foreground">
                  Available: <span className="font-semibold text-foreground"><MoneyText value={sourceAccount.currentBalance} /></span>
                </span>
              )}
            </div>
            <select
              id="fromAcc"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-xs outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/20"
              value={fromAccountId}
              onChange={(e) => {
                const newFrom = e.target.value
                setFromAccountId(newFrom)
                if (newFrom === toAccountId) {
                  const other = activeAccounts.find((a) => a.id !== newFrom)
                  if (other) setToAccountId(other.id)
                }
              }}
              required
            >
              {activeAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName} ({acc.accountType}) — Bal: ₹{parseFloat(acc.currentBalance || "0").toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {/* Destination Account */}
          <div className="space-y-1.5">
            <Label htmlFor="toAcc" className="text-xs font-medium">Destination Account (Credit) *</Label>
            <select
              id="toAcc"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-xs outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/20"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              required
            >
              {activeAccounts
                .filter((acc) => acc.id !== fromAccountId)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountName} ({acc.accountType}) — Bal: ₹{parseFloat(acc.currentBalance || "0").toFixed(2)}
                  </option>
                ))}
            </select>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trAmount" className="text-xs font-medium">Amount (₹) *</Label>
              <Input
                id="trAmount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={isOverspending ? "border-destructive text-destructive" : ""}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trDate" className="text-xs font-medium">Transfer Date *</Label>
              <Input
                id="trDate"
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                required
              />
            </div>
          </div>

          {isOverspending && (
            <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>Insufficient funds: Transfer amount exceeds available balance.</span>
            </div>
          )}

          {/* Reference & Description */}
          <div className="space-y-1.5">
            <Label htmlFor="trRef" className="text-xs font-medium">Reference Number (Optional)</Label>
            <Input
              id="trRef"
              placeholder="e.g. SLIP-8912, DEPOSIT-001"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trDesc" className="text-xs font-medium">Description / Reason (Optional)</Label>
            <Input
              id="trDesc"
              placeholder="e.g. Cash drawer float deposit to operating bank"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || isOverspending || parsedAmount <= 0}
              className="font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Executing...
                </>
              ) : (
                "Execute Transfer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
  )
}
