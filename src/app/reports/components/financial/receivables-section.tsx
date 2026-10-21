"use client"

import * as React from "react"
import Link from "next/link"
import { Receipt, BedDouble, ShieldAlert, ChevronRight } from "lucide-react"
import { StatCard, PaginationFooter } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { ReceivablesReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, StatCardsSkeleton, TableSkeleton } from "../report-section-shell"

interface ReceivablesSectionProps {
  propertyId?: string
  refreshTrigger?: number
}

export function ReceivablesSection({ propertyId, refreshTrigger }: ReceivablesSectionProps) {
  const [filter, setFilter] = React.useState<"all" | "in_house" | "departed">("all")
  const [page, setPage] = React.useState<number>(1)
  const [limit, setLimit] = React.useState<number>(25)

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
      <div className="space-y-4">
        <StatCardsSkeleton count={3} />
        <TableSkeleton rows={5} cols={8} />
      </div>
    )
  }

  if (error && !data) {
    return (
      <ReportSectionError
        title="Failed to load outstanding receivables"
        error={error}
        onRetry={refetch}
      />
    )
  }

  if (!data) return null

  const items = data.items || []

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Total Receivables"
          value={formatMoney(parseFloat(data.totalReceivables) || 0)}
          subtext={`${data.totalInvoices} unpaid folios`}
          icon={<Receipt className="size-4" />}
        />
        <StatCard
          label="In-House Receivables"
          value={formatMoney(parseFloat(data.inHouseReceivables) || 0)}
          subtext={`${data.inHouseCount} staying guests`}
          icon={<BedDouble className="size-4" />}
        />
        <StatCard
          label="Departed Debtors"
          value={formatMoney(parseFloat(data.departedReceivables) || 0)}
          subtext={`${data.departedCount} unpaid after checkout`}
          icon={<ShieldAlert className="size-4" />}
        />
      </div>

      {/* Receivables & Aging Report Shell */}
      <div className="rounded-xl border border-border bg-card space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-semibold text-foreground">Outstanding Balances & Aging</h3>
            <p className="text-xs text-muted-foreground">
              All active uncollected folios categorized by aging and guest stay status.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setFilter("all")
                setPage(1)
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              All ({data.totalInvoices})
            </button>
            <button
              onClick={() => {
                setFilter("in_house")
                setPage(1)
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filter === "in_house" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              In-House ({data.inHouseCount})
            </button>
            <button
              onClick={() => {
                setFilter("departed")
                setPage(1)
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filter === "departed" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Departed ({data.departedCount})
            </button>
          </div>
        </div>

        {/* Aging Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/40 p-2.5 text-center">
            <div className="text-[11px] text-muted-foreground">0 - 7 Days (Current)</div>
            <div className="text-sm font-semibold text-foreground">
              {formatMoney(parseFloat(data.agingSummary.bucket0to7) || 0)}
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5 text-center">
            <div className="text-[11px] text-muted-foreground">8 - 30 Days</div>
            <div className="text-sm font-semibold text-foreground">
              {formatMoney(parseFloat(data.agingSummary.bucket8to30) || 0)}
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5 text-center">
            <div className="text-[11px] text-muted-foreground">31 - 60 Days</div>
            <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              {formatMoney(parseFloat(data.agingSummary.bucket31to60) || 0)}
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5 text-center">
            <div className="text-[11px] text-muted-foreground">60+ Days (Delinquent)</div>
            <div className="text-sm font-semibold text-rose-600 dark:text-rose-400">
              {formatMoney(parseFloat(data.agingSummary.bucket60Plus) || 0)}
            </div>
          </div>
        </div>

        {/* Receivables Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <th className="px-3 py-2">Invoice / Res No</th>
                <th className="px-3 py-2">Guest Name & Phone</th>
                <th className="px-3 py-2">Rooms</th>
                <th className="px-3 py-2">Guest Status</th>
                <th className="px-3 py-2">Aging</th>
                <th className="px-3 py-2">Grand Total</th>
                <th className="px-3 py-2">Balance Due</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    No outstanding balances in this view.
                  </td>
                </tr>
              ) : (
                items.map((rec) => (
                  <tr key={rec.invoiceId} className="hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="font-mono font-medium">{rec.invoiceNumber}</div>
                      <div className="text-[11px] text-muted-foreground">{rec.reservationNo}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{rec.guestName}</div>
                      <div className="text-[11px] text-muted-foreground">{rec.guestPhone || "No phone"}</div>
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {rec.roomNumbers.join(", ") || "N/A"}
                    </td>
                    <td className="px-3 py-2">
                      {rec.isGuestInHouse ? (
                        <span className="inline-flex rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                          In-House
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                          Departed
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "font-medium",
                          rec.daysAging > 30 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                        )}
                      >
                        {rec.daysAging} days ({rec.agingBucket})
                      </span>
                    </td>
                    <td className="px-3 py-2">{formatMoney(parseFloat(rec.grandTotal) || 0)}</td>
                    <td className="px-3 py-2 font-semibold text-amber-600 dark:text-amber-400">
                      {formatMoney(parseFloat(rec.balanceDue) || 0)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/billing/${rec.invoiceId}`}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Collect
                        <ChevronRight className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data.pagination && data.pagination.total > 10 && (
          <PaginationFooter
            page={page}
            limit={limit}
            total={data.pagination.total}
            onPageChange={setPage}
            onLimitChange={(newLimit) => {
              setLimit(newLimit)
              setPage(1)
            }}
          />
        )}
      </div>
    </div>
  )
}
