"use client"

import * as React from "react"
import { toast } from "sonner"
import { Plus, Search, Edit2, CreditCard, ArrowRight, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DataTableShell,
  StatusBadge,
  EmptyState,
} from "@/components/ui-kit"
import {
  CreatePaymentMethodDialog,
  EditPaymentMethodDialog,
} from "./method-dialogs"
import type { PaymentMethodDTO } from "@/modules/payment-methods/payment-methods.types"
import type { FinancialAccountWithBalanceDTO } from "@/modules/financial-accounts/financial-accounts.types"

export function MethodsTab({
  propertyId,
  accounts,
  refreshKey,
  onMethodChange,
}: {
  propertyId: string
  accounts: FinancialAccountWithBalanceDTO[]
  refreshKey: number
  onMethodChange: () => void
}) {
  const [methods, setMethods] = React.useState<PaymentMethodDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [editingMethod, setEditingMethod] = React.useState<PaymentMethodDTO | null>(null)

  React.useEffect(() => {
    if (!propertyId) return
    let mounted = true

    async function loadMethods() {
      try {
        const res = await fetch(`/api/payment-methods?propertyId=${propertyId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load payment methods")
        if (mounted) {
          setMethods(data.paymentMethods || [])
          setError(null)
          setLoading(false)
        }
      } catch (err: unknown) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : "Failed to load payment methods"
          setError(msg)
          setLoading(false)
        }
      }
    }

    loadMethods()

    return () => {
      mounted = false
    }
  }, [propertyId, refreshKey])

  const refresh = React.useCallback(() => {
    setLoading(true)
    onMethodChange()
  }, [onMethodChange])

  const filteredMethods = React.useMemo(() => {
    return methods.filter((m) => {
      const matchesSearch =
        !search.trim() ||
        m.name.toLowerCase().includes(search.toLowerCase().trim()) ||
        m.code.toLowerCase().includes(search.toLowerCase().trim())
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && m.isActive) ||
        (statusFilter === "INACTIVE" && !m.isActive)
      return matchesSearch && matchesStatus
    })
  }, [methods, search, statusFilter])

  const handleToggleActive = async (method: PaymentMethodDTO) => {
    try {
      const res = await fetch(`/api/payment-methods/${method.id}?propertyId=${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !method.isActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to toggle status")
      toast.success(`Payment method ${method.isActive ? "deactivated" : "activated"} successfully`)
      onMethodChange()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred"
      toast.error(msg)
    }
  }

  // Account lookup helper
  const getAccountLabel = (accountId: string | null) => {
    if (!accountId) return null
    const acc = accounts.find((a) => a.id === accountId)
    if (!acc) return "Linked Account (External or Unloaded)"
    return `${acc.accountName} (${acc.accountType})`
  }

  return (
    <div className="space-y-6">
      {/* Educational banner distinguishing payment methods from financial accounts */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground">
        <Info className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-foreground">Understanding Payment Methods vs Financial Accounts</span>
          <p className="text-muted-foreground leading-relaxed">
            <strong>Payment Methods</strong> describe <em>how</em> a guest pays at checkout (e.g. Cash, UPI QR, Card POS).
            <strong> Financial Accounts</strong> are the physical cash drawers and bank accounts where hotel money actually resides.
            Connecting a default account to a payment method automatically pre-selects that account during reception billing.
          </p>
        </div>
      </div>

      {/* Action Header & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-48 max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search methods or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>

        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5 font-semibold text-xs shrink-0">
          <Plus className="size-3.5" />
          New Payment Method
        </Button>
      </div>

      {/* Methods Table */}
      <DataTableShell
        isLoading={loading}
        error={error}
        onRetry={refresh}
        isEmpty={filteredMethods.length === 0}
        emptyState={
          <EmptyState
            icon={<CreditCard className="size-6 text-muted-foreground" />}
            title="No payment methods configured"
            description="Add payment methods such as Cash, UPI, and Card to enable guest settlement."
            action={
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                <Plus className="size-3.5 mr-1" /> Add Payment Method
              </Button>
            }
          />
        }
      >
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-foreground">Method Name</TableHead>
                <TableHead className="font-semibold text-foreground">Code Slug</TableHead>
                <TableHead className="font-semibold text-foreground">Suggested Destination Account</TableHead>
                <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
                <TableHead className="font-semibold text-foreground text-right w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMethods.map((method) => {
                const linkedAccountLabel = getAccountLabel(method.defaultAccountId)
                return (
                  <TableRow key={method.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCard className="size-4 text-primary shrink-0" />
                        <span className="font-semibold text-foreground text-sm">{method.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground">
                        {method.code}
                      </span>
                    </TableCell>
                    <TableCell>
                      {linkedAccountLabel ? (
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          <ArrowRight className="size-3 text-muted-foreground" />
                          <span>{linkedAccountLabel}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">None (Receptionist selects account)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={method.isActive ? "ACTIVE" : "DISABLED"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingMethod(method)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          title="Edit Payment Method"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(method)}
                          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
                        >
                          {method.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </DataTableShell>

      {/* Dialogs */}
      <CreatePaymentMethodDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        propertyId={propertyId}
        accounts={accounts}
        onSuccess={() => {
          onMethodChange()
        }}
      />

      <EditPaymentMethodDialog
        method={editingMethod}
        isOpen={Boolean(editingMethod)}
        onClose={() => setEditingMethod(null)}
        propertyId={propertyId}
        accounts={accounts}
        onSuccess={() => {
          onMethodChange()
        }}
      />
    </div>
  )
}
