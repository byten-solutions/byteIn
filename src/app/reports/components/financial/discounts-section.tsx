"use client"

import * as React from "react"
import Link from "next/link"
import { Tag, Percent, ArrowDownRight, ExternalLink } from "lucide-react"
import { StatCard, PaginationFooter } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { DiscountsReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, StatCardsSkeleton, TableSkeleton } from "../report-section-shell"

interface DiscountsSectionProps {
  startDate?: string
  endDate?: string
  propertyId?: string
  refreshTrigger?: number
}

export function DiscountsSection({
  startDate,
  endDate,
  propertyId,
  refreshTrigger,
}: DiscountsSectionProps) {
  const [activeSubTab, setActiveSubTab] = React.useState<"invoices" | "overrides">("invoices")
  const [page, setPage] = React.useState<number>(1)
  const [limit, setLimit] = React.useState<number>(25)

  const { data, isLoading, error, refetch } = useReportQuery<DiscountsReportDTO>({
    endpoint: "/api/reports/discounts",
    params: {
      startDate,
      endDate,
      propertyId,
      page,
      limit,
    },
    enabled: true,
    refreshTrigger,
  })

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <StatCardsSkeleton count={3} />
        <TableSkeleton rows={4} cols={5} />
      </div>
    )
  }

  if (error && !data) {
    return (
      <ReportSectionError
        title="Failed to load discounts and concessions"
        error={error}
        onRetry={refetch}
      />
    )
  }

  if (!data) return null

  const summary = data.summary
  const invoiceDiscounts = data.invoiceDiscounts || []
  const rateOverrides = data.rateOverrides || []

  return (
    <div className="space-y-6">
      {/* Concession KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Total Invoice Discounts"
          value={formatMoney(parseFloat(summary.totalInvoiceDiscounts) || 0)}
          subtext={`${summary.discountedInvoicesCount} invoices with applied discounts`}
          icon={<Tag className="size-4" />}
        />
        <StatCard
          label="Rate Overrides Impact"
          value={formatMoney(parseFloat(summary.totalRateOverrideDiscounts) || 0)}
          subtext={`${summary.rateOverridesCount} rooms booked below rack rate`}
          icon={<ArrowDownRight className="size-4" />}
        />
        <StatCard
          label="Total Concession Impact"
          value={formatMoney(parseFloat(summary.totalConcessionImpact) || 0)}
          subtext="Total revenue forgone"
          icon={<Percent className="size-4" />}
        />
      </div>

      {/* Itemized Concessions Shell */}
      <div className="rounded-xl border border-border bg-card space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-semibold text-foreground">Discounts & Concessions Breakdown</h3>
            <p className="text-xs text-muted-foreground">
              Itemized ledger of custom manual invoice discounts and lower-than-rack nightly rates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveSubTab("invoices")
                setPage(1)
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeSubTab === "invoices"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Invoice Discounts ({summary.discountedInvoicesCount})
            </button>
            <button
              onClick={() => {
                setActiveSubTab("overrides")
                setPage(1)
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeSubTab === "overrides"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Rate Overrides ({summary.rateOverridesCount})
            </button>
          </div>
        </div>

        {/* Tab 1: Invoice Discounts */}
        {activeSubTab === "invoices" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <th className="px-3 py-2">Invoice / Res No</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Discount Items / Reasons</th>
                  <th className="px-3 py-2 text-right">Discount Total</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoiceDiscounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No invoice discounts applied during this period.
                    </td>
                  </tr>
                ) : (
                  invoiceDiscounts.map((inv) => (
                    <tr key={inv.invoiceId} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <div className="font-mono font-medium">{inv.invoiceNumber}</div>
                        <div className="text-[11px] text-muted-foreground">{inv.reservationNo}</div>
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">
                        {inv.customerName}
                      </td>
                      <td className="px-3 py-2">
                        <div className="space-y-0.5">
                          {inv.items.map((it, idx) => (
                            <div key={idx} className="text-[11px]">
                              <span className="font-medium text-foreground">{it.description}</span>:{" "}
                              <span className="text-rose-600 dark:text-rose-400">
                                {formatMoney(parseFloat(it.lineTotal) || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-rose-600 dark:text-rose-400">
                        {formatMoney(parseFloat(inv.discountTotal) || 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/billing/${inv.invoiceId}`}
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] font-medium hover:bg-muted/80"
                        >
                          View
                          <ExternalLink className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Rate Overrides */}
        {activeSubTab === "overrides" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <th className="px-3 py-2">Res No</th>
                  <th className="px-3 py-2">Room & Category</th>
                  <th className="px-3 py-2">Rack Rate</th>
                  <th className="px-3 py-2">Booked Rate</th>
                  <th className="px-3 py-2">Nightly Variance</th>
                  <th className="px-3 py-2">Stay Nights</th>
                  <th className="px-3 py-2 text-right">Total Concession</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rateOverrides.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      No rate overrides detected during this period.
                    </td>
                  </tr>
                ) : (
                  rateOverrides.map((ov) => (
                    <tr key={ov.allocationId} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <Link
                          href={`/reservations/${ov.reservationId}`}
                          className="font-mono font-medium text-primary hover:underline"
                        >
                          {ov.reservationNo}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-foreground">Room {ov.roomNo}</div>
                        <div className="text-[11px] text-muted-foreground">{ov.categoryName}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatMoney(parseFloat(ov.basePrice) || 0)}
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">
                        {formatMoney(parseFloat(ov.bookedRate) || 0)}
                      </td>
                      <td className="px-3 py-2 font-medium text-rose-600 dark:text-rose-400">
                        -{formatMoney(parseFloat(ov.rateVariance) || 0)}/nt
                      </td>
                      <td className="px-3 py-2">{ov.nights} nt{ov.nights > 1 ? "s" : ""}</td>
                      <td className="px-3 py-2 text-right font-semibold text-rose-600 dark:text-rose-400">
                        -{formatMoney(parseFloat(ov.totalVariance) || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

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
