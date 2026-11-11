"use client"

import * as React from "react"
import { toast } from "sonner"
import { AccountType } from "@prisma/client"
import { Loader2, AlertCircle, FileText, ArrowDownLeft, ArrowUpRight } from "lucide-react"
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
import { MoneyText } from "@/components/ui-kit"
import { formatDate } from "@/lib/date-format"
import type {
  FinancialAccountWithBalanceDTO,
  AccountStatementDTO,
} from "@/modules/financial-accounts/financial-accounts.types"

// ----------------------------------------------------------------------------
// Create Account Dialog
// ----------------------------------------------------------------------------
export function CreateAccountDialog({
  isOpen,
  onClose,
  propertyId,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  onSuccess: () => void
}) {
  const [accountName, setAccountName] = React.useState("")
  const [accountType, setAccountType] = React.useState<AccountType>(AccountType.CASH)
  const [openingBalance, setOpeningBalance] = React.useState("0")
  const [openingBalanceDate, setOpeningBalanceDate] = React.useState(
    new Date().toISOString().slice(0, 10)
  )
  const [isDefault, setIsDefault] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!accountName.trim()) {
      setError("Account name is required.")
      return
    }

    const parsedBalance = parseFloat(openingBalance)
    if (isNaN(parsedBalance) || parsedBalance < 0) {
      setError("Opening balance must be a non-negative number.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/financial-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          accountName: accountName.trim(),
          accountType,
          openingBalance: parsedBalance,
          openingBalanceDate: openingBalanceDate || undefined,
          isDefault,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to create financial account")
      }

      toast.success("Financial account created successfully")
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
          <DialogTitle>New Financial Account</DialogTitle>
          <DialogDescription>
            Configure a physical cash drawer or institutional bank account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="accName" className="text-xs font-medium">Account Name *</Label>
            <Input
              id="accName"
              placeholder="e.g. Front Desk Cash Drawer, Main HDFC Operating"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accType" className="text-xs font-medium">Account Type *</Label>
            <select
              id="accType"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-xs outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/20"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
            >
              <option value={AccountType.CASH}>Cash (Physical Drawer / Safe Float)</option>
              <option value={AccountType.BANK}>Bank (Institutional Current / Savings)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="openingBal" className="text-xs font-medium">Opening Balance (₹)</Label>
              <Input
                id="openingBal"
                type="number"
                step="0.01"
                min="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="openingDate" className="text-xs font-medium">Baseline Date</Label>
              <Input
                id="openingDate"
                type="date"
                value={openingBalanceDate}
                onChange={(e) => setOpeningBalanceDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="size-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
            />
            <Label htmlFor="isDefault" className="text-xs cursor-pointer font-normal">
              Set as primary default operating account for this property
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
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// Edit Account Dialog
// ----------------------------------------------------------------------------
function EditAccountForm({
  account,
  onClose,
  propertyId,
  onSuccess,
}: {
  account: FinancialAccountWithBalanceDTO
  onClose: () => void
  propertyId: string
  onSuccess: () => void
}) {
  const [accountName, setAccountName] = React.useState(account.accountName)
  const [isDefault, setIsDefault] = React.useState(account.isDefault)
  const [isActive, setIsActive] = React.useState(account.isActive)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!accountName.trim()) {
      setError("Account name cannot be empty.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/financial-accounts/${account.id}?propertyId=${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountName: accountName.trim(),
          isDefault,
          isActive,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update financial account")
      }

      toast.success("Account updated successfully")
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
        <DialogTitle>Edit Financial Account</DialogTitle>
        <DialogDescription>
          Update account name, operating default, or lifecycle state.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive font-medium">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="editAccName" className="text-xs font-medium">Account Name *</Label>
          <Input
            id="editAccName"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="space-y-2 pt-1 border-t border-border/60">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editIsDefault"
              checked={isDefault}
              disabled={account.isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="size-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
            />
            <Label htmlFor="editIsDefault" className="text-xs cursor-pointer font-normal">
              Default operating account {account.isDefault ? "(Currently active default)" : ""}
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editIsActive"
              checked={isActive}
              disabled={account.isDefault && isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
            />
            <Label htmlFor="editIsActive" className="text-xs cursor-pointer font-normal">
              Account is Active {account.isDefault && isActive ? "(Cannot deactivate default account)" : ""}
            </Label>
          </div>
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

export function EditAccountDialog({
  account,
  isOpen,
  onClose,
  propertyId,
  onSuccess,
}: {
  account: FinancialAccountWithBalanceDTO | null
  isOpen: boolean
  onClose: () => void
  propertyId: string
  onSuccess: () => void
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {isOpen && account ? (
        <EditAccountForm
          key={account.id}
          account={account}
          onClose={onClose}
          propertyId={propertyId}
          onSuccess={onSuccess}
        />
      ) : null}
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// Account Statement Dialog
// ----------------------------------------------------------------------------
function AccountStatementContent({
  account,
  propertyId,
  onClose,
}: {
  account: FinancialAccountWithBalanceDTO
  propertyId: string
  onClose: () => void
}) {
  const [statement, setStatement] = React.useState<AccountStatementDTO | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [startDate, setStartDate] = React.useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
  })
  const [endDate, setEndDate] = React.useState(() => {
    return new Date().toISOString().slice(0, 10)
  })

  const [filterKey, setFilterKey] = React.useState(0)

  React.useEffect(() => {
    let mounted = true

    async function loadStatement() {
      try {
        const params = new URLSearchParams({
          propertyId,
          startDate,
          endDate,
          limit: "100",
        })

        const res = await fetch(
          `/api/financial-accounts/${account.id}/statement?${params.toString()}`
        )
        if (!res.ok) throw new Error("Failed to load account statement")
        const data = await res.json()
        if (mounted) {
          setStatement(data.statement)
          setError(null)
          setLoading(false)
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load statement")
          setLoading(false)
        }
      }
    }

    loadStatement()

    return () => {
      mounted = false
    }
  }, [account.id, propertyId, startDate, endDate, filterKey])

  return (
    <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
      <DialogHeader className="shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Account Statement — {account.accountName}
            </DialogTitle>
            <DialogDescription>
              Itemized running statement of receipts, payments, and inter-account transfers.
            </DialogDescription>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-muted-foreground block">Current Balance</span>
            <span className="text-lg font-mono font-bold text-foreground">
              <MoneyText value={account.currentBalance} />
            </span>
          </div>
        </div>
      </DialogHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 py-3 border-y border-border/60 text-xs shrink-0">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="stmtStart" className="text-xs font-medium text-muted-foreground">From:</Label>
          <Input
            id="stmtStart"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="stmtEnd" className="text-xs font-medium text-muted-foreground">To:</Label>
          <Input
            id="stmtEnd"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setLoading(true)
            setFilterKey((k) => k + 1)
          }}
          disabled={loading}
          className="h-8 text-xs font-medium"
        >
          {loading ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
          Filter Statement
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-2 space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-xs font-medium">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-xs">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span>Calculating running balance...</span>
          </div>
        ) : statement ? (
          <>
            {/* Balance Summary Header Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border/70 bg-card p-3">
                <span className="text-[11px] text-muted-foreground block">Opening on {formatDate(statement.startDate)}</span>
                <span className="text-sm font-mono font-bold text-foreground">
                  <MoneyText value={statement.openingBalanceOnStartDate} />
                </span>
              </div>
              <div className="rounded-lg border border-border/70 bg-card p-3">
                <span className="text-[11px] text-muted-foreground block">Period Inflows (+)</span>
                <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  <MoneyText
                    value={statement.items
                      .filter((i) => i.credit !== null)
                      .reduce((acc, curr) => acc + parseFloat(curr.credit || "0"), 0)}
                  />
                </span>
              </div>
              <div className="rounded-lg border border-border/70 bg-card p-3">
                <span className="text-[11px] text-muted-foreground block">Period Outflows (-)</span>
                <span className="text-sm font-mono font-bold text-rose-600 dark:text-rose-400">
                  <MoneyText
                    value={statement.items
                      .filter((i) => i.debit !== null)
                      .reduce((acc, curr) => acc + parseFloat(curr.debit || "0"), 0)}
                  />
                </span>
              </div>
              <div className="rounded-lg border border-border/70 bg-card p-3">
                <span className="text-[11px] text-muted-foreground block">Closing on {formatDate(statement.endDate)}</span>
                <span className="text-sm font-mono font-bold text-foreground">
                  <MoneyText value={statement.closingBalance} />
                </span>
              </div>
            </div>

            {/* Transactions Statement */}
            {statement.items.length === 0 ? (
              <div className="text-center py-12 border rounded-lg border-dashed border-border/80 text-muted-foreground text-xs">
                No recorded transactions found for this account within the selected dates.
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-32">Date</TableHead>
                      <TableHead>Description / Source</TableHead>
                      <TableHead className="w-28">Ref #</TableHead>
                      <TableHead className="text-right w-28">Inflow (+)</TableHead>
                      <TableHead className="text-right w-28">Outflow (-)</TableHead>
                      <TableHead className="text-right w-32 font-bold">Running Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.items.map((item) => {
                      const hasCredit = item.credit !== null
                      return (
                        <TableRow key={item.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                            {formatDate(item.date)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {hasCredit ? (
                                <ArrowDownLeft className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <ArrowUpRight className="size-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                              )}
                              <span className="font-medium text-foreground">{item.description}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground text-[11px]">
                            {item.referenceNumber || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {item.credit ? <MoneyText value={item.credit} /> : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-rose-600 dark:text-rose-400">
                            {item.debit ? <MoneyText value={item.debit} /> : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground">
                            <MoneyText value={item.runningBalance} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        ) : null}
      </div>

      <DialogFooter className="shrink-0 pt-2 border-t border-border/60">
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export function AccountStatementDialog({
  account,
  isOpen,
  onClose,
  propertyId,
}: {
  account: FinancialAccountWithBalanceDTO | null
  isOpen: boolean
  onClose: () => void
  propertyId: string
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {isOpen && account ? (
        <AccountStatementContent
          key={account.id}
          account={account}
          propertyId={propertyId}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  )
}
