"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Loader2,
  AlertCircle,
  Receipt,
  Plus,
  Coins,
  Ban,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge, MoneyText } from "@/components/ui-kit"
import { formatDate } from "@/lib/date-format"
import type {
  IncomeDTO,
  IncomeDetailDTO,
  IncomeHeadDTO,
  IncomeReceiptDTO,
} from "@/modules/income/income.types"
import type { FinancialAccountWithBalanceDTO } from "@/modules/financial-accounts/financial-accounts.types"
import type { PaymentMethodDTO } from "@/modules/payment-methods/payment-methods.types"

// ----------------------------------------------------------------------------
// 1. Create Income Dialog
// ----------------------------------------------------------------------------
export function CreateIncomeDialog({
  isOpen,
  onClose,
  propertyId,
  categories,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  categories: IncomeHeadDTO[]
  onSuccess: () => void
}) {
  const [title, setTitle] = React.useState("")
  const [incomeHeadId, setIncomeHeadId] = React.useState(categories[0]?.id || "")
  const [expectedAmount, setExpectedAmount] = React.useState("")
  const [incomeDate, setIncomeDate] = React.useState(
    new Date().toISOString().slice(0, 10)
  )
  const [description, setDescription] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const effectiveHeadId = incomeHeadId || categories[0]?.id || ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedAmount = parseFloat(expectedAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Expected amount must be strictly greater than zero.")
      return
    }

    if (!effectiveHeadId) {
      setError("Please select an active income category.")
      return
    }

    if (title.trim().length < 2) {
      setError("Title must be at least 2 characters.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/incomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          incomeHeadId: effectiveHeadId,
          title: title.trim(),
          expectedAmount: parsedAmount,
          incomeDate: incomeDate || undefined,
          description: description.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to create income record")
      }

      toast.success("Direct income recorded successfully")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Coins className="size-4 text-primary" />
            Record Direct Income
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Record anticipated direct or non-invoice revenue (e.g. tour commissions, scrap disposal, rental fees).
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="category" className="text-xs">Category *</Label>
            <select
              id="category"
              value={effectiveHeadId}
              onChange={(e) => setIncomeHeadId(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs focus:ring-1 focus:ring-primary outline-hidden"
              required
            >
              {categories.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">Title / Description Header *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Tour Desk Referral Commission"
              className="h-9 text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs">Expected Amount ($) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={expectedAmount}
                onChange={(e) => setExpectedAmount(e.target.value)}
                placeholder="0.00"
                className="h-9 text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-xs">Income Date *</Label>
              <Input
                id="date"
                type="date"
                value={incomeDate}
                onChange={(e) => setIncomeDate(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc" className="text-xs">Detailed Notes (Optional)</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Reference agreement, vendor details, or receipt context"
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="text-xs gap-1.5">
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              Record Income
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// 2. Edit Income Dialog
// ----------------------------------------------------------------------------
export function EditIncomeDialog({
  isOpen,
  onClose,
  propertyId,
  income,
  categories,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  income: IncomeDTO
  categories: IncomeHeadDTO[]
  onSuccess: () => void
}) {
  const [title, setTitle] = React.useState(income.title)
  const [incomeHeadId, setIncomeHeadId] = React.useState(income.incomeHeadId)
  const [expectedAmount, setExpectedAmount] = React.useState(income.expectedAmount)
  const [incomeDate, setIncomeDate] = React.useState(income.incomeDate)
  const [description, setDescription] = React.useState(income.description || "")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const minAllowed = parseFloat(income.receivedAmount)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedAmount = parseFloat(expectedAmount)
    if (isNaN(parsedAmount) || parsedAmount < minAllowed) {
      setError(
        `Expected amount cannot be lower than the already collected amount ($${minAllowed.toFixed(2)}).`
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/incomes/${income.id}?propertyId=${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incomeHeadId,
          title: title.trim(),
          expectedAmount: parsedAmount,
          incomeDate,
          description: description.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update income record")
      }

      toast.success("Income record updated successfully")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Edit Income Record</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Modify expected amount, category, or title. Expected amount cannot be reduced below received collections.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="editCat" className="text-xs">Category *</Label>
            <select
              id="editCat"
              value={incomeHeadId}
              onChange={(e) => setIncomeHeadId(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs focus:ring-1 focus:ring-primary outline-hidden"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code}) {!c.isActive && "(Inactive)"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="editTitle" className="text-xs">Title *</Label>
            <Input
              id="editTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="editAmount" className="text-xs">
                Expected Amount ($) *
                {minAllowed > 0 && (
                  <span className="text-muted-foreground ml-1">
                    (Min: ${minAllowed.toFixed(2)})
                  </span>
                )}
              </Label>
              <Input
                id="editAmount"
                type="number"
                step="0.01"
                min={minAllowed > 0 ? minAllowed : 0.01}
                value={expectedAmount}
                onChange={(e) => setExpectedAmount(e.target.value)}
                className="h-9 text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editDate" className="text-xs">Income Date *</Label>
              <Input
                id="editDate"
                type="date"
                value={incomeDate}
                onChange={(e) => setIncomeDate(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="editDesc" className="text-xs">Detailed Notes</Label>
            <Input
              id="editDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="text-xs gap-1.5">
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// 3. Collect Receipt Dialog
// ----------------------------------------------------------------------------
export function CollectReceiptDialog({
  isOpen,
  onClose,
  propertyId,
  income,
  accounts,
  paymentMethods,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  income: IncomeDTO
  accounts: FinancialAccountWithBalanceDTO[]
  paymentMethods: PaymentMethodDTO[]
  onSuccess: () => void
}) {
  const activeMethods = React.useMemo(() => paymentMethods.filter((m) => m.isActive), [paymentMethods])
  const activeAccounts = React.useMemo(() => accounts.filter((a) => a.isActive), [accounts])

  const outstandingDec = parseFloat(income.outstandingAmount)

  const [amount, setAmount] = React.useState(outstandingDec > 0 ? outstandingDec.toFixed(2) : "0.00")
  const [selectedMethodId, setSelectedMethodId] = React.useState(activeMethods[0]?.id || "")
  const [selectedAccountId, setSelectedAccountId] = React.useState(
    activeMethods[0]?.defaultAccountId ||
      activeAccounts.find((a) => a.isDefault)?.id ||
      activeAccounts[0]?.id ||
      ""
  )
  const [paidAt, setPaidAt] = React.useState(new Date().toISOString().slice(0, 10))
  const [referenceNumber, setReferenceNumber] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const effectiveAccountId =
    selectedAccountId ||
    activeMethods.find((m) => m.id === selectedMethodId)?.defaultAccountId ||
    activeAccounts.find((a) => a.isDefault)?.id ||
    activeAccounts[0]?.id ||
    ""

  const handleMethodChange = (methodId: string) => {
    setSelectedMethodId(methodId)
    const method = activeMethods.find((m) => m.id === methodId)
    if (method?.defaultAccountId) {
      setSelectedAccountId(method.defaultAccountId)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Collection amount must be strictly greater than zero.")
      return
    }

    if (parsedAmount > outstandingDec) {
      setError(`Collection amount cannot exceed outstanding balance of $${outstandingDec.toFixed(2)}.`)
      return
    }

    if (!effectiveAccountId) {
      setError("Please select an active destination financial account.")
      return
    }

    const method = activeMethods.find((m) => m.id === selectedMethodId)
    if (!method) {
      setError("Please select a valid payment method.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/incomes/${income.id}/receipts?propertyId=${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          accountId: effectiveAccountId,
          paymentMethod: method.code,
          paymentMethodId: method.id,
          referenceNumber: referenceNumber.trim() || undefined,
          paidAt: paidAt || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to record collection receipt")
      }

      toast.success(`Receipt of $${parsedAmount.toFixed(2)} recorded successfully`)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record collection")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Receipt className="size-4 text-primary" />
            Collect Income Receipt
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Record a full or partial cash/bank payment against direct income.
          </DialogDescription>
        </DialogHeader>

        {/* Financial Summary Card */}
        <div className="p-3 rounded-xl bg-muted/40 border border-border/60 grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Expected</span>
            <div className="text-xs font-bold text-foreground">
              <MoneyText value={income.expectedAmount} />
            </div>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Received</span>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <MoneyText value={income.receivedAmount} />
            </div>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Outstanding</span>
            <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
              <MoneyText value={income.outstandingAmount} />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="collectAmount" className="text-xs">Collection Amount ($) *</Label>
            <div className="relative">
              <Input
                id="collectAmount"
                type="number"
                step="0.01"
                min="0.01"
                max={outstandingDec}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9 text-xs font-mono font-bold pr-16"
                required
              />
              <button
                type="button"
                onClick={() => setAmount(outstandingDec.toFixed(2))}
                className="absolute right-2 top-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
              >
                Full Pay
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payMethod" className="text-xs">Payment Method *</Label>
              <select
                id="payMethod"
                value={selectedMethodId}
                onChange={(e) => handleMethodChange(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
                required
              >
                {activeMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="destAccount" className="text-xs">Destination Account *</Label>
              <select
                id="destAccount"
                value={effectiveAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-xs focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
                required
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountName} ({a.accountType}) {a.isDefault && "★ Default"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="receiptDate" className="text-xs">Collection Date *</Label>
              <Input
                id="receiptDate"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="refNum" className="text-xs">Reference # / Check #</Label>
              <Input
                id="refNum"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. TXN-94821 or Cash"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="text-xs gap-1.5">
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              Record Collection
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// 4. Void Receipt Dialog
// ----------------------------------------------------------------------------
export function VoidReceiptDialog({
  isOpen,
  onClose,
  propertyId,
  incomeId,
  receipt,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  incomeId: string
  receipt: IncomeReceiptDTO
  onSuccess: () => void
}) {
  const [voidReason, setVoidReason] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (voidReason.trim().length < 3) {
      setError("Void reason must be at least 3 characters.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/incomes/${incomeId}/receipts/${receipt.id}/void?propertyId=${propertyId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voidReason: voidReason.trim() }),
        }
      )

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to void receipt")
      }

      toast.success("Receipt successfully voided; account balance reversed")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to void receipt")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
            <Ban className="size-4" />
            Void Collection Receipt
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Voiding receipt of <span className="font-bold text-foreground">${receipt.amount}</span> ({receipt.accountName}). This will automatically reverse the financial account ledger balance.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="voidReason" className="text-xs font-semibold">
              Mandatory Void Reason *
            </Label>
            <Input
              id="voidReason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Check bounced, duplicate entry, incorrect amount"
              className="h-9 text-xs"
              required
              autoFocus
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button type="submit" variant="destructive" size="sm" disabled={submitting} className="text-xs gap-1.5">
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              Confirm Void Receipt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// 5. Void Income Dialog
// ----------------------------------------------------------------------------
export function VoidIncomeDialog({
  isOpen,
  onClose,
  propertyId,
  income,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  income: IncomeDTO | IncomeDetailDTO
  onSuccess: () => void
}) {
  const [voidReason, setVoidReason] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const hasActiveCollections = parseFloat(income.receivedAmount) > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (hasActiveCollections) {
      setError(
        "Cannot void an income with active collections. Please void all individual receipts first to reverse account balances."
      )
      return
    }

    if (voidReason.trim().length < 3) {
      setError("Void reason must be at least 3 characters.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/incomes/${income.id}/void?propertyId=${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voidReason: voidReason.trim() }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to void income record")
      }

      toast.success("Income record successfully voided")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to void income")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
            <Ban className="size-4" />
            Void Direct Income Record
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Voiding &apos;{income.title}&apos;. Voided records are permanently archived and excluded from revenue totals.
          </DialogDescription>
        </DialogHeader>

        {hasActiveCollections && (
          <div className="p-3 bg-amber-500/10 text-amber-900 dark:text-amber-300 text-xs rounded-lg border border-amber-500/20 flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>
              This income record currently has active collections ($
              {income.receivedAmount}). In order to preserve transactional integrity, you must void all individual receipts first.
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="incomeVoidReason" className="text-xs font-semibold">
              Mandatory Void Reason *
            </Label>
            <Input
              id="incomeVoidReason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Agreement cancelled, client refunded, bad debt"
              className="h-9 text-xs"
              required
              disabled={hasActiveCollections}
              autoFocus={!hasActiveCollections}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={submitting || hasActiveCollections}
              className="text-xs gap-1.5"
            >
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              Confirm Void Income
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// 6. Income Details Dialog (History & Itemized Receipts)
// ----------------------------------------------------------------------------
export function IncomeDetailsDialog({
  isOpen,
  onClose,
  propertyId,
  incomeId,
  accounts,
  paymentMethods,
  onDataChange,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  incomeId: string
  accounts: FinancialAccountWithBalanceDTO[]
  paymentMethods: PaymentMethodDTO[]
  onDataChange: () => void
}) {
  const [detail, setDetail] = React.useState<IncomeDetailDTO | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Sub-dialogs
  const [isCollectOpen, setIsCollectOpen] = React.useState(false)
  const [voidingReceipt, setVoidingReceipt] = React.useState<IncomeReceiptDTO | null>(null)
  const [isVoidIncomeOpen, setIsVoidIncomeOpen] = React.useState(false)

  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    if (!isOpen) return
    let mounted = true

    async function loadDetail() {
      try {
        const res = await fetch(`/api/incomes/${incomeId}?propertyId=${propertyId}`)
        const data = await res.json()
        if (mounted) {
          if (res.ok) {
            setDetail(data.income)
            setError(null)
          } else {
            setError(data.error || "Failed to load income details")
          }
          setLoading(false)
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load details")
          setLoading(false)
        }
      }
    }

    loadDetail()

    return () => {
      mounted = false
    }
  }, [isOpen, incomeId, propertyId, reloadKey])

  const handleSubSuccess = () => {
    setReloadKey((k) => k + 1)
    onDataChange()
  }

  const activeReceipts = detail?.receipts.filter((r) => r.status === "RECORDED") || []
  const hasActiveReceipts = activeReceipts.length > 0
  const canCollect =
    detail &&
    detail.status !== "VOID" &&
    parseFloat(detail.outstandingAmount) > 0

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pr-8">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <Coins className="size-4 text-primary" />
                  {detail ? detail.title : "Income Record Details"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Direct income record, collection receipts, and audit trail.
                </DialogDescription>
              </div>
              {detail && (
                <div className="flex items-center gap-2">
                  <StatusBadge status={detail.status} size="sm" />
                </div>
              )}
            </div>
          </DialogHeader>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading || !detail ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-xs">Loading income details...</span>
            </div>
          ) : (
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Financial Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Category</span>
                  <div className="text-xs font-bold text-foreground truncate">{detail.incomeHeadName}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{detail.incomeHeadCode}</div>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Expected Amount</span>
                  <div className="text-xs font-bold text-foreground">
                    <MoneyText value={detail.expectedAmount} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">Date: {formatDate(detail.incomeDate)}</div>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Received</span>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <MoneyText value={detail.receivedAmount} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{activeReceipts.length} active collection(s)</div>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Outstanding</span>
                  <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    <MoneyText value={detail.outstandingAmount} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {parseFloat(detail.outstandingAmount) === 0 ? "Fully Collected" : "Balance Due"}
                  </div>
                </div>
              </div>

              {detail.description && (
                <div className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/40">
                  <span className="font-semibold text-foreground">Notes: </span>
                  {detail.description}
                </div>
              )}

              {/* Void Audit Box */}
              {detail.status === "VOID" && (
                <div className="p-3 bg-destructive/10 border border-destructive/25 rounded-xl text-xs text-destructive space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Ban className="size-3.5" />
                    Voided on {detail.voidedAt ? formatDate(detail.voidedAt) : "N/A"}{" "}
                    {detail.voidedByName && `by ${detail.voidedByName}`}
                  </div>
                  {detail.voidReason && (
                    <div className="text-[11px] text-destructive/90">
                      Reason: &apos;{detail.voidReason}&apos;
                    </div>
                  )}
                </div>
              )}

              {/* Chronological Receipts Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Receipt className="size-3.5" />
                    Collection History & Receipts ({detail.receipts.length})
                  </h4>

                  {canCollect && (
                    <Button
                      size="sm"
                      onClick={() => setIsCollectOpen(true)}
                      className="h-7 text-xs gap-1 cursor-pointer"
                    >
                      <Plus className="size-3" />
                      Collect Payment
                    </Button>
                  )}
                </div>

                {detail.receipts.length === 0 ? (
                  <div className="p-6 text-center border rounded-xl bg-card border-dashed text-xs text-muted-foreground">
                    No collection receipts recorded yet.
                  </div>
                ) : (
                  <div className="border rounded-xl bg-card overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs">Receipt Date</TableHead>
                          <TableHead className="text-xs">Method</TableHead>
                          <TableHead className="text-xs">Account</TableHead>
                          <TableHead className="text-xs">Reference</TableHead>
                          <TableHead className="text-xs">Collector</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs text-right w-[80px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.receipts.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs py-2">
                              {formatDate(r.paidAt)}
                            </TableCell>
                            <TableCell className="text-xs py-2 font-mono">
                              {r.paymentMethodCode}
                            </TableCell>
                            <TableCell className="text-xs py-2 font-medium">
                              {r.accountName}
                            </TableCell>
                            <TableCell className="text-xs py-2 text-muted-foreground font-mono">
                              {r.referenceNumber || "—"}
                            </TableCell>
                            <TableCell className="text-xs py-2 text-muted-foreground">
                              {r.createdByName || "Staff"}
                            </TableCell>
                            <TableCell className="text-xs py-2 text-right font-bold text-foreground">
                              <MoneyText value={r.amount} />
                            </TableCell>
                            <TableCell className="text-xs py-2">
                              {r.status === "RECORDED" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="size-3" /> Recorded
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-medium" title={r.voidReason || ""}>
                                  <Ban className="size-3" /> Voided
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs py-2 text-right">
                              {r.status === "RECORDED" && detail.status !== "VOID" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setVoidingReceipt(r)}
                                  className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10 cursor-pointer"
                                  title="Void this receipt"
                                >
                                  Void
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              {detail && detail.status !== "VOID" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsVoidIncomeOpen(true)}
                  className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30 cursor-pointer"
                  title={
                    hasActiveReceipts
                      ? "Cannot void income with active collections. Void receipts first."
                      : "Void this entire income record"
                  }
                  disabled={hasActiveReceipts}
                >
                  <Ban className="size-3.5 mr-1" />
                  Void Income
                </Button>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-Dialog: Collect Payment */}
      {isCollectOpen && detail && (
        <CollectReceiptDialog
          isOpen={isCollectOpen}
          onClose={() => setIsCollectOpen(false)}
          propertyId={propertyId}
          income={detail}
          accounts={accounts}
          paymentMethods={paymentMethods}
          onSuccess={handleSubSuccess}
        />
      )}

      {/* Sub-Dialog: Void Individual Receipt */}
      {voidingReceipt && detail && (
        <VoidReceiptDialog
          isOpen={Boolean(voidingReceipt)}
          onClose={() => setVoidingReceipt(null)}
          propertyId={propertyId}
          incomeId={detail.id}
          receipt={voidingReceipt}
          onSuccess={handleSubSuccess}
        />
      )}

      {/* Sub-Dialog: Void Income Record */}
      {isVoidIncomeOpen && detail && (
        <VoidIncomeDialog
          isOpen={isVoidIncomeOpen}
          onClose={() => setIsVoidIncomeOpen(false)}
          propertyId={propertyId}
          income={detail}
          onSuccess={() => {
            setIsVoidIncomeOpen(false)
            onClose()
            onDataChange()
          }}
        />
      )}
    </>
  )
}
