"use client"

import * as React from "react"
import { toast } from "sonner"
import type { PaymentReceiptDTO, InvoiceDetailDTO } from "@/modules/billing/billing.types"
import { Check, Loader2, AlertCircle } from "lucide-react"
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
import { cn } from "@/lib/utils"

interface RecordPaymentDialogProps {
  invoice: InvoiceDetailDTO
  isOpen: boolean
  onClose: () => void
  onPaymentSuccess: (invoice: InvoiceDetailDTO, receipt: PaymentReceiptDTO) => void
}

interface PaymentMethodOption {
  id: string
  name: string
  code: string
  defaultAccountId: string | null
  isActive: boolean
}

interface FinancialAccountOption {
  id: string
  accountName: string
  accountType: string
  isDefault: boolean
  isActive: boolean
  currentBalance?: string
}

const FALLBACK_PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: "", name: "Cash", code: "CASH", defaultAccountId: null, isActive: true },
  { id: "", name: "Credit / Debit Card", code: "CARD", defaultAccountId: null, isActive: true },
  { id: "", name: "Bank Transfer", code: "BANK_TRANSFER", defaultAccountId: null, isActive: true },
  { id: "", name: "UPI", code: "UPI", defaultAccountId: null, isActive: true },
  { id: "", name: "Other", code: "OTHER", defaultAccountId: null, isActive: true },
]

