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
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const isInitialMount = React.useRef(true)

  const fetchInvoices = React.useCallback(async (searchTerm = search, status = statusFilter) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (searchTerm.trim()) params.set("search", searchTerm.trim())
      if (status !== "ALL") params.set("status", status)

      const res = await fetch(`/api/invoices?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        throw new Error(json.error || "Failed to fetch invoices")
      }
    } catch (err: unknown) {
      console.error("Error fetching invoices:", err)
      setError("Unable to load invoices. Please retry.")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const timer = setTimeout(() => {
      fetchInvoices(search, statusFilter)
    }, 250)

    return () => clearTimeout(timer)
  }, [fetchInvoices, search, statusFilter])

  const totalOutstandingNum = parseFloat(data.summary.totalOutstanding || "0")

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Billing"
        description="Reservation invoices, folios, payment recording, and receipts"
      />

      {/* Slim Summary Strip (Replaces big KPI cards) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/70 bg-card p-4 px-6 text-xs shadow-xs">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Invoiced:</span>
            <MoneyText value={data.summary.totalInvoiced} className="font-bold text-foreground text-sm" />
          </div>
          <span className="text-muted-foreground/30">•</span>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Collected:</span>
            <MoneyText value={data.summary.totalCollected} className="font-bold text-emerald-600 dark:text-emerald-400 text-sm" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Outstanding:</span>
          <MoneyText
            value={data.summary.totalOutstanding}
            className={cn(
              "text-sm font-bold",
              totalOutstandingNum > 0
                ? "text-amber-600 dark:text-amber-400 font-extrabold"
                : "text-foreground"
            )}
          />
        </div>
      </div>

      {/* Toolbar: Search + Status Chips */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice #, guest, or phone..."
            className="pl-9 h-10 text-xs sm:text-sm bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter chips */}
        <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-1 shrink-0 overflow-x-auto">
          {STATUS_FILTERS.map((tab) => {
            const active = statusFilter === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer",
                  active
                    ? "bg-card text-foreground shadow-xs font-semibold"
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
        mobileView={
          <MobileCardList
            items={data.invoices}
            keyExtractor={(inv) => inv.id}
            renderCard={(inv) => {
              const balanceNum = parseFloat(inv.balanceDue || "0")
              return (
                <div
                  onClick={() => router.push(`/billing/${inv.id}`)}
                  className="rounded-xl border border-border/80 bg-card p-4 space-y-3 cursor-pointer hover:border-primary/40 transition-colors shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-foreground">
                      #{inv.invoiceNumber}
                    </span>
                    <StatusBadge status={inv.status} size="sm" />
                  </div>

                  <div className="text-xs">
                    <div className="font-medium text-foreground">{inv.customerName}</div>
                    <div className="text-muted-foreground text-[11px]">
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
                          balanceNum > 0 ? "text-amber-600 dark:text-amber-400 font-extrabold" : "text-foreground"
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
                        "font-bold text-xs",
                        balanceNum > 0 ? "text-amber-600 dark:text-amber-400 font-extrabold" : "text-foreground"
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
