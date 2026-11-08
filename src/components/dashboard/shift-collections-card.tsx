import * as React from "react"
import Link from "next/link"
import { Wallet, ArrowUpRight, CreditCard, Banknote, Smartphone } from "lucide-react"
import { ReportsService } from "@/modules/reports/reports.service"
import { getHotelTodayDate } from "@/lib/date"
import { formatMoney } from "@/lib/currency"
import { Skeleton } from "@/components/ui/skeleton"
import type { ShiftCollectionsReportDTO, PaymentTransactionDTO } from "@/modules/reports/reports.types"

interface ShiftCollectionsCardProps {
  propertyId?: string
}

function getMethodIcon(method: string) {
  const m = method.toUpperCase()
  if (m === "CASH") return <Banknote className="size-3 text-emerald-600 dark:text-emerald-400" />
  if (m === "UPI") return <Smartphone className="size-3 text-sky-600 dark:text-sky-400" />
  return <CreditCard className="size-3 text-purple-600 dark:text-purple-400" />
}

export async function ShiftCollectionsCard({ propertyId }: ShiftCollectionsCardProps) {
  const todayStr = getHotelTodayDate()

  let collections: ShiftCollectionsReportDTO = {
    targetDate: todayStr,
    totalCollected: "0.00",
    totalTransactions: 0,
    methodBreakdown: [],
    staffBreakdown: [],
    transactions: [],
  }

  try {
    collections = await ReportsService.getShiftCollections(todayStr, propertyId)
  } catch (err) {
    console.error("Failed to load shift collections in ShiftCollectionsCard:", err)
  }

  const totalCollectedNum = parseFloat(collections.totalCollected) || 0
  const recentTx: PaymentTransactionDTO[] = (collections.transactions || []).slice(0, 4)
  const methods = collections.methodBreakdown || []

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-semibold text-sm text-foreground">Shift Drawer & Collections</h3>
        </div>
        <Link
          href="/billing"
          className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors inline-flex items-center gap-0.5"
        >
          <span>Billing</span>
          <ArrowUpRight className="size-3" />
        </Link>
      </div>

      {/* Primary KPI Callout */}
      <div className="space-y-0.5">
        <span className="text-xs text-muted-foreground font-medium">Today&apos;s Front Desk Realization</span>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight tabular-nums">
            {formatMoney(totalCollectedNum)}
          </span>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            ({collections.totalTransactions} payment{collections.totalTransactions === 1 ? "" : "s"})
          </span>
        </div>
      </div>

      {/* Payment Method Distribution Bar or Drawer Readiness */}
      {methods.length > 0 && totalCollectedNum > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Method Distribution</span>
            <span className="font-mono">{methods.length} methods</span>
          </div>
          <div className="h-2 w-full rounded-md bg-muted/60 flex overflow-hidden gap-0.5 p-0.5">
            {methods.map((pm) => {
              const amount = parseFloat(pm.amount) || 0
              const pct = totalCollectedNum > 0 ? (amount / totalCollectedNum) * 100 : 0
              if (pct <= 0) return null
              const isCash = pm.method.toUpperCase() === "CASH"
              const isUPI = pm.method.toUpperCase() === "UPI"
              const colorClass = isCash ? "bg-emerald-500" : isUPI ? "bg-sky-500" : "bg-purple-500"

              return (
                <div
                  key={pm.method}
                  className={`h-full rounded-xs transition-all ${colorClass}`}
                  style={{ width: `${pct}%` }}
                  title={`${pm.method}: ${formatMoney(amount)} (${Math.round(pct)}%)`}
                />
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg bg-muted/20 border border-dashed border-border/60 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Cash Drawer</span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Ready for receipts
          </span>
        </div>
      )}

      {/* Recent Shift Payments List */}
      <div className="space-y-2 pt-1 border-t border-border/60">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Recent Payments</span>
          <Link href="/billing" className="text-[11px] text-primary hover:underline font-mono">
            View All ({collections.totalTransactions})
          </Link>
        </div>

        {recentTx.length === 0 ? (
          <div className="py-2 px-3 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/60">
            No payments recorded yet today
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentTx.map((tx) => (
              <div
                key={tx.paymentId}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <div className="size-6 rounded-md bg-card border border-border flex items-center justify-center shrink-0">
                    {getMethodIcon(tx.paymentMethod)}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-semibold text-foreground block truncate">
                      {tx.guestName || "Walk-In Guest"}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono block truncate">
                      #{tx.reservationNo || tx.invoiceNumber} · {tx.paymentMethod}
                    </span>
                  </div>
                </div>

                <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                  +{formatMoney(parseFloat(tx.amount) || 0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function ShiftCollectionsSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs flex flex-col">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-44" />
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
      <div className="space-y-2 pt-1 border-t border-border/60">
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    </div>
  )
}
