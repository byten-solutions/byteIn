"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import type { InvoiceDetailDTO, InvoiceListResponse } from "@/modules/billing/billing.types"
import {
  Search,
  Receipt,
  ChevronRight,
} from "lucide-react"
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
  PageHeader,
  StatusBadge,
  DataTableShell,
  MobileCardList,
  EmptyState,
  MoneyText,
} from "@/components/ui-kit"
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination"
import { formatDate } from "@/lib/date-format"
import { cn } from "@/lib/utils"

interface InvoiceListProps {
  initialData: InvoiceListResponse
}

const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "ISSUED", label: "Issued" },
  { value: "PARTIALLY_PAID", label: "Partial" },
  { value: "PAID", label: "Paid" },
  { value: "DRAFT", label: "Draft" },
  { value: "VOID", label: "Void" },
]

export function InvoiceList({ initialData }: InvoiceListProps) {
  const router = useRouter()
  const [data, setData] = React.useState<InvoiceListResponse>(initialData)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")
  const [currentPage, setCurrentPage] = React.useState(initialData.page || 1)
  const [currentLimit, setCurrentLimit] = React.useState(initialData.limit || DEFAULT_PAGE_SIZE)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const prevFiltersRef = React.useRef({
    search,
    statusFilter,
    currentPage,
    currentLimit,
  })

  const fetchInvoices = React.useCallback(
    async (searchTerm = search, status = statusFilter, page = currentPage, limit = currentLimit) => {
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (searchTerm.trim()) params.set("search", searchTerm.trim())
        if (status !== "ALL") params.set("status", status)
        params.set("page", String(page))
        params.set("limit", String(limit))

        const res = await fetch(`/api/invoices?${params.toString()}`, {
          signal: controller.signal,
        })
        const json = await res.json()
        if (json.success) {
          setData(json.data)
        } else {
          throw new Error(json.error || "Failed to fetch invoices")
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return
        }
        console.error("Error fetching invoices:", err)
        setError("Unable to load invoices. Please retry.")
      } finally {
        if (abortControllerRef.current === controller) {
          setLoading(false)
        }
      }
    },
    [search, statusFilter, currentPage, currentLimit]
  )

  React.useEffect(() => {
    const prev = prevFiltersRef.current
    const filtersChanged =
      prev.search !== search || prev.statusFilter !== statusFilter
    const pageChanged = prev.currentPage !== currentPage
    const limitChanged = prev.currentLimit !== currentLimit

    if (!filtersChanged && !pageChanged && !limitChanged) {
      return
    }

    if ((filtersChanged || limitChanged) && currentPage !== 1) {
      prevFiltersRef.current = { search, statusFilter, currentPage: 1, currentLimit }
      setCurrentPage(1)
      return
    }

    prevFiltersRef.current = { search, statusFilter, currentPage, currentLimit }

    const timer = setTimeout(() => {
      fetchInvoices(search, statusFilter, currentPage, currentLimit)
    }, 300)

    return () => clearTimeout(timer)
  }, [fetchInvoices, search, statusFilter, currentPage, currentLimit])

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const totalOutstandingNum = parseFloat(data?.summary?.totalOutstanding || "0")

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Billing"
        description="Reservation invoices, folios, payment recording, and receipts"
      />

      {/* Slim Summary Strip (Replaces big KPI cards) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/80 bg-card p-4 px-5 text-xs shadow-2xs">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Invoiced:</span>
            <MoneyText value={data?.summary?.totalInvoiced || "0.00"} className="font-bold text-foreground text-sm font-mono tabular-nums" />
          </div>
          <span className="text-muted-foreground/30">•</span>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Collected:</span>
            <MoneyText value={data?.summary?.totalCollected || "0.00"} className="font-bold text-emerald-600 dark:text-emerald-400 text-sm font-mono tabular-nums" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Outstanding:</span>
          <MoneyText
            value={data?.summary?.totalOutstanding || "0.00"}
            className={cn(
              "text-sm font-bold font-mono tabular-nums",
              totalOutstandingNum > 0
                ? "text-primary font-bold"
                : "text-foreground"
            )}
          />
        </div>
      </div>

      {/* Toolbar: Search + Status Chips */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
          <Input
            placeholder="Search invoice #, guest, or phone..."
            className="pl-9 h-9 text-xs sm:text-sm bg-card border-border/80 shadow-2xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter chips */}
        <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-1 shrink-0 overflow-x-auto shadow-2xs">
          {STATUS_FILTERS.map((tab) => {
            const active = statusFilter === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer",
                  active
                    ? "bg-card text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table & Mobile Cards */}
      <DataTableShell
        isLoading={loading}
        error={error}
        onRetry={() => fetchInvoices()}
        isEmpty={data.invoices.length === 0}
        emptyState={
          <EmptyState
            icon={<Receipt className="size-6" />}
            title="No invoices yet"
            description="Invoices appear once a reservation generates one."
          />
        }
        pagination={{
          page: data.page,
          totalPages: data.totalPages,
          totalCount: data.total,
          limit: currentLimit,
          onPageChange: (p) => setCurrentPage(p),
          onLimitChange: (l) => {
            setCurrentLimit(l)
            setCurrentPage(1)
          },
        }}
        mobileView={
          <MobileCardList
            items={data.invoices}
            keyExtractor={(inv) => inv.id}
            renderCard={(inv) => {
              const balanceNum = parseFloat(inv.balanceDue || "0")
              return (
                <div
                  onClick={() => router.push(`/billing/${inv.id}`)}
                  onMouseEnter={() => router.prefetch(`/billing/${inv.id}`)}
                  className="rounded-xl border border-border/80 bg-card p-4 space-y-3 cursor-pointer hover:border-primary/40 transition-colors shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-sm text-foreground truncate min-w-0">
                      #{inv.invoiceNumber}
                    </span>
                    <StatusBadge status={inv.status} size="sm" />
                  </div>

                  <div className="text-xs min-w-0 space-y-0.5">
                    <div className="font-medium text-foreground truncate" title={inv.customerName}>{inv.customerName}</div>
                    <div className="text-muted-foreground text-[11px] truncate">
                      Reservation #{inv.reservationNo}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                    <div>
                      <div className="text-[11px] text-muted-foreground">Total: <MoneyText value={inv.grandTotal} /></div>
                      <div className="text-[11px] text-muted-foreground">Paid: <MoneyText value={inv.totalPaid} /></div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground">Balance Due</div>
                      <MoneyText
                        value={inv.balanceDue}
                        className={cn(
                          "text-sm font-bold",
                          balanceNum > 0 ? "text-foreground font-bold" : "text-muted-foreground"
                        )}
                      />
                    </div>
                  </div>
                </div>
              )
            }}
          />
        }
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[170px] text-xs font-semibold">Invoice</TableHead>
              <TableHead className="text-xs font-semibold">Guest & Reservation</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">Total</TableHead>
              <TableHead className="text-right text-xs font-semibold">Balance Due</TableHead>
              <TableHead className="w-[44px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.invoices.map((inv: InvoiceDetailDTO) => {
              const balanceNum = parseFloat(inv.balanceDue || "0")
              return (
                <TableRow
                  key={inv.id}
                  onClick={() => router.push(`/billing/${inv.id}`)}
                  onMouseEnter={() => router.prefetch(`/billing/${inv.id}`)}
                  className="h-16 text-xs hover:bg-muted/40 cursor-pointer transition-colors group"
                >
                  <TableCell className="font-medium">
                    <span className="font-mono font-semibold text-foreground text-xs block">
                      #{inv.invoiceNumber}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(inv.createdAt)}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="font-medium text-foreground block">{inv.customerName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      #{inv.reservationNo}
                    </span>
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={inv.status} size="sm" />
                  </TableCell>

                  <TableCell>
                    <MoneyText value={inv.grandTotal} className="font-semibold text-foreground block" />
                    <span className="text-[11px] text-muted-foreground">
                      Paid <MoneyText value={inv.totalPaid} />
                    </span>
                  </TableCell>

                  <TableCell className="text-right">
                    <MoneyText
                      value={inv.balanceDue}
                      className={cn(
                        "font-bold text-xs font-mono",
                        balanceNum > 0 ? "text-foreground font-bold" : "text-muted-foreground"
                      )}
                    />
                  </TableCell>

                  <TableCell className="text-right p-0 pr-4">
                    <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground transition-colors ml-auto" />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </DataTableShell>
    </div>
  )
}
