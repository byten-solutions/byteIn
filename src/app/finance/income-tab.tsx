"use client"

import * as React from "react"
import {
  Plus,
  Search,
  Settings,
  Coins,
  TrendingUp,
  Receipt,
  Edit2,
  Ban,
  Calendar,
  X,
  Loader2,
  AlertCircle,
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
  StatCard,
  PaginationFooter,
} from "@/components/ui-kit"
import { formatDate } from "@/lib/date-format"
import {
  CreateIncomeDialog,
  EditIncomeDialog,
  CollectReceiptDialog,
  IncomeDetailsDialog,
  VoidIncomeDialog,
} from "./income-dialogs"
import { IncomeCategoriesDialog } from "./income-categories-dialog"
import type { IncomeDTO, IncomeHeadDTO } from "@/modules/income/income.types"
import type { FinancialAccountWithBalanceDTO } from "@/modules/financial-accounts/financial-accounts.types"
import type { PaymentMethodDTO } from "@/modules/payment-methods/payment-methods.types"

export function IncomeTab({
  propertyId,
  accounts,
  refreshKey,
  onDataChange,
}: {
  propertyId: string
  accounts: FinancialAccountWithBalanceDTO[]
  refreshKey: number
  onDataChange: () => void
}) {
  const [incomes, setIncomes] = React.useState<IncomeDTO[]>([])
  const [categories, setCategories] = React.useState<IncomeHeadDTO[]>([])
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethodDTO[]>([])
  const [totalCount, setTotalCount] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [limit] = React.useState(20)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Filters
  const [search, setSearch] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL")
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")
  const [startDate, setStartDate] = React.useState<string>("")
  const [endDate, setEndDate] = React.useState<string>("")

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isCategoriesOpen, setIsCategoriesOpen] = React.useState(false)
  const [editingIncome, setEditingIncome] = React.useState<IncomeDTO | null>(null)
  const [collectingIncome, setCollectingIncome] = React.useState<IncomeDTO | null>(null)
  const [detailIncomeId, setDetailIncomeId] = React.useState<string | null>(null)
  const [voidingIncome, setVoidingIncome] = React.useState<IncomeDTO | null>(null)

  // Fetch Categories & Payment Methods
  React.useEffect(() => {
    if (!propertyId) return
    let mounted = true

    async function fetchMetadata() {
      try {
        const [catRes, pmRes] = await Promise.all([
          fetch(`/api/income-heads?propertyId=${propertyId}`),
          fetch(`/api/payment-methods?propertyId=${propertyId}&isActive=true`),
        ])
        const [catData, pmData] = await Promise.all([catRes.json(), pmRes.json()])

        if (mounted) {
          if (catRes.ok) setCategories(catData.incomeHeads || [])
          if (pmRes.ok) setPaymentMethods(pmData.paymentMethods || [])
        }
      } catch (err) {
        console.error("Failed to load income metadata:", err)
      }
    }

    fetchMetadata()

    return () => {
      mounted = false
    }
  }, [propertyId, refreshKey])

  const [localRefresh, setLocalRefresh] = React.useState(0)

  // Fetch Incomes with applied filters and pagination
  React.useEffect(() => {
    if (!propertyId) return
    let mounted = true

    async function loadIncomes() {
      try {
        const params = new URLSearchParams({
          propertyId,
          page: String(page),
          limit: String(limit),
        })

        if (search.trim()) params.append("search", search.trim())
        if (categoryFilter !== "ALL") params.append("incomeHeadId", categoryFilter)
        if (statusFilter !== "ALL") params.append("status", statusFilter)
        if (startDate) params.append("startDate", startDate)
        if (endDate) params.append("endDate", endDate)

        const res = await fetch(`/api/incomes?${params.toString()}`)
        const data = await res.json()

        if (mounted) {
          if (res.ok) {
            setIncomes(data.incomes || [])
            setTotalCount(data.total || 0)
            setError(null)
          } else {
            setError(data.error || "Failed to load income records")
          }
          setLoading(false)
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load income records")
          setLoading(false)
        }
      }
    }

    loadIncomes()

    return () => {
      mounted = false
    }
  }, [propertyId, page, limit, search, categoryFilter, statusFilter, startDate, endDate, refreshKey, localRefresh])

  // Financial summary metrics
  const summaryMetrics = React.useMemo(() => {
    // Non-void incomes contribute to totals
    const activeIncomes = incomes.filter((i) => i.status !== "VOID")
    const totalExpected = activeIncomes.reduce(
      (sum, i) => sum + parseFloat(i.expectedAmount || "0"),
      0
    )
    const totalReceived = activeIncomes.reduce(
      (sum, i) => sum + parseFloat(i.receivedAmount || "0"),
      0
    )
    const totalOutstanding = activeIncomes.reduce(
      (sum, i) => sum + parseFloat(i.outstandingAmount || "0"),
      0
    )

    return {
      totalExpected,
      totalReceived,
      totalOutstanding,
      count: incomes.length,
    }
  }, [incomes])

  const clearFilters = () => {
    setSearch("")
    setCategoryFilter("ALL")
    setStatusFilter("ALL")
    setStartDate("")
    setEndDate("")
    setPage(1)
  }

  const hasActiveFilters =
    Boolean(search) ||
    categoryFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    Boolean(startDate) ||
    Boolean(endDate)

  return (
    <div className="space-y-6">
      {/* 1. Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Direct Income Expected"
          value={`$${summaryMetrics.totalExpected.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext={`Across ${summaryMetrics.count} record(s) listed`}
          icon={<Coins className="size-5 text-primary" />}
        />
        <StatCard
          label="Total Collected (In Hand)"
          value={`$${summaryMetrics.totalReceived.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext="Credited into financial accounts"
          icon={<Receipt className="size-5 text-emerald-600 dark:text-emerald-400" />}
          indicatorColor="bg-emerald-500"
        />
        <StatCard
          label="Total Outstanding Balance"
          value={`$${summaryMetrics.totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext="Awaiting collection receipt"
          icon={<TrendingUp className="size-5 text-amber-600 dark:text-amber-400" />}
          indicatorColor="bg-amber-500"
        />
      </div>

      {/* 2. Filter & Action Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search title, category, or note..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Category Select */}
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPage(1)
              }}
              className="h-9 px-3 rounded-md bg-card border border-border text-xs focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="h-9 px-3 rounded-md bg-card border border-border text-xs focus:ring-1 focus:ring-primary outline-hidden cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="RECEIVED">Received</option>
              <option value="VOID">Void</option>
            </select>

            {/* Date Filters */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPage(1)
                }}
                className="h-9 w-32 text-xs"
                title="Filter by start date"
              />
              <span>to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPage(1)
                }}
                className="h-9 w-32 text-xs"
                title="Filter by end date"
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
              >
                <X className="size-3.5" />
                Clear
              </Button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCategoriesOpen(true)}
              className="h-9 text-xs gap-1.5 cursor-pointer"
            >
              <Settings className="size-3.5" />
              Categories
            </Button>

            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="h-9 text-xs gap-1.5 cursor-pointer"
            >
              <Plus className="size-3.5" />
              Record Direct Income
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Incomes Table */}
      <DataTableShell>
        {error ? (
          <div className="p-8 text-center text-xs text-destructive flex items-center justify-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : loading && incomes.length === 0 ? (
          <div className="p-16 flex items-center justify-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="size-4 animate-spin" />
            <span>Loading direct income records...</span>
          </div>
        ) : incomes.length === 0 ? (
          <EmptyState
            title="No Direct Incomes Found"
            description={
              hasActiveFilters
                ? "No direct income records match the selected filters. Try broadening your search or date criteria."
                : "No direct or non-invoice income has been recorded for this hotel property yet."
            }
            action={
              <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5 text-xs">
                <Plus className="size-3.5" />
                Record First Income
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Income Title & Category</TableHead>
                <TableHead className="text-xs text-right">Expected</TableHead>
                <TableHead className="text-xs text-right">Received</TableHead>
                <TableHead className="text-xs text-right">Outstanding</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomes.map((item) => {
                const canCollect =
                  item.status !== "VOID" &&
                  parseFloat(item.outstandingAmount) > 0

                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs py-3 font-medium whitespace-nowrap">
                      {formatDate(item.incomeDate)}
                    </TableCell>

                    <TableCell className="text-xs py-3">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {item.title}
                        {item.receiptCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-muted text-muted-foreground rounded-full font-mono">
                            {item.receiptCount} receipt{item.receiptCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span className="font-medium text-foreground/80">{item.incomeHeadName}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">({item.incomeHeadCode})</span>
                        {item.description && <span className="truncate max-w-xs text-muted-foreground/70">• {item.description}</span>}
                      </div>
                    </TableCell>

                    <TableCell className="text-xs py-3 text-right font-bold text-foreground">
                      <MoneyText value={item.expectedAmount} />
                    </TableCell>

                    <TableCell className="text-xs py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      <MoneyText value={item.receivedAmount} />
                    </TableCell>

                    <TableCell className="text-xs py-3 text-right font-bold text-amber-600 dark:text-amber-400">
                      <MoneyText value={item.outstandingAmount} />
                    </TableCell>

                    <TableCell className="text-xs py-3">
                      <StatusBadge status={item.status} size="sm" />
                    </TableCell>

                    <TableCell className="text-xs py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDetailIncomeId(item.id)}
                          className="h-7 px-2 text-xs cursor-pointer"
                          title="View Details & Collections"
                        >
                          Details
                        </Button>

                        {canCollect && (
                          <Button
                            size="sm"
                            onClick={() => setCollectingIncome(item)}
                            className="h-7 px-2 text-xs gap-1 cursor-pointer"
                            title="Collect payment"
                          >
                            <Plus className="size-3" />
                            Collect
                          </Button>
                        )}

                        {item.status !== "VOID" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingIncome(item)}
                            className="size-7 cursor-pointer hover:bg-muted"
                            title="Edit income metadata"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                        )}

                        {item.status !== "VOID" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setVoidingIncome(item)}
                            className="size-7 cursor-pointer hover:text-destructive hover:bg-destructive/10"
                            title="Void income record"
                          >
                            <Ban className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {totalCount > limit && (
          <PaginationFooter
            total={totalCount}
            page={page}
            limit={limit}
            syncUrl={false}
            onPageChange={setPage}
          />
        )}
      </DataTableShell>

      {/* Dialog: Create Income */}
      {isCreateOpen && (
        <CreateIncomeDialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          propertyId={propertyId}
          categories={categories}
          onSuccess={() => {
            setLocalRefresh((k) => k + 1)
            onDataChange()
          }}
        />
      )}

      {/* Dialog: Edit Income */}
      {editingIncome && (
        <EditIncomeDialog
          isOpen={Boolean(editingIncome)}
          onClose={() => setEditingIncome(null)}
          propertyId={propertyId}
          income={editingIncome}
          categories={categories}
          onSuccess={() => {
            setLocalRefresh((k) => k + 1)
            onDataChange()
          }}
        />
      )}

      {/* Dialog: Collect Receipt */}
      {collectingIncome && (
        <CollectReceiptDialog
          isOpen={Boolean(collectingIncome)}
          onClose={() => setCollectingIncome(null)}
          propertyId={propertyId}
          income={collectingIncome}
          accounts={accounts}
          paymentMethods={paymentMethods}
          onSuccess={() => {
            setLocalRefresh((k) => k + 1)
            onDataChange()
          }}
        />
      )}

      {/* Dialog: Income Details (Itemized Receipts & History) */}
      {detailIncomeId && (
        <IncomeDetailsDialog
          isOpen={Boolean(detailIncomeId)}
          onClose={() => setDetailIncomeId(null)}
          propertyId={propertyId}
          incomeId={detailIncomeId}
          accounts={accounts}
          paymentMethods={paymentMethods}
          onDataChange={() => {
            setLocalRefresh((k) => k + 1)
            onDataChange()
          }}
        />
      )}

      {/* Dialog: Void Income */}
      {voidingIncome && (
        <VoidIncomeDialog
          isOpen={Boolean(voidingIncome)}
          onClose={() => setVoidingIncome(null)}
          propertyId={propertyId}
          income={voidingIncome}
          onSuccess={() => {
            setVoidingIncome(null)
            setLocalRefresh((k) => k + 1)
            onDataChange()
          }}
        />
      )}

      {/* Dialog: Category Management */}
      {isCategoriesOpen && (
        <IncomeCategoriesDialog
          isOpen={isCategoriesOpen}
          onClose={() => setIsCategoriesOpen(false)}
          propertyId={propertyId}
          onSuccess={() => {
            setLocalRefresh((k) => k + 1)
            onDataChange()
          }}
        />
      )}
    </div>
  )
}