function RecordPaymentForm({
  invoice,
  onClose,
  onPaymentSuccess,
}: {
  invoice: InvoiceDetailDTO
  onClose: () => void
  onPaymentSuccess: (invoice: InvoiceDetailDTO, receipt: PaymentReceiptDTO) => void
}) {
  const [amount, setAmount] = React.useState(invoice.balanceDue)
  const [referenceNumber, setReferenceNumber] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [loadingConfig, setLoadingConfig] = React.useState(true)
  const [configError, setConfigError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethodOption[]>([])
  const [financialAccounts, setFinancialAccounts] = React.useState<FinancialAccountOption[]>([])
  const [selectedMethodCode, setSelectedMethodCode] = React.useState("CASH")
  const [selectedMethodId, setSelectedMethodId] = React.useState<string | null>(null)
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>("")

  // Fetch active payment methods & accounts on mount
  React.useEffect(() => {
    let isMounted = true

    async function loadConfig() {
      try {
        const [methodsRes, accountsRes] = await Promise.all([
          fetch(`/api/payment-methods?propertyId=${invoice.propertyId}&isActive=true`),
          fetch(`/api/financial-accounts?propertyId=${invoice.propertyId}&isActive=true`),
        ])

        const methodsData = await methodsRes.json().catch(() => ({}))
        const accountsData = await accountsRes.json().catch(() => ({}))

        if (!isMounted) return

        let methods: PaymentMethodOption[] = []
        if (methodsRes.ok && Array.isArray(methodsData.paymentMethods)) {
          methods = methodsData.paymentMethods
        }

        let accounts: FinancialAccountOption[] = []
        if (accountsRes.ok && Array.isArray(accountsData.accounts)) {
          accounts = accountsData.accounts
        }

        if (methods.length === 0) {
          methods = FALLBACK_PAYMENT_METHODS
        }

        setPaymentMethods(methods)
        setFinancialAccounts(accounts)

        // Initial selection: prefer CASH or first active method
        const initialMethod =
          methods.find((m) => m.code === "CASH") || methods[0] || null

        if (initialMethod) {
          setSelectedMethodCode(initialMethod.code)
          setSelectedMethodId(initialMethod.id || null)

          // Auto-select suggested account
          if (
            initialMethod.defaultAccountId &&
            accounts.some((a) => a.id === initialMethod.defaultAccountId)
          ) {
            setSelectedAccountId(initialMethod.defaultAccountId)
          } else {
            const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0]
            if (defaultAcc) {
              setSelectedAccountId(defaultAcc.id)
            }
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to load payment configuration"
        setConfigError(msg)
        setPaymentMethods(FALLBACK_PAYMENT_METHODS)
      } finally {
        if (isMounted) {
          setLoadingConfig(false)
        }
      }
    }

    loadConfig()

    return () => {
      isMounted = false
    }
  }, [invoice.propertyId])

  // Handle switching payment method
  const handleSelectMethod = (m: PaymentMethodOption) => {
    setSelectedMethodCode(m.code)
    setSelectedMethodId(m.id || null)

    // Suggest defaultAccountId when available for this method
    if (
      m.defaultAccountId &&
      financialAccounts.some((a) => a.id === m.defaultAccountId)
    ) {
      setSelectedAccountId(m.defaultAccountId)
    } else if (
      !selectedAccountId ||
      !financialAccounts.some((a) => a.id === selectedAccountId)
    ) {
      const defaultAcc =
        financialAccounts.find((a) => a.isDefault) || financialAccounts[0]
      if (defaultAcc) {
        setSelectedAccountId(defaultAcc.id)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid payment amount greater than zero.")
      return
    }

    if (financialAccounts.length > 0 && !selectedAccountId) {
      setError("Please select a destination financial account.")
      return
    }

    setSubmitting(true)

    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`

      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          amount: parsedAmount,
          paymentMethod: selectedMethodCode,
          paymentMethodId: selectedMethodId || undefined,
          accountId: selectedAccountId || undefined,
          referenceNumber: referenceNumber.trim() || undefined,
          idempotencyKey,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to record payment")
      }

      toast.success("Payment recorded successfully", { duration: 3000 })
      onPaymentSuccess(json.data.invoice, json.data.receipt)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred"
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-xs">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>Loading payment methods & accounts...</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
      {configError && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300 font-medium text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>Notice: Using standard payment defaults. ({configError})</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive font-medium">
          {error}
        </div>
      )}

      {/* Amount field with Pay Full Balance action */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Payment Amount *</Label>
          <button
            type="button"
            onClick={() => setAmount(invoice.balanceDue)}
            className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
          >
            Pay Full Balance (<MoneyText value={invoice.balanceDue} />)
          </button>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground select-none">
            ₹
          </span>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            className="pl-7 h-10 text-xs sm:text-sm font-mono font-bold"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
          />
        </div>
      </div>

      {/* Payment Method Selector */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Payment Method *</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {paymentMethods.map((m) => {
            const active = selectedMethodCode === m.code
            return (
              <button
                key={m.code || m.id}
                type="button"
                onClick={() => handleSelectMethod(m)}
                className={cn(
                  "p-2.5 rounded-lg border text-xs font-medium text-left transition-colors cursor-pointer",
                  active
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border/70 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="truncate">{m.name}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Destination Financial Account Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="destinationAccount" className="text-xs font-medium">
            Destination Account *
          </Label>
          {financialAccounts.length > 0 && selectedAccountId && (
            <span className="text-[11px] text-muted-foreground">
              {(() => {
                const activeMethod = paymentMethods.find(
                  (m) => m.code === selectedMethodCode
                )
                if (activeMethod?.defaultAccountId === selectedAccountId) {
                  return "Suggested for method"
                }
                const acc = financialAccounts.find(
                  (a) => a.id === selectedAccountId
                )
                if (acc?.isDefault) return "Operating default"
                return "Selected account"
              })()}
            </span>
          )}
        </div>

        {financialAccounts.length === 0 ? (
          <div className="flex items-center gap-2 p-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs">
            <AlertCircle className="size-4 shrink-0" />
            <span>
              No active financial accounts found for this hotel. Please configure an account in Settings.
            </span>
          </div>
        ) : (
          <div className="relative">
            <select
              id="destinationAccount"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-xs outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/20"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              required
            >
              <option value="" disabled>
                Select destination account...
              </option>
              {financialAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName} ({acc.accountType})
                  {acc.isDefault ? " — [Default]" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Reference / Transaction ID */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Reference / Transaction Number (Optional)
        </Label>
        <Input
          placeholder="e.g. TXN-98421, Last 4 digits, Cheque no..."
          className="h-10 text-xs sm:text-sm font-mono"
          maxLength={100}
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
        />
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
          disabled={submitting || financialAccounts.length === 0}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              Recording...
            </>
          ) : (
            <>
              <Check className="mr-1.5 size-3.5" />
              Confirm Payment (<MoneyText value={parseFloat(amount || "0")} />)
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function RecordPaymentDialog({
  invoice,
  isOpen,
  onClose,
  onPaymentSuccess,
}: RecordPaymentDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record guest settlement against Invoice #{invoice.invoiceNumber}.
          </DialogDescription>
        </DialogHeader>

        {isOpen && (
          <RecordPaymentForm
            key={`${invoice.id}-${isOpen}`}
            invoice={invoice}
            onClose={onClose}
            onPaymentSuccess={onPaymentSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
