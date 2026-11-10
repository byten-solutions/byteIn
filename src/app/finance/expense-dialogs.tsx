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
  AlertTriangle,
  Wallet,
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
import { StatusBadge } from "@/components/ui-kit"
import { formatDate } from "@/lib/date-format"
import type {
  ExpenseDTO,
  ExpenseDetailDTO,
  ExpenseHeadDTO,
  ExpensePaymentDTO,
} from "@/modules/expenses/expenses.types"
import type { FinancialAccountWithBalanceDTO } from "@/modules/financial-accounts/financial-accounts.types"
import type { PaymentMethodDTO } from "@/modules/payment-methods/payment-methods.types"

// ----------------------------------------------------------------------------
// 1. Create Expense Dialog
// ----------------------------------------------------------------------------
export function CreateExpenseDialog({
  isOpen,
  onClose,
  propertyId,
  categories,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  categories: ExpenseHeadDTO[]
  onSuccess: () => void
}) {
  const [title, setTitle] = React.useState("")
  const [expenseHeadId, setExpenseHeadId] = React.useState(categories[0]?.id || "")
  const [amount, setAmount] = React.useState("")
  const [expenseDate, setExpenseDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [vendorName, setVendorName] = React.useState("")
  const [referenceNumber, setReferenceNumber] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const activeCategories = React.useMemo(
    () => categories.filter((c) => c.isActive),
    [categories]
  )

  const effectiveHeadId = expenseHeadId || activeCategories[0]?.id || ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Expense amount must be strictly greater than zero.")
      return
    }

    if (!effectiveHeadId) {
      setError("Please select an active expense category.")
      return
    }

    if (title.trim().length < 2) {
      setError("Title must be at least 2 characters.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          expenseHeadId: effectiveHeadId,
          title: title.trim(),
          amount: parsedAmount,
          expenseDate: expenseDate || undefined,
          vendorName: vendorName.trim() || undefined,
          referenceNumber: referenceNumber.trim() || undefined,
          description: description.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to create expense record")
      }

      toast.success("Expense recorded successfully")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Plus className="size-4" />
              </div>
              <div>
                <DialogTitle>Record New Expense</DialogTitle>
                <DialogDescription className="text-xs">
                  Incur an operational, maintenance, or vendor expense for this property.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Title / Short Description *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. October Electricity Bill or Fresh Linens Batch"
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category *</Label>
                <select
                  value={effectiveHeadId}
                  onChange={(e) => setExpenseHeadId(e.target.value)}
                  className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium outline-hidden focus:ring-1 focus:ring-ring cursor-pointer"
                  required
                >
                  {activeCategories.length === 0 ? (
                    <option value="">No active categories</option>
                  ) : (
                    activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Amount ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs font-mono font-medium"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Vendor / Supplier Name</Label>
                <Input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Acme Supplies Ltd"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Invoice / Reference #</Label>
                <Input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-089"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Expense Date</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes / Details (Optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional notes or procurement details"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || activeCategories.length === 0}
              className="text-xs cursor-pointer"
            >
              {submitting && <Loader2 className="size-3 animate-spin mr-1.5" />}
              Save Expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// 2. Edit Expense Dialog
// ----------------------------------------------------------------------------
function EditExpenseDialogInner({
  onClose,
  propertyId,
  expense,
  categories,
  onSuccess,
}: {
  onClose: () => void
  propertyId: string
  expense: ExpenseDTO
  categories: ExpenseHeadDTO[]
  onSuccess: () => void
}) {
  const [title, setTitle] = React.useState(expense.title)
  const [expenseHeadId, setExpenseHeadId] = React.useState(expense.expenseHeadId)
  const [amount, setAmount] = React.useState(expense.amount)
  const [expenseDate, setExpenseDate] = React.useState(
    expense.expenseDate ? expense.expenseDate.slice(0, 10) : ""
  )
  const [vendorName, setVendorName] = React.useState(expense.vendorName || "")
  const [referenceNumber, setReferenceNumber] = React.useState(expense.referenceNumber || "")
  const [description, setDescription] = React.useState(expense.description || "")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const paidAmountNum = parseFloat(expense.paidAmount || "0")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Expense amount must be strictly greater than zero.")
      return
    }

    if (parsedAmount < paidAmountNum) {
      setError(
        `Expense amount cannot be reduced below the amount already paid ($${paidAmountNum.toFixed(2)}).`
      )
      return
    }

    if (title.trim().length < 2) {
      setError("Title must be at least 2 characters.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/expenses/${expense.id}?propertyId=${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          expenseHeadId,
          title: title.trim(),
          amount: parsedAmount,
          expenseDate: expenseDate || undefined,
          vendorName: vendorName.trim() || null,
          referenceNumber: referenceNumber.trim() || null,
          description: description.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update expense")
      }

      toast.success("Expense updated successfully")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogDescription className="text-xs">
            Update expense details. Amount cannot be less than already disbursed funds.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {paidAmountNum > 0 && (
          <div className="text-xs bg-amber-500/10 text-amber-900 dark:text-amber-200 p-2.5 rounded-lg border border-amber-500/20 flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            <span>
              <strong>${paidAmountNum.toFixed(2)}</strong> has already been disbursed against this expense. The amount cannot be reduced below this figure.
            </span>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <select
                value={expenseHeadId}
                onChange={(e) => setExpenseHeadId(e.target.value)}
                className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium outline-hidden cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Total Amount ($) *</Label>
              <Input
                type="number"
                step="0.01"
                min={paidAmountNum > 0 ? paidAmountNum : 0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-8 text-xs font-mono font-medium"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Vendor Name</Label>
              <Input
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Reference Number</Label>
              <Input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Expense Date</Label>
            <Input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="h-8 text-xs"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting} className="text-xs cursor-pointer">
            {submitting && <Loader2 className="size-3 animate-spin mr-1.5" />}
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export function EditExpenseDialog({
  isOpen,
  onClose,
  propertyId,
  expense,
  categories,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  expense: ExpenseDTO | null
  categories: ExpenseHeadDTO[]
  onSuccess: () => void
}) {
  if (!isOpen || !expense) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <EditExpenseDialogInner
        onClose={onClose}
        propertyId={propertyId}
        expense={expense}
        categories={categories}
        onSuccess={onSuccess}
      />
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// 3. Record Expense Payment Dialog (with Idempotency Key & Liquidity Guards)
// ----------------------------------------------------------------------------
function RecordExpensePaymentDialogInner({
  onClose,
  propertyId,
  expense,
  accounts,
  paymentMethods,
  onSuccess,
}: {
  onClose: () => void
  propertyId: string
  expense: ExpenseDTO
  accounts: FinancialAccountWithBalanceDTO[]
  paymentMethods: PaymentMethodDTO[]
  onSuccess: () => void
}) {
  const outstandingNum = parseFloat(expense.outstandingAmount || "0")

  const defaultAccount =
    accounts.find((a) => a.isDefault && a.isActive) ||
    accounts.find((a) => a.isActive)

  const [accountId, setAccountId] = React.useState(defaultAccount?.id || "")
  const [paymentMethodId, setPaymentMethodId] = React.useState(paymentMethods[0]?.id || "")
  const [amount, setAmount] = React.useState(expense.outstandingAmount)
  const [referenceNumber, setReferenceNumber] = React.useState("")
  const [paidAt, setPaidAt] = React.useState(() =>
    new Date().toISOString().slice(0, 16)
  )
  const [idempotencyKey] = React.useState(() => crypto.randomUUID())
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const selectedAccount = accounts.find((a) => a.id === accountId)
  const availableBalance = selectedAccount
    ? parseFloat(selectedAccount.currentBalance || "0")
    : 0

  const handleMethodChange = (pmId: string) => {
    setPaymentMethodId(pmId)
    const pm = paymentMethods.find((m) => m.id === pmId)
    if (pm && pm.defaultAccountId) {
      setAccountId(pm.defaultAccountId)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Payment disbursement amount must be strictly greater than zero.")
      return
    }

    if (parsedAmount > outstandingNum) {
      setError(
        `Disbursement amount ($${parsedAmount.toFixed(2)}) cannot exceed the outstanding balance ($${outstandingNum.toFixed(2)}).`
      )
      return
    }

    if (!accountId) {
      setError("Please select a financial account to disburse funds from.")
      return
    }

    if (parsedAmount > availableBalance) {
      setError(
        `Insufficient liquid funds in ${selectedAccount?.accountName}. Available: $${availableBalance.toFixed(2)}, Requested: $${parsedAmount.toFixed(2)}.`
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/expenses/${expense.id}/payments?propertyId=${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          accountId,
          paymentMethodId: paymentMethodId || undefined,
          amount: parsedAmount,
          referenceNumber: referenceNumber.trim() || undefined,
          idempotencyKey,
          paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to record payment disbursement")
      }

      if (data.idempotentReplay) {
        toast.info("Payment was already recorded (idempotent replay)")
      } else {
        toast.success(`Disbursed $${parsedAmount.toFixed(2)} successfully`)
      }

      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Wallet className="size-4" />
            </div>
            <div>
              <DialogTitle>Disburse Expense Payment</DialogTitle>
              <DialogDescription className="text-xs">
                Pay vendor from an active hotel financial account.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Expense Snapshot Banner */}
        <div className="p-3 bg-muted/60 rounded-xl border border-border/80 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-foreground truncate max-w-[240px]">
              {expense.title}
            </span>
            <StatusBadge status={expense.status} />
          </div>
          <div className="flex justify-between items-center text-muted-foreground pt-1 border-t border-border/50">
            <span>Total: ${parseFloat(expense.amount).toFixed(2)}</span>
            <span>Paid: ${parseFloat(expense.paidAmount).toFixed(2)}</span>
            <span className="font-semibold text-primary">
              Outstanding: ${outstandingNum.toFixed(2)}
            </span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          {/* Account Selection */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label className="text-xs">From Financial Account *</Label>
              {selectedAccount && (
                <span
                  className={`text-[11px] font-semibold ${
                    availableBalance <= 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  Balance: ${availableBalance.toFixed(2)}
                </span>
              )}
            </div>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium outline-hidden cursor-pointer"
              required
            >
              <option value="">Select Account</option>
              {accounts
                .filter((a) => a.isActive)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountName} ({a.accountType}) — ${parseFloat(a.currentBalance || "0").toFixed(2)}
                  </option>
                ))}
            </select>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-1">
            <Label className="text-xs">Payment Method</Label>
            <select
              value={paymentMethodId}
              onChange={(e) => handleMethodChange(e.target.value)}
              className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium outline-hidden cursor-pointer"
            >
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code})
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Disbursement Amount ($) *</Label>
              <button
                type="button"
                onClick={() => setAmount(outstandingNum.toFixed(2))}
                className="text-[10px] text-primary hover:underline cursor-pointer font-medium"
              >
                Pay Full Balance (${outstandingNum.toFixed(2)})
              </button>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={outstandingNum}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 text-xs font-mono font-semibold"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Reference / Cheque #</Label>
              <Input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. CHQ-9901 or TXN-882"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Disbursement Date</Label>
              <Input
                type="datetime-local"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={submitting || !accountId || outstandingNum <= 0}
            className="text-xs cursor-pointer"
          >
            {submitting && <Loader2 className="size-3 animate-spin mr-1.5" />}
            Confirm Disbursement
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export function RecordExpensePaymentDialog({
  isOpen,
  onClose,
  propertyId,
  expense,
  accounts,
  paymentMethods,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  expense: ExpenseDTO | null
  accounts: FinancialAccountWithBalanceDTO[]
  paymentMethods: PaymentMethodDTO[]
  onSuccess: () => void
}) {
  if (!isOpen || !expense) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <RecordExpensePaymentDialogInner
        onClose={onClose}
        propertyId={propertyId}
        expense={expense}
        accounts={accounts}
        paymentMethods={paymentMethods}
        onSuccess={onSuccess}
      />
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// 4. Expense Details Dialog (with full payments itemization & actions)
// ----------------------------------------------------------------------------
export function ExpenseDetailsDialog({
  isOpen,
  onClose,
  propertyId,
  expenseId,
  onRecordPayment,
  onVoidExpense,
  onVoidPayment,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  expenseId: string | null
  onRecordPayment: (expense: ExpenseDTO) => void
  onVoidExpense: (expense: ExpenseDTO) => void
  onVoidPayment: (payment: ExpensePaymentDTO) => void
}) {
  const [expense, setExpense] = React.useState<ExpenseDetailDTO | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isOpen || !expenseId || !propertyId) return
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/expenses/${expenseId}?propertyId=${propertyId}`)
        const data = await res.json()
        if (mounted) {
          if (res.ok) {
            setExpense(data.expense)
            setError(null)
          } else {
            setError(data.error || "Failed to load expense details")
          }
          setLoading(false)
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load expense details")
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [isOpen, expenseId, propertyId])

  if (!isOpen) return null

  const outstandingNum = expense ? parseFloat(expense.outstandingAmount || "0") : 0
  const canDisburse = expense && expense.status !== "VOID" && outstandingNum > 0
  const canVoid = expense && expense.status !== "VOID"

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold">
                  {loading ? "Expense Details" : expense?.title}
                </DialogTitle>
                {expense && <StatusBadge status={expense.status} />}
              </div>
              <DialogDescription className="text-xs">
                {expense?.categoryName} ({expense?.categoryCode}) • Incurred on{" "}
                {expense?.expenseDate ? formatDate(expense.expenseDate) : "—"}
              </DialogDescription>
            </div>

            {expense && (
              <div className="flex items-center gap-2">
                {canDisburse && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onRecordPayment(expense)
                    }}
                    className="h-8 text-xs cursor-pointer"
                  >
                    <Coins className="size-3.5 mr-1.5" />
                    Disburse
                  </Button>
                )}
                {canVoid && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onVoidExpense(expense)
                    }}
                    className="h-8 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                  >
                    <Ban className="size-3.5 mr-1.5" />
                    Void
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-xs">Loading expense details...</span>
            </div>
          ) : error || !expense ? (
            <div className="text-center py-8 text-xs text-destructive space-y-1">
              <AlertCircle className="size-5 mx-auto" />
              <p>{error || "Expense not found"}</p>
            </div>
          ) : (
            <>
              {/* Financial Summary KPI Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-card border rounded-xl space-y-0.5">
                  <span className="text-[11px] text-muted-foreground font-medium">Incurred Amount</span>
                  <div className="text-sm font-bold text-foreground">
                    ${parseFloat(expense.amount).toFixed(2)}
                  </div>
                </div>
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-0.5">
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">Paid (Disbursed)</span>
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    ${parseFloat(expense.paidAmount).toFixed(2)}
                  </div>
                </div>
                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-0.5">
                  <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">Outstanding Balance</span>
                  <div className="text-sm font-bold text-amber-700 dark:text-amber-400">
                    ${outstandingNum.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Expense Metadata Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-muted/30 p-4 rounded-xl border border-border/80">
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">Vendor / Supplier</span>
                  <p className="font-medium text-foreground mt-0.5">{expense.vendorName || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">Invoice / Reference #</span>
                  <p className="font-mono font-medium text-foreground mt-0.5">{expense.referenceNumber || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">Recorded By</span>
                  <p className="font-medium text-foreground mt-0.5">{expense.creatorName || "Staff Member"}</p>
                </div>
                {expense.description && (
                  <div className="col-span-full pt-1 border-t border-border/40">
                    <span className="text-muted-foreground text-[10px] uppercase font-semibold">Description / Notes</span>
                    <p className="text-foreground mt-0.5">{expense.description}</p>
                  </div>
                )}
                {expense.status === "VOID" && (
                  <div className="col-span-full pt-2 border-t border-destructive/20 text-destructive bg-destructive/10 p-3 rounded-lg">
                    <span className="text-[10px] uppercase font-semibold">Voided Record</span>
                    <p className="text-xs font-medium mt-0.5">
                      <strong>Reason:</strong> {expense.voidReason || "Unspecified"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Voided at {expense.voidedAt ? formatDate(expense.voidedAt) : "—"}
                    </p>
                  </div>
                )}
              </div>

              {/* Disbursements History Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Receipt className="size-3.5 text-primary" />
                    Outgoing Payment History ({expense.payments.length})
                  </h4>
                  {outstandingNum === 0 && expense.status === "PAID" && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Fully Settled
                    </span>
                  )}
                </div>

                {expense.payments.length === 0 ? (
                  <div className="text-center py-6 border border-dashed rounded-xl bg-card text-xs text-muted-foreground space-y-1">
                    <p>No outgoing payments disbursed yet.</p>
                    {canDisburse && (
                      <button
                        type="button"
                        onClick={() => onRecordPayment(expense)}
                        className="text-primary hover:underline font-semibold cursor-pointer"
                      >
                        Click here to record a payment
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs font-semibold">Date</TableHead>
                          <TableHead className="text-xs font-semibold">Account</TableHead>
                          <TableHead className="text-xs font-semibold">Method</TableHead>
                          <TableHead className="text-xs font-semibold">Ref #</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Amount</TableHead>
                          <TableHead className="text-xs font-semibold text-center w-20">Status</TableHead>
                          <TableHead className="text-xs font-semibold text-right w-16">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expense.payments.map((p) => (
                          <TableRow key={p.id} className="text-xs hover:bg-muted/40 transition-colors">
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {formatDate(p.paidAt)}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {p.accountName}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-muted-foreground">
                              {p.paymentMethodCode}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-muted-foreground">
                              {p.referenceNumber || "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              ${parseFloat(p.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              <StatusBadge status={p.status} />
                            </TableCell>
                            <TableCell className="text-right">
                              {p.status === "RECORDED" && expense.status !== "VOID" ? (
                                <button
                                  type="button"
                                  onClick={() => onVoidPayment(p)}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                  title="Void payment & reverse account balance"
                                >
                                  <Ban className="size-3.5" />
                                </button>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs cursor-pointer">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// 5. Void Expense Payment Dialog
// ----------------------------------------------------------------------------
function VoidExpensePaymentDialogInner({
  onClose,
  propertyId,
  expenseId,
  payment,
  onSuccess,
}: {
  onClose: () => void
  propertyId: string
  expenseId: string
  payment: ExpensePaymentDTO
  onSuccess: () => void
}) {
  const [voidReason, setVoidReason] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (voidReason.trim().length < 3) {
      setError("Please provide a void reason of at least 3 characters.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/expenses/${expenseId}/payments/${payment.id}/void?propertyId=${propertyId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId,
            voidReason: voidReason.trim(),
          }),
        }
      )

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to void payment disbursement")
      }

      toast.success(
        `Disbursement of $${parseFloat(payment.amount).toFixed(2)} voided. Balance restored to ${payment.accountName}.`
      )
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent className="max-w-md">
      <form onSubmit={handleVoid} className="space-y-4">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
              <Ban className="size-4" />
            </div>
            <div>
              <DialogTitle>Void Outgoing Payment</DialogTitle>
              <DialogDescription className="text-xs">
                Reverses the disbursement and restores money to the financial account.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-3 bg-muted/60 rounded-xl border border-border/80 space-y-1 text-xs">
          <div className="flex justify-between font-semibold">
            <span>Account: {payment.accountName}</span>
            <span className="font-mono text-destructive">
              -${parseFloat(payment.amount).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground text-[11px]">
            <span>Disbursed on: {formatDate(payment.paidAt)}</span>
            <span>Ref: {payment.referenceNumber || "—"}</span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Reason for Voiding *</Label>
          <Input
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g. Paid from wrong bank account, duplicate disbursement"
            className="h-8 text-xs"
            required
          />
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            disabled={submitting}
            className="text-xs cursor-pointer"
          >
            {submitting && <Loader2 className="size-3 animate-spin mr-1.5" />}
            Confirm Void
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export function VoidExpensePaymentDialog({
  isOpen,
  onClose,
  propertyId,
  expenseId,
  payment,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  expenseId: string
  payment: ExpensePaymentDTO | null
  onSuccess: () => void
}) {
  if (!isOpen || !payment) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <VoidExpensePaymentDialogInner
        onClose={onClose}
        propertyId={propertyId}
        expenseId={expenseId}
        payment={payment}
        onSuccess={onSuccess}
      />
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// 6. Void Expense Dialog (with Two-Stage Active Payments Guard)
// ----------------------------------------------------------------------------
function VoidExpenseDialogInner({
  onClose,
  propertyId,
  expense,
  onSuccess,
}: {
  onClose: () => void
  propertyId: string
  expense: ExpenseDTO
  onSuccess: () => void
}) {
  const [voidReason, setVoidReason] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const paidAmountNum = parseFloat(expense.paidAmount || "0")
  const hasActivePayments = paidAmountNum > 0

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (hasActivePayments) {
      setError(
        "Cannot void expense with active payments. Please void each outgoing payment individually first to reverse the account balance."
      )
      return
    }

    if (voidReason.trim().length < 3) {
      setError("Please provide a void reason of at least 3 characters.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/expenses/${expense.id}/void?propertyId=${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          voidReason: voidReason.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to void expense record")
      }

      toast.success("Expense record marked as void")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent className="max-w-md">
      <form onSubmit={handleVoid} className="space-y-4">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
              <Ban className="size-4" />
            </div>
            <div>
              <DialogTitle>Void Expense Record</DialogTitle>
              <DialogDescription className="text-xs">
                Cancel this expense. Voided expenses do not contribute to property financials.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Snapshot Info */}
        <div className="p-3 bg-muted/60 rounded-xl border border-border/80 space-y-1 text-xs">
          <div className="flex justify-between font-semibold">
            <span>{expense.title}</span>
            <span className="font-mono">${parseFloat(expense.amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground text-[11px]">
            <span>Category: {expense.categoryName}</span>
            <span>Paid: ${paidAmountNum.toFixed(2)}</span>
          </div>
        </div>

        {hasActivePayments && (
          <div className="p-3 bg-amber-500/10 text-amber-900 dark:text-amber-200 rounded-lg border border-amber-500/30 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Controlled Two-Stage Voiding Guard</span>
            </div>
            <p>
              This expense has active disbursements totaling <strong>${paidAmountNum.toFixed(2)}</strong>. You must void each individual outgoing payment first to return the funds to the respective financial accounts before voiding this expense.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Void Reason *</Label>
          <Input
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g. Vendor contract canceled, billing error"
            className="h-8 text-xs"
            disabled={hasActivePayments}
            required
          />
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            disabled={submitting || hasActivePayments}
            className="text-xs cursor-pointer"
          >
            {submitting && <Loader2 className="size-3 animate-spin mr-1.5" />}
            Confirm Void
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export function VoidExpenseDialog({
  isOpen,
  onClose,
  propertyId,
  expense,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  expense: ExpenseDTO | null
  onSuccess: () => void
}) {
  if (!isOpen || !expense) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <VoidExpenseDialogInner
        onClose={onClose}
        propertyId={propertyId}
        expense={expense}
        onSuccess={onSuccess}
      />
    </Dialog>
  )
}
