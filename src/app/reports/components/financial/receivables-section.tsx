"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { PaginationFooter } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { ReceivablesReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, TableSkeleton } from "../report-section-shell"
import { ReportMetricBand } from "../charts"

interface ReceivablesSectionProps {
  propertyId?: string
  refreshTrigger?: number
}

export function ReceivablesSection({ propertyId, refreshTrigger }: ReceivablesSectionProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const urlFilter = searchParams?.get("filter") || searchParams?.get("subtab")
  const initialFilter: "all" | "in_house" | "departed" =
    urlFilter === "in_house" || urlFilter === "departed" ? urlFilter : "all"

  const [filter, setFilter] = React.useState<"all" | "in_house" | "departed">(initialFilter)
  const [page, setPage] = React.useState<number>(1)
  const [limit, setLimit] = React.useState<number>(25)

  const handleFilterChange = (newFilter: "all" | "in_house" | "departed") => {
    setFilter(newFilter)
    setPage(1)
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(searchParams?.toString() || "")
      if (newFilter === "all") {
        sp.delete("filter")
        sp.delete("subtab")
      } else {
        sp.set("filter", newFilter)
        sp.set("subtab", newFilter)
      }
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    }
  }

  const { data, isLoading, error, refetch } = useReportQuery<ReceivablesReportDTO>({
    endpoint: "/api/reports/receivables",
    params: {
      filter,
      page,
      limit,
      propertyId,
    },
    enabled: true,
    refreshTrigger,
  })

  if (isLoading && !data) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 py-1">
          <Skeleton className="h-4 w-28" />
          <span className="text-muted-foreground/30">·</span>
          <Skeleton className="h-4 w-24" />
        </div>
        <TableSkeleton rows={6} cols={6} />
      </div>
    )
  }

  if (error && !data) {
    return (
      <ReportSectionError
        title="Failed to load receivables report"
        error={error}
        onRetry={refetch}
      />
    )
  }

  if (!data) return null

  const totalReceivablesNum = parseFloat(data.totalReceivables) || 0
  const inHouseNum = parseFloat(data.inHouseReceivables) || 0
  const departedNum = parseFloat(data.departedReceivables) || 0
  const invoiceItems = data.items || []

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Curated KPI Metric Band */}
      <ReportMetricBand
        metrics={[
          {
            label: "Total Receivables",
            value: totalReceivablesNum,
            isMoney: true,
            tone: "danger",
            subtext: `${data.totalInvoices} uncollected folios`,
          },
          {
            label: "In-House Ledger",
            value: inHouseNum,
            isMoney: true,
            subtext: `${data.inHouseCount} active in-house folios`,
          },
          {
            label: "Departed Ledger Risk",
            value: departedNum,
            isMoney: true,
            tone: departedNum > 0 ? "warning" : "default",
            subtext: `${data.departedCount} departed with balance`,
          },
          {
            label: "Departed Rate",
            value: totalReceivablesNum > 0 ? `${((departedNum / totalReceivablesNum) * 100).toFixed(0)}%` : "0%",
            subtext: "Delinquent risk share",
          },
        ]}
      />

      {/* 2. Outstanding Folios Ledger Table */}
      <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 space-y-3 shadow-xs">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-2.5">
          <h3 className="font-semibold text-foreground text-sm">Outstanding Folios</h3>

          {/* Filter Tabs */}
          <div className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => handleFilterChange("all")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                filter === "all"
                  ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({data.totalInvoices})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("in_house")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                filter === "in_house"
                  ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              In-House ({data.inHouseCount})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("departed")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                filter === "departed"
                  ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Departed ({data.departedCount})
            </button>
          </div>
        </div>

        {invoiceItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No outstanding folios found for the selected filter.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto rounded-lg border border-border/70">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
                  <tr className="border-b border-border font-medium text-muted-foreground text-[11px] font-mono uppercase tracking-wider">
                    <th className="px-3 py-2.5">Invoice / Guest</th>
                    <th className="px-3 py-2.5">Stay Status</th>
                    <th className="px-3 py-2.5 text-right">Invoiced</th>
                    <th className="px-3 py-2.5 text-right">Paid</th>
                    <th className="px-3 py-2.5 text-right">Balance Due</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {invoiceItems.map((inv) => (
                    <tr key={inv.invoiceId} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-foreground">{inv.guestName}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {inv.invoiceNumber} {inv.roomNumbers && inv.roomNumbers.length > 0 ? `· Room ${inv.roomNumbers.join(", ")}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold",
                            inv.guestStayStatus === "IN_HOUSE"
                              ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20"
                              : inv.guestStayStatus === "DEPARTED"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                              : "bg-muted text-muted-foreground border border-border"
                          )}
                        >
                          {inv.guestStayStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatMoney(parseFloat(inv.grandTotal))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {formatMoney(parseFloat(inv.totalPaid))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatMoney(parseFloat(inv.balanceDue))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/billing/${inv.invoiceId}`}
                          className="inline-flex items-center text-primary hover:underline font-medium"
                        >
                          <span>Folio</span>
                          <ChevronRight className="size-3.5 ml-0.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.pagination && data.pagination.total > 0 && (
              <div className="border-t border-border/80 pt-2">
                <PaginationFooter
                  page={page}
                  limit={limit}
                  total={data.pagination.total}
                  totalPages={data.pagination.totalPages}
                  onPageChange={setPage}
                  onLimitChange={setLimit}
                  pageSizeOptions={[10, 15, 25, 50, 100]}
                  syncUrl={false}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
