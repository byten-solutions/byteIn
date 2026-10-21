"use client"

import * as React from "react"
import { Wallet, CreditCard, Users, Receipt } from "lucide-react"
import { StatCard, PaginationFooter } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import type { ShiftCollectionsReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "../use-report-query"
import { ReportSectionError, StatCardsSkeleton, TableSkeleton } from "../report-section-shell"

interface CollectionsSectionProps {
  date: string
  propertyId?: string
  refreshTrigger?: number
}

export function CollectionsSection({ date, propertyId, refreshTrigger }: CollectionsSectionProps) {
  const [page, setPage] = React.useState<number>(1)
  const [limit, setLimit] = React.useState<number>(25)

  const { data, isLoading, error, refetch } = useReportQuery<ShiftCollectionsReportDTO>({
    endpoint: "/api/reports/collections",
    params: {
      date,
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
        <StatCardsSkeleton count={4} />
        <TableSkeleton rows={4} cols={3} />
      </div>
    )
  }

  if (error && !data) {
    return (
      <ReportSectionError
        title="Failed to load shift collections"
        error={error}
        onRetry={refetch}
      />
    )
  }

  if (!data) return null

  const totalCollectedNum = parseFloat(data.totalCollected) || 0

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Shift Collections"
          value={formatMoney(totalCollectedNum)}
          subtext={`${data.totalTransactions} recorded payments`}
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Total Transactions"
          value={data.totalTransactions}
          subtext={`On ${data.targetDate || date}`}
          icon={<Receipt className="size-4" />}
        />
        <StatCard
          label="Payment Methods"
          value={data.methodBreakdown.length}
          subtext="Active payment tenders"
          icon={<CreditCard className="size-4" />}
        />
        <StatCard
          label="Staff Handlers"
          value={data.staffBreakdown.length}
          subtext="Cashier accountability"
          icon={<Users className="size-4" />}
        />
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By Payment Method */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-semibold text-foreground">Shift Collections by Method</h3>
            <span className="text-xs text-muted-foreground">
              Total: {formatMoney(totalCollectedNum)}
            </span>
          </div>

          {data.methodBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No payments recorded for this shift date.
            </div>
          ) : (
            <div className="space-y-3">
              {data.methodBreakdown.map((pm) => (
                <div key={pm.method} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="size-3.5 text-muted-foreground" />
                      {pm.method} ({pm.count})
                    </span>
                    <span>{formatMoney(parseFloat(pm.amount))}</span>
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

        {/* By Front Desk Staff */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-semibold text-foreground">Collections by Staff User</h3>
            <span className="text-xs text-muted-foreground">Shift Accountability</span>
          </div>

          {data.staffBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No staff payment entries recorded on {date}.
            </div>
          ) : (
            <div className="space-y-3">
              {data.staffBreakdown.map((staff) => (
                <div
                  key={staff.userId}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3"
                >
                  <div>
                    <div className="font-medium text-foreground">{staff.userName}</div>
                    <div className="text-xs text-muted-foreground">
                      {staff.paymentCount} payments • {staff.userEmail}
                    </div>
                  </div>
                  <div className="text-right font-semibold text-foreground">
                    {formatMoney(parseFloat(staff.totalCollected))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Paginated Transactions Table */}
      {data.transactions && data.transactions.length > 0 && (
        <div className="rounded-xl border border-border bg-card space-y-4 p-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div>
              <h3 className="font-semibold text-foreground">Shift Transactions Log</h3>
              <p className="text-xs text-muted-foreground">Itemized payments collected during this shift</p>
            </div>
            {data.pagination && (
              <span className="text-xs text-muted-foreground">
                Total: {data.pagination.total} transaction{data.pagination.total === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <th className="px-3 py-2">Receipt / Invoice</th>
                  <th className="px-3 py-2">Guest Name</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Staff</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.transactions.map((tx) => (
                  <tr key={tx.paymentId} className="hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="font-mono font-medium">{tx.receiptNumber}</div>
                      <div className="text-[11px] text-muted-foreground">{tx.invoiceNumber}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{tx.guestName}</div>
                      {tx.roomNumbers.length > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          Room {tx.roomNumbers.join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                        {tx.paymentMethod}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {tx.recordedByUserName}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(parseFloat(tx.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
      )}
    </div>
  )
}
