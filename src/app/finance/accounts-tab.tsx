"use client"

import * as React from "react"
import { toast } from "sonner"
import { AccountType } from "@prisma/client"
import {
  Plus,
  Search,
  FileText,
  Edit2,
  CheckCircle2,
  Wallet,
  Landmark,
  Coins,
  ShieldCheck,
} from "lucide-react"
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
  MoneyText,
  EmptyState,
} from "@/components/ui-kit"
import { formatDate } from "@/lib/date-format"
import {
  CreateAccountDialog,
  EditAccountDialog,
  AccountStatementDialog,
} from "./account-dialogs"
import type { FinancialAccountWithBalanceDTO } from "@/modules/financial-accounts/financial-accounts.types"

export function AccountsTab({
  propertyId,
  refreshKey,
  onAccountChange,
}: {
  propertyId: string
  refreshKey: number
  onAccountChange: () => void
}) {
  const [accounts, setAccounts] = React.useState<FinancialAccountWithBalanceDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [search, setSearch] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL")
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [editingAccount, setEditingAccount] =
    React.useState<FinancialAccountWithBalanceDTO | null>(null)
  const [statementAccount, setStatementAccount] =
    React.useState<FinancialAccountWithBalanceDTO | null>(null)

  React.useEffect(() => {
    if (!propertyId) return
    let mounted = true

    async function loadAccounts() {
      try {
        const res = await fetch(`/api/financial-accounts?propertyId=${propertyId}`)
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || "Failed to load accounts")
        }
        if (mounted) {
          setAccounts(data.accounts || [])
          setError(null)
          setLoading(false)
        }
      } catch (err: unknown) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : "Failed to load accounts"
          setError(msg)
          setLoading(false)
        }
      }
    }

    loadAccounts()

    return () => {
      mounted = false
    }
  }, [propertyId, refreshKey])

  const refresh = React.useCallback(() => {
    setLoading(true)
    onAccountChange()
  }, [onAccountChange])

  // Filter accounts
  const filteredAccounts = React.useMemo(() => {
    return accounts.filter((a) => {
      const matchesSearch =
        !search.trim() ||
        a.accountName.toLowerCase().includes(search.toLowerCase().trim())
      const matchesType = typeFilter === "ALL" || a.accountType === typeFilter
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && a.isActive) ||
        (statusFilter === "INACTIVE" && !a.isActive)
      return matchesSearch && matchesType && matchesStatus
    })
  }, [accounts, search, typeFilter, statusFilter])

  // Summary Metrics
  const summary = React.useMemo(() => {
    let cashTotal = 0
    let bankTotal = 0
    let activeCount = 0

    for (const a of accounts) {
      const bal = parseFloat(a.currentBalance || "0")
      if (a.accountType === AccountType.CASH) cashTotal += bal
      if (a.accountType === AccountType.BANK) bankTotal += bal
      if (a.isActive) activeCount += 1
    }

    return {
      cashTotal,
      bankTotal,
      grandTotal: cashTotal + bankTotal,
      activeCount,
      totalCount: accounts.length,
    }
  }, [accounts])

  const handleSetDefault = async (account: FinancialAccountWithBalanceDTO) => {
    try {
      const res = await fetch(`/api/financial-accounts/${account.id}?propertyId=${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to set default account")
      toast.success(`${account.accountName} is now the primary operating account`)
      onAccountChange()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to set default"
      toast.error(msg)
    }
  }

  const handleToggleActive = async (account: FinancialAccountWithBalanceDTO) => {
    if (account.isDefault && account.isActive) {
      toast.error("Cannot deactivate the primary operating account. Set another account as default first.")
      return
    }

    try {
      const res = await fetch(`/api/financial-accounts/${account.id}?propertyId=${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !account.isActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update account")
      toast.success(`Account ${account.isActive ? "deactivated" : "activated"} successfully`)
      onAccountChange()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to toggle account status"
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Cash Drawers Float</span>
            <Wallet className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            <MoneyText value={summary.cashTotal} />
          </div>
          <p className="text-[11px] text-muted-foreground">Physical front-desk cash</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Bank Operating Funds</span>
            <Landmark className="size-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            <MoneyText value={summary.bankTotal} />
          </div>
          <p className="text-[11px] text-muted-foreground">Institutional bank balance</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Liquid Net Worth</span>
            <Coins className="size-4 text-primary" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            <MoneyText value={summary.grandTotal} />
          </div>
          <p className="text-[11px] text-muted-foreground">Combined derived funds</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Account Health</span>
            <ShieldCheck className="size-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            {summary.activeCount} <span className="text-xs text-muted-foreground font-normal">/ {summary.totalCount} active</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Configured hotel accounts</p>
        </div>
      </div>

      {/* Action Header & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-48 max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="ALL">All Account Types</option>
            <option value={AccountType.CASH}>Cash Only</option>
            <option value={AccountType.BANK}>Bank Only</option>
          </select>

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
          New Financial Account
        </Button>
      </div>

      {/* Accounts Table */}
      <DataTableShell
        isLoading={loading}
        error={error}
        onRetry={refresh}
        isEmpty={filteredAccounts.length === 0}
        emptyState={
          <EmptyState
            icon={<Wallet className="size-6 text-muted-foreground" />}
            title="No financial accounts found"
            description="Create an operating cash drawer or bank account to manage property funds."
            action={
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                <Plus className="size-3.5 mr-1" /> Create Account
              </Button>
            }
          />
        }
      >
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-foreground">Account Name</TableHead>
                <TableHead className="font-semibold text-foreground">Type</TableHead>
                <TableHead className="font-semibold text-foreground">Opening Baseline</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Current Derived Balance</TableHead>
                <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
                <TableHead className="font-semibold text-foreground text-right w-44">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => {
                return (
                  <TableRow key={account.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{account.accountName}</span>
                        {account.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/25">
                            <CheckCircle2 className="size-2.5" /> Default Operating
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        {account.accountType === AccountType.CASH ? (
                          <>
                            <Wallet className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Cash Drawer
                          </>
                        ) : account.accountType === AccountType.BANK ? (
                          <>
                            <Landmark className="size-3.5 text-sky-600 dark:text-sky-400" /> Bank Account
                          </>
                        ) : (
                          account.accountType
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-muted-foreground">
                        <MoneyText value={account.openingBalance} />
                        {account.openingBalanceDate && (
                          <span className="text-[10px] text-muted-foreground block">
                            as of {formatDate(account.openingBalanceDate)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-sm text-foreground">
                      <MoneyText value={account.currentBalance} />
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={account.isActive ? "ACTIVE" : "DISABLED"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setStatementAccount(account)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          title="View Account Statement"
                        >
                          <FileText className="size-3.5 mr-1" /> Statement
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingAccount(account)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          title="Edit Account Details"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>

                        {!account.isDefault && account.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(account)}
                            className="h-7 px-2 text-[11px] text-primary hover:underline cursor-pointer"
                            title="Set as Default Operating Account"
                          >
                            Set Default
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(account)}
                          disabled={account.isDefault && account.isActive}
                          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
                        >
                          {account.isActive ? "Deactivate" : "Activate"}
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
      <CreateAccountDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        propertyId={propertyId}
        onSuccess={() => {
          onAccountChange()
        }}
      />

      <EditAccountDialog
        account={editingAccount}
        isOpen={Boolean(editingAccount)}
        onClose={() => setEditingAccount(null)}
        propertyId={propertyId}
        onSuccess={() => {
          onAccountChange()
        }}
      />

      <AccountStatementDialog
        account={statementAccount}
        isOpen={Boolean(statementAccount)}
        onClose={() => setStatementAccount(null)}
        propertyId={propertyId}
      />
    </div>
  )
}
