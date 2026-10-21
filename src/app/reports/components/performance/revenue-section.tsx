"use client"

import * as React from "react"
import { CreditCard, Receipt, Wallet, Layers } from "lucide-react"
import { StatCard } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import type { RevenueReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, StatCardsSkeleton, TableSkeleton } from "../report-section-shell"

interface RevenueSectionProps {
  startDate: string
  endDate: string
  propertyId?: string
  refreshTrigger?: number
}

export function RevenueSection({
  startDate,
  endDate,
  propertyId,
  refreshTrigger,
}: RevenueSectionProps) {
  const { data, isLoading, error, refetch } = useReportQuery<RevenueReportDTO>({
    endpoint: "/api/reports/revenue",
    params: {
      startDate,
      endDate,
      propertyId,
    },
    enabled: true,
    refreshTrigger,
  })

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <StatCardsSkeleton count={3} />
        <TableSkeleton rows={3} cols={3} />
      </div>
    )
  }

  if (error && !data) {
    return (
      <ReportSectionError
        title="Failed to load revenue and billing summary"
        error={error}
        onRetry={refetch}
      />
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Revenue KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Total Invoiced"
          value={formatMoney(parseFloat(data.totalInvoiced) || 0)}
          subtext={`${data.invoiceCount} generated folios`}
          icon={<Receipt className="size-4" />}
        />
        <StatCard
          label="Total Collected"
          value={formatMoney(parseFloat(data.totalCollected) || 0)}
          subtext={`${data.paymentCount} settled payments`}
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Total Outstanding"
          value={formatMoney(parseFloat(data.totalOutstanding) || 0)}
          subtext="Net unsettled folios"
          icon={<CreditCard className="size-4" />}
        />
      </div>

      {/* Multi-Property Revenue Comparison (when available) */}
      {data.propertyBreakdown && data.propertyBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="border-b border-border pb-2">
            <h3 className="font-semibold text-foreground">Multi-Property Revenue Comparison</h3>
            <p className="text-xs text-muted-foreground">Portfolio revenue generation across hotels</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <th className="px-3 py-2">Hotel Property</th>
                  <th className="px-3 py-2 text-right">Total Invoiced</th>
                  <th className="px-3 py-2 text-right">Total Collected</th>
                  <th className="px-3 py-2 text-right">Occupancy %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.propertyBreakdown.map((pb) => (
                  <tr key={pb.propertyId} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium text-foreground">{pb.propertyName}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatMoney(parseFloat(pb.totalInvoiced || "0") || 0)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(parseFloat(pb.totalCollected || "0") || 0)}
                    </td>
                    <td className="px-3 py-2 text-right">{pb.occupancyRate ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By Payment Method */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="border-b border-border pb-2">
            <h3 className="font-semibold text-foreground">Revenue by Payment Method</h3>
          </div>
          {data.paymentMethodBreakdown.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No payments collected during this period.
            </div>
          ) : (
            <div className="space-y-3">
              {data.paymentMethodBreakdown.map((pm) => (
                <div key={pm.method} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="size-3.5 text-muted-foreground" />
                      {pm.method} ({pm.count})
                    </span>
                    <span>{formatMoney(parseFloat(pm.amount) || 0)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(100, pm.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Charge Type */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="border-b border-border pb-2">
            <h3 className="font-semibold text-foreground">Charges Breakdown (Folio Line Types)</h3>
          </div>
          {data.chargeTypeBreakdown.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No itemized charges during this period.
            </div>
          ) : (
            <div className="space-y-3">
              {data.chargeTypeBreakdown.map((ct) => (
                <div key={ct.itemType} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                      <Layers className="size-3.5 text-muted-foreground" />
                      {ct.itemType.replace(/_/g, " ")}
                    </span>
                    <span>{formatMoney(parseFloat(ct.amount) || 0)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, ct.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
