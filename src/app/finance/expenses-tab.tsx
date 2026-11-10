"use client"

import * as React from "react"
import {
  Plus,
  Search,
  Settings,
  Receipt,
  Coins,
  TrendingDown,
  Edit2,
  Ban,
  Calendar,
  X,
  Loader2,
  AlertCircle,
  Eye,
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
  EmptyState,
  StatCard,
  PaginationFooter,
} from "@/components/ui-kit"
import { formatDate } from "@/lib/date-format"
import {
  CreateExpenseDialog,
  EditExpenseDialog,
  RecordExpensePaymentDialog,
  ExpenseDetailsDialog,
  VoidExpensePaymentDialog,
  VoidExpenseDialog,
} from "./expense-dialogs"
import { ExpenseCategoriesDialog } from "./expense-categories-dialog"
import type {
  ExpenseDTO,
  ExpenseHeadDTO,
  ExpensePaymentDTO,
  ExpenseSummaryMetricsDTO,
} from "@/modules/expenses/expenses.types"
import type { FinancialAccountWithBalanceDTO } from "@/modules/financial-accounts/financial-accounts.types"
import type { PaymentMethodDTO } from "@/modules/payment-methods/payment-methods.types"

export function ExpensesTab({
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
  const [expenses, setExpenses] = React.useState<ExpenseDTO[]>([])
  const [categories, setCategories] = React.useState<ExpenseHeadDTO[]>([])
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethodDTO[]>([])
  const [totalCount, setTotalCount] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [limit] = React.useState(20)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [summary, setSummary] = React.useState<ExpenseSummaryMetricsDTO | null>(null)

  // Filters
  const [search, setSearch] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL")
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")
  const [startDate, setStartDate] = React.useState<string>("")
  const [endDate, setEndDate] = React.useState<string>("")

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isCategoriesOpen, setIsCategoriesOpen] = React.useState(false)
  const [editingExpense, setEditingExpense] = React.useState<ExpenseDTO | null>(null)
  const [payingExpense, setPayingExpense] = React.useState<ExpenseDTO | null>(null)
  const [detailExpenseId, setDetailExpenseId] = React.useState<string | null>(null)
  const [voidingExpense, setVoidingExpense] = React.useState<ExpenseDTO | null>(null)
  const [voidingPayment, setVoidingPayment] = React.useState<{
    expenseId: string
    payment: ExpensePaymentDTO
  } | null>(null)

  const [localRefresh, setLocalRefresh] = React.useState(0)

  // Fetch Categories & Payment Methods
  React.useEffect(() => {
    if (!propertyId) return
    let mounted = true

    async function fetchMetadata() {
      try {
        const [catRes, pmRes] = await Promise.all([
          fetch(`/api/expense-heads?propertyId=${propertyId}`),
          fetch(`/api/payment-methods?propertyId=${propertyId}&isActive=true`),
        ])
        const [catData, pmData] = await Promise.all([catRes.json(), pmRes.json()])

        if (mounted) {
          if (catRes.ok) setCategories(catData.expenseHeads || [])
          if (pmRes.ok) setPaymentMethods(pmData.paymentMethods || [])
        }
      } catch (err) {
        console.error("Failed to load expense metadata:", err)
      }
    }

    fetchMetadata()

    return () => {
      mounted = false
    }
  }, [propertyId, refreshKey, localRefresh])

  // Fetch Expenses with applied filters and pagination
  React.useEffect(() => {
    if (!propertyId) return
    let mounted = true

    async function loadExpenses() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          propertyId,
          page: String(page),
          limit: String(limit),
          summary: "true",
        })

        if (search.trim()) params.append("search", search.trim())
        if (categoryFilter !== "ALL") params.append("expenseHeadId", categoryFilter)
        if (statusFilter !== "ALL") params.append("status", statusFilter)
        if (startDate) params.append("startDate", startDate)
        if (endDate) params.append("endDate", endDate)

        const res = await fetch(`/api/expenses?${params.toString()}`)
        const data = await res.json()

        if (mounted) {
          if (res.ok) {
            setExpenses(data.expenses || [])
            setTotalCount(data.total || 0)
            if (data.summary) {
              setSummary(data.summary)
            }
            setError(null)
          } else {
            setError(data.error || "Failed to load expense records")
          }
          setLoading(false)
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load expense records")
          setLoading(false)
        }
      }
    }

    loadExpenses()

    return () => {
      mounted = false
    }
  }, [propertyId, page, limit, search, categoryFilter, statusFilter, startDate, endDate, refreshKey, localRefresh])

  // Financial summary metrics fallback calculation
  const calculatedMetrics = React.useMemo(() => {
    if (summary) {
      return {
        totalIncurred: parseFloat(summary.totalIncurred || "0"),
        totalPaid: parseFloat(summary.totalPaid || "0"),
        totalOutstanding: parseFloat(summary.totalOutstanding || "0"),
        count: totalCount,
      }
    }

    const activeExpenses = expenses.filter((e) => e.status !== "VOID")
    const totalIncurred = activeExpenses.reduce(
      (sum, e) => sum + parseFloat(e.amount || "0"),
      0
    )
    const totalPaid = activeExpenses.reduce(
      (sum, e) => sum + parseFloat(e.paidAmount || "0"),
      0
    )
    const totalOutstanding = activeExpenses.reduce(
      (sum, e) => sum + parseFloat(e.outstandingAmount || "0"),
      0
    )

    return {
      totalIncurred,
      totalPaid,
      totalOutstanding,
      count: expenses.length,
    }
  }, [summary, expenses, totalCount])

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

  const handleMutationSuccess = () => {
    setLocalRefresh((k) => k + 1)
    onDataChange()
  }

  return (
    <div className="space-y-6">
      {/* 1. Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Expenses Incurred"
          value={`$${calculatedMetrics.totalIncurred.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext={`Across ${calculatedMetrics.count} recorded expense(s)`}
          icon={<Receipt className="size-5 text-primary" />}
        />
        <StatCard
          label="Total Disbursed (Paid Out)"
          value={`$${calculatedMetrics.totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext="Disbursed from financial accounts"
          icon={<TrendingDown className="size-5 text-emerald-600 dark:text-emerald-400" />}
          indicatorColor="bg-emerald-500"
        />
        <StatCard
          label="Total Outstanding Payable"
          value={`$${calculatedMetrics.totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext="Remaining vendor balance payable"
          icon={<Coins className="size-5 text-amber-600 dark:text-amber-400" />}
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
                placeholder="Search title, vendor, or invoice #..."
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
              className="h-9 px-2.5 text-xs rounded-md border border-input bg-card font-medium text-foreground outline-hidden cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
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
              className="h-9 px-2.5 text-xs rounded-md border border-input bg-card font-medium text-foreground outline-hidden cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending (Unpaid)</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Fully Paid</option>
              <option value="VOID">Voided</option>
            </select>

            {/* Date Filters */}
            <div className="flex items-center gap-1 bg-card border border-input rounded-md px-2 h-9">
              <Calendar className="size-3.5 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPage(1)
                }}
                className="text-xs bg-transparent outline-hidden cursor-pointer w-28"
                title="Start Date"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPage(1)
                }}
                className="text-xs bg-transparent outline-hidden cursor-pointer w-28"
                title="End Date"
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCategoriesOpen(true)}
              className="h-9 text-xs cursor-pointer"
            >
              <Settings className="size-3.5 mr-1.5" />
              Manage Categories
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="h-9 text-xs cursor-pointer"
            >
              <Plus className="size-3.5 mr-1.5" />
              Record Expense
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Expenses Data Table */}
      <DataTableShell>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-xs">Loading expenses...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive space-y-2">
            <AlertCircle className="size-6 mx-auto" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState
            title="No Expenses Found"
            description={
              hasActiveFilters
                ? "No expense records match the applied filter criteria. Try adjusting or clearing your filters."
                : "No expenses have been recorded for this property yet. Click 'Record Expense' to create your first entry."
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="size-3.5 mr-1.5" />
                  Record Expense
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold">Date</TableHead>
                  <TableHead className="text-xs font-semibold">Title</TableHead>
                  <TableHead className="text-xs font-semibold">Category</TableHead>
                  <TableHead className="text-xs font-semibold">Vendor</TableHead>
                  <TableHead className="text-xs font-semibold">Invoice #</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Incurred</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Paid</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Outstanding</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-28">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => {
                  const outstandingNum = parseFloat(expense.outstandingAmount || "0")
                  const isVoid = expense.status === "VOID"
                  const canPay = !isVoid && outstandingNum > 0

                  return (
                    <TableRow key={expense.id} className="text-xs hover:bg-muted/30 transition-colors">
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {expense.expenseDate ? formatDate(expense.expenseDate) : "—"}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground max-w-[180px] truncate">
                        {expense.title}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-muted">
                          {expense.categoryName}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[130px] truncate">
                        {expense.vendorName || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {expense.referenceNumber || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        ${parseFloat(expense.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                        ${parseFloat(expense.paidAmount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        <span className={outstandingNum > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                          ${outstandingNum.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={expense.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Detail & History */}
                          <button
                            type="button"
                            onClick={() => setDetailExpenseId(expense.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="View details & payment history"
                          >
                            <Eye className="size-3.5" />
                          </button>

                          {/* Disburse Payment */}
                          {canPay && (
                            <button
                              type="button"
                              onClick={() => setPayingExpense(expense)}
                              className="p-1.5 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                              title="Disburse payment against this expense"
                            >
                              <Coins className="size-3.5" />
                            </button>
                          )}

                          {/* Edit Expense */}
                          {!isVoid && (
                            <button
                              type="button"
                              onClick={() => setEditingExpense(expense)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                              title="Edit expense"
                            >
                              <Edit2 className="size-3.5" />
                            </button>
                          )}

                          {/* Void Expense */}
                          {!isVoid && (
                            <button
                              type="button"
                              onClick={() => setVoidingExpense(expense)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                              title="Void expense record"
                            >
                              <Ban className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* 4. Pagination */}
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

      {/* 5. Dialogs */}
      <ExpenseCategoriesDialog
        isOpen={isCategoriesOpen}
        onClose={() => setIsCategoriesOpen(false)}
        propertyId={propertyId}
        onSuccess={handleMutationSuccess}
      />

      <CreateExpenseDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        propertyId={propertyId}
        categories={categories}
        onSuccess={handleMutationSuccess}
      />

      <EditExpenseDialog
        isOpen={Boolean(editingExpense)}
        onClose={() => setEditingExpense(null)}
        propertyId={propertyId}
        expense={editingExpense}
        categories={categories}
        onSuccess={handleMutationSuccess}
      />

      <RecordExpensePaymentDialog
        isOpen={Boolean(payingExpense)}
        onClose={() => setPayingExpense(null)}
        propertyId={propertyId}
        expense={payingExpense}
        accounts={accounts}
        paymentMethods={paymentMethods}
        onSuccess={handleMutationSuccess}
      />

      <ExpenseDetailsDialog
        isOpen={Boolean(detailExpenseId)}
        onClose={() => setDetailExpenseId(null)}
        propertyId={propertyId}
        expenseId={detailExpenseId}
        onRecordPayment={(exp) => {
          setDetailExpenseId(null)
          setPayingExpense(exp)
        }}
        onVoidExpense={(exp) => {
          setDetailExpenseId(null)
          setVoidingExpense(exp)
        }}
        onVoidPayment={(payment) => {
          if (detailExpenseId) {
            setVoidingPayment({ expenseId: detailExpenseId, payment })
          }
        }}
      />

      {voidingPayment && (
        <VoidExpensePaymentDialog
          isOpen={Boolean(voidingPayment)}
          onClose={() => setVoidingPayment(null)}
          propertyId={propertyId}
          expenseId={voidingPayment.expenseId}
          payment={voidingPayment.payment}
          onSuccess={handleMutationSuccess}
        />
      )}

      <VoidExpenseDialog
        isOpen={Boolean(voidingExpense)}
        onClose={() => setVoidingExpense(null)}
        propertyId={propertyId}
        expense={voidingExpense}
        onSuccess={handleMutationSuccess}
      />
    </div>
  )
}
