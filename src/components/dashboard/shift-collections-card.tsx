import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, Wallet } from "lucide-react"
import { ReportsService } from "@/modules/reports/reports.service"
import { getHotelTodayDate } from "@/lib/date"
import { formatMoney } from "@/lib/currency"
import { Skeleton } from "@/components/ui/skeleton"
import type { ShiftCollectionsReportDTO, PaymentTransactionDTO } from "@/modules/reports/reports.types"

interface ShiftCollectionsCardProps {
  propertyId?: string
  initialData?: ShiftCollectionsReportDTO
}

export async function ShiftCollectionsCard({ propertyId, initialData }: ShiftCollectionsCardProps) {
  const todayStr = getHotelTodayDate()

  let collections: ShiftCollectionsReportDTO = initialData || {
    targetDate: todayStr,
    totalCollected: "0.00",
    totalTransactions: 0,
    methodBreakdown: [],
    staffBreakdown: [],
    transactions: [],
  }

  if (!initialData) {
    try {
      collections = await ReportsService.getShiftCollections(
        todayStr,
        undefined,
        undefined,
        undefined,
        propertyId
      )
    } catch (err) {
      console.error("Failed to load shift collections in ShiftCollectionsCard:", err)
    }
  }

  const totalCollectedNum = parseFloat(collections.totalCollected) || 0
  const recentTx: PaymentTransactionDTO[] = (collections.transactions || []).slice(0, 3)
  const methods = collections.methodBreakdown || []

  return (
    <Link
      href="/billing"
      className="block group rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 hover:border-primary/50 hover:bg-muted/15 transition-all shadow-2xs space-y-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      title="View all billing and receipts"
    >
      {/* Heading */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            Shift Collections
          </h2>
        </div>
        <ArrowUpRight className="size-3.5 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>

      {/* Prominent Collected Amount & Payment Count */}
      <div className="space-y-0.5">
        <div className="text-xl sm:text-2xl font-extrabold font-mono text-foreground tracking-tight tabular-nums">
          {formatMoney(totalCollectedNum)}
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          {collections.totalTransactions} {collections.totalTransactions === 1 ? "receipt" : "receipts"} recorded today
        </div>
      </div>

      {/* Compact Payment Method Breakdown */}
      {methods.length > 0 && totalCollectedNum > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/50">
          <div className="h-1.5 w-full rounded-full bg-muted/60 flex overflow-hidden gap-0.5">
            {methods.map((pm) => {
              const amount = parseFloat(pm.amount) || 0
              const pct = (amount / totalCollectedNum) * 100
              if (pct <= 0) return null
              const isCash = pm.method.toUpperCase() === "CASH"
              const isUPI = pm.method.toUpperCase() === "UPI"
              const color = isCash ? "bg-emerald-500" : isUPI ? "bg-sky-500" : "bg-purple-500"
              return (
                <div
                  key={pm.method}
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${pct}%` }}
                />
              )
            })}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono text-muted-foreground">
            {methods.map((pm) => (
              <span key={pm.method}>
                <span className="font-medium text-foreground">{pm.method}</span>:{" "}
                {formatMoney(parseFloat(pm.amount) || 0)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Maximum 2-3 Compact Recent Transactions (only when they exist) */}
      {recentTx.length > 0 && (
        <div className="pt-2 border-t border-border/50 space-y-1">
          {recentTx.map((tx) => (
            <div
              key={tx.paymentId}
              className="flex items-center justify-between text-xs py-1"
            >
              <div className="truncate max-w-[170px]">
                <span className="font-medium text-foreground block truncate">
                  {tx.guestName || "Walk-In Guest"}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {tx.paymentMethod}
                </span>
              </div>
              <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{formatMoney(parseFloat(tx.amount) || 0)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}

export function ShiftCollectionsSkeleton() {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3.5 w-3.5" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  )
}
