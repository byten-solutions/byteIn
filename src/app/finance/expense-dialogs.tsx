"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, AlertCircle, Ban } from "lucide-react"
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
      setError("Please enter an amount greater than zero.")
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
        throw new Error(data.error || "Failed to record expense")
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Expense</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <Label className="text-xs">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Electricity bill, Laundry supplies"
              className="h-9 text-xs"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Category *</Label>
              <select
                value={effectiveHeadId}
                onChange={(e) => setExpenseHeadId(e.target.value)}
                className="w-full h-9 px-2 text-xs rounded-md border border-input bg-background font-medium outline-hidden cursor-pointer"
                required
              >
                {activeCategories.length === 0 ? (
                  <option value="">No active categories</option>
                ) : (
                  activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
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
                className="h-9 text-xs font-mono font-medium"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date *</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Reference #</Label>
              <Input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Invoice or bill #"
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Vendor (Optional)</Label>
            <Input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Vendor or supplier name"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes (Optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details"
              className="h-9 text-xs"
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
              size="sm"
              disabled={submitting || activeCategories.length === 0}
              className="text-xs cursor-pointer"
            >
              {submitting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
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
      setError("Please enter an amount greater than zero.")
      return
    }

    if (parsedAmount < paidAmountNum) {
      setError(`Amount cannot be less than already disbursed funds ($${paidAmountNum.toFixed(2)}).`)
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
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Edit Expense</DialogTitle>
      </DialogHeader>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div className="space-y-1">
          <Label className="text-xs">Title *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 text-xs"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Category *</Label>
            <select
              value={expenseHeadId}
              onChange={(e) => setExpenseHeadId(e.target.value)}
              className="w-full h-9 px-2 text-xs rounded-md border border-input bg-background font-medium outline-hidden cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Amount ($) *</Label>
              {paidAmountNum > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  Min: ${paidAmountNum.toFixed(2)}
                </span>
              )}
            </div>
            <Input
              type="number"
              step="0.01"
              min={paidAmountNum > 0 ? paidAmountNum : 0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 text-xs font-mono font-medium"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Date *</Label>
            <Input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Reference #</Label>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Invoice or bill #"
              className="h-9 text-xs font-mono"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Vendor (Optional)</Label>
          <Input
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="Vendor name"
            className="h-9 text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Notes (Optional)</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional details"
            className="h-9 text-xs"
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
          <Button type="submit" size="sm" disabled={submitting} className="text-xs cursor-pointer">
            {submitting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
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
// 3. Record Expense Payment Dialog
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

  const activeAccounts = React.useMemo(() => accounts.filter((a) => a.isActive), [accounts])
  const activeMethods = React.useMemo(() => paymentMethods.filter((m) => m.isActive), [paymentMethods])

  const defaultAccount =
    activeAccounts.find((a) => a.isDefault) ||
    activeAccounts[0]

  const [accountId, setAccountId] = React.useState(defaultAccount?.id || "")
  const [paymentMethodId, setPaymentMethodId] = React.useState(activeMethods[0]?.id || "")
  const [amount, setAmount] = React.useState(expense.outstandingAmount)
  const [referenceNumber, setReferenceNumber] = React.useState("")
  const [paidAt, setPaidAt] = React.useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [idempotencyKey] = React.useState(() => crypto.randomUUID())
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const selectedAccount = activeAccounts.find((a) => a.id === accountId)
  const availableBalance = selectedAccount
    ? parseFloat(selectedAccount.currentBalance || "0")
    : 0

  const handleMethodChange = (pmId: string) => {
    setPaymentMethodId(pmId)
    const pm = activeMethods.find((m) => m.id === pmId)
    if (pm && pm.defaultAccountId) {
      setAccountId(pm.defaultAccountId)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a payment amount greater than zero.")
      return
    }

    if (parsedAmount > outstandingNum) {
      setError(`Payment cannot exceed the outstanding balance of $${outstandingNum.toFixed(2)}.`)
      return
    }

    if (!accountId) {
      setError("Please select a financial account.")
      return
    }

    if (parsedAmount > availableBalance) {
      setError(
        `Insufficient funds in ${selectedAccount?.accountName}. Available: $${availableBalance.toFixed(2)}.`
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
        throw new Error(data.error || "Failed to record payment")
      }

      toast.success(`Payment of $${parsedAmount.toFixed(2)} recorded successfully`)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Disburse Payment</DialogTitle>
      </DialogHeader>

      {/* Clean Compact Summary */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border text-xs">
        <div>
          <span className="font-semibold text-foreground">{expense.title}</span>
          <span className="text-muted-foreground ml-2">Total: ${parseFloat(expense.amount).toFixed(2)}</span>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground mr-1.5">Due:</span>
          <span className="font-bold text-primary font-mono">${outstandingNum.toFixed(2)}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Amount ($) *</Label>
            <button
              type="button"
              onClick={() => setAmount(outstandingNum.toFixed(2))}
              className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
            >
              Pay Full (${outstandingNum.toFixed(2)})
            </button>
          </div>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            max={outstandingNum}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9 text-xs font-mono font-bold"
            required
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Financial Account *</Label>
            {selectedAccount && (
              <span className="text-[11px] text-muted-foreground font-mono">
                Available: ${availableBalance.toFixed(2)}
              </span>
            )}
          </div>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full h-9 px-2 text-xs rounded-md border border-input bg-background font-medium outline-hidden cursor-pointer"
            required
          >
            {activeAccounts.length === 0 ? (
              <option value="">No active accounts</option>
            ) : (
              activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountName} (${parseFloat(a.currentBalance || "0").toFixed(2)})
                </option>
              ))
            )}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Payment Method</Label>
            <select
              value={paymentMethodId}
              onChange={(e) => handleMethodChange(e.target.value)}
              className="w-full h-9 px-2 text-xs rounded-md border border-input bg-background font-medium outline-hidden cursor-pointer"
            >
              {activeMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Payment Date *</Label>
            <Input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Reference # (Optional)</Label>
          <Input
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="Cheque # or transaction ref"
            className="h-9 text-xs font-mono"
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
            size="sm"
            disabled={submitting || !accountId || outstandingNum <= 0}
            className="text-xs cursor-pointer"
          >
            {submitting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
            Confirm Payment
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
// 4. Expense Details Dialog (Clean, No-Overflow Layout)
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">
              {loading ? "Expense Details" : expense?.title}
            </DialogTitle>
            {expense && <StatusBadge status={expense.status} />}
          </div>
          {expense && (
            <DialogDescription className="text-xs text-muted-foreground">
              {expense.categoryName} • {expense.expenseDate ? formatDate(expense.expenseDate) : "—"}
            </DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="text-xs">Loading...</span>
          </div>
        ) : error || !expense ? (
          <div className="text-center py-8 text-xs text-destructive space-y-1">
            <AlertCircle className="size-5 mx-auto" />
            <p>{error || "Expense not found"}</p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* 3-Column Financial Summary Strip */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-muted/40 rounded-lg border border-border text-center">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Incurred</span>
                <div className="text-sm font-bold text-foreground">
                  ${parseFloat(expense.amount).toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Paid</span>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  ${parseFloat(expense.paidAmount).toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Balance</span>
                <div className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono">
                  ${outstandingNum.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Metadata Fields */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-card rounded-lg border border-border">
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Vendor</span>
                <p className="font-medium text-foreground mt-0.5">{expense.vendorName || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Reference #</span>
                <p className="font-mono font-medium text-foreground mt-0.5">{expense.referenceNumber || "—"}</p>
              </div>
              {expense.description && (
                <div className="col-span-2 pt-1 border-t border-border/50">
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">Notes</span>
                  <p className="text-foreground mt-0.5">{expense.description}</p>
                </div>
              )}
            </div>

            {/* Void Record Banner */}
            {expense.status === "VOID" && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                <span className="font-semibold">Voided: </span>
                {expense.voidReason || "No reason specified"}
              </div>
            )}

            {/* Payments List (No horizontal overflow) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs">
                  Payments ({expense.payments.length})
                </span>
                {canDisburse && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRecordPayment(expense)}
                    className="h-6 text-xs text-primary hover:underline p-0 cursor-pointer"
                  >
                    + Disburse Payment
                  </Button>
                )}
              </div>

              {expense.payments.length === 0 ? (
                <p className="text-muted-foreground text-xs py-2 text-center border border-dashed rounded-lg">
                  No payments recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-border border rounded-lg bg-card overflow-hidden">
                  {expense.payments.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{p.accountName}</span>
                          <span className="text-muted-foreground text-[11px] font-mono">
                            {p.paymentMethodCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatDate(p.paidAt)}
                          {p.referenceNumber && ` • Ref: ${p.referenceNumber}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono font-bold text-foreground">
                            ${parseFloat(p.amount).toFixed(2)}
                          </div>
                          <StatusBadge status={p.status} />
                        </div>

                        {p.status === "RECORDED" && expense.status !== "VOID" && (
                          <button
                            type="button"
                            onClick={() => onVoidPayment(p)}
                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            title="Void this payment"
                          >
                            <Ban className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="pt-2 flex items-center justify-between">
          <div>
            {canVoid && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onVoidExpense(expense!)}
                className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 cursor-pointer"
              >
                Void Expense
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs cursor-pointer">
              Close
            </Button>
            {canDisburse && (
              <Button
                size="sm"
                onClick={() => onRecordPayment(expense!)}
                className="h-8 text-xs cursor-pointer"
              >
                Disburse Payment
              </Button>
            )}
          </div>
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
        throw new Error(data.error || "Failed to void payment")
      }

      toast.success("Payment voided and balance restored")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Void Payment</DialogTitle>
      </DialogHeader>

      <div className="p-3 bg-muted/50 rounded-lg border border-border text-xs flex justify-between items-center">
        <span>{payment.accountName}</span>
        <span className="font-mono font-bold text-destructive">
          -${parseFloat(payment.amount).toFixed(2)}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleVoid} className="space-y-3.5 text-xs">
        <div className="space-y-1">
          <Label className="text-xs">Reason for voiding *</Label>
          <Input
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g. Paid from wrong account, duplicate"
            className="h-9 text-xs"
            required
            autoFocus
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
            {submitting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
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
// 6. Void Expense Dialog
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
      setError("Cannot void expense with active payments. Please void each payment first.")
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
        throw new Error(data.error || "Failed to void expense")
      }

      toast.success("Expense marked as void")
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Void Expense</DialogTitle>
      </DialogHeader>

      <div className="p-3 bg-muted/50 rounded-lg border border-border text-xs flex justify-between items-center">
        <span>{expense.title}</span>
        <span className="font-mono font-bold">${parseFloat(expense.amount).toFixed(2)}</span>
      </div>

      {hasActivePayments && (
        <div className="p-2.5 bg-amber-500/10 text-amber-900 dark:text-amber-300 rounded-lg border border-amber-500/30 text-xs">
          This expense has active payments (${paidAmountNum.toFixed(2)}). You must void each payment first to return the funds to accounts.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleVoid} className="space-y-3.5 text-xs">
        <div className="space-y-1">
          <Label className="text-xs">Reason for voiding *</Label>
          <Input
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g. Incurred in error, cancelled"
            className="h-9 text-xs"
            disabled={hasActivePayments}
            required
            autoFocus={!hasActivePayments}
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
            {submitting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
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
