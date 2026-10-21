"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarCheck,
  Clock,
  BedDouble,
  AlertCircle,
  Phone,
  Mail,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatCard, StatusBadge } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { DailyOperationsReportDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "./use-report-query"
import { ReportSectionError, StatCardsSkeleton, TableSkeleton } from "./report-section-shell"

interface DailyOpsTabProps {
  initialTodayDate: string
  initialOpsSubTab?: "arrivals" | "departures" | "in_house" | "pending"
  propertyId?: string
  refreshTrigger?: number
}

export function DailyOpsTab({
  initialTodayDate,
  initialOpsSubTab = "arrivals",
  propertyId,
  refreshTrigger = 0,
}: DailyOpsTabProps) {
  const [opsDate, setOpsDate] = React.useState<string>(initialTodayDate)
  const [opsSubTab, setOpsSubTab] = React.useState<"arrivals" | "departures" | "in_house" | "pending">(initialOpsSubTab)

  const { data, isLoading, error, refetch } = useReportQuery<DailyOperationsReportDTO>({
    endpoint: "/api/reports/daily-operations",
    params: {
      date: opsDate,
      propertyId,
    },
    enabled: true,
    refreshTrigger,
  })

  const currentOpsList = !data
    ? []
    : opsSubTab === "arrivals"
    ? data.arrivals
    : opsSubTab === "departures"
    ? data.departures
    : opsSubTab === "in_house"
    ? data.inHouse
    : data.pendingArrivals

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Label htmlFor="opsDate" className="whitespace-nowrap font-medium">
            Shift Date:
          </Label>
          <Input
            id="opsDate"
            type="date"
            value={opsDate}
            onChange={(e) => setOpsDate(e.target.value)}
            className="w-44"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date().toISOString().split("T")[0]!
              setOpsDate(today)
            }}
          >
            Today
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Showing reception shift operations for <span className="font-semibold text-foreground">{opsDate}</span>
        </div>
      </div>

      {isLoading && !data && (
        <div className="space-y-4">
          <StatCardsSkeleton count={4} />
          <TableSkeleton rows={5} cols={7} />
        </div>
      )}

      {error && !data && (
        <ReportSectionError
          title="Failed to load daily operations"
          error={error}
          onRetry={refetch}
        />
      )}

      {data && (
        <>
          {/* Daily Ops KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="Expected Arrivals"
              value={data.summary.expectedArrivalsCount}
              subtext={`${data.summary.checkedInArrivalsCount} already checked in`}
              icon={<CalendarCheck className="size-4" />}
            />
            <StatCard
              label="Expected Departures"
              value={data.summary.expectedDeparturesCount}
              subtext={`${data.summary.checkedOutDeparturesCount} checked out`}
              icon={<Clock className="size-4" />}
            />
            <StatCard
              label="In-House Guests"
              value={data.summary.inHouseCount}
              subtext={`₹${data.summary.totalInHouseBalanceDue} pending balance`}
              icon={<BedDouble className="size-4" />}
            />
            <StatCard
              label="Pending / No-Shows"
              value={data.summary.pendingArrivalsCount}
              subtext="Overdue check-ins"
              icon={<AlertCircle className="size-4" />}
            />
          </div>

          {/* Operations Sub-Tabs */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <button
                onClick={() => setOpsSubTab("arrivals")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  opsSubTab === "arrivals"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                Today&apos;s Arrivals ({data.arrivals.length})
              </button>
              <button
                onClick={() => setOpsSubTab("departures")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  opsSubTab === "departures"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                Today&apos;s Departures ({data.departures.length})
              </button>
              <button
                onClick={() => setOpsSubTab("in_house")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  opsSubTab === "in_house"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                In-House Guests ({data.inHouse.length})
              </button>
              <button
                onClick={() => setOpsSubTab("pending")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  opsSubTab === "pending"
                    ? "bg-amber-600 text-white"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                Overdue / No-Shows ({data.pendingArrivals.length})
              </button>
            </div>

            {/* Shift Operations Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Guest & Contact</th>
                    <th className="px-4 py-3">Dates & Stay</th>
                    <th className="px-4 py-3">Nightly Rate</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Invoice & Balance</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {currentOpsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No records found for this operational filter on {opsDate}.
                      </td>
                    </tr>
                  ) : (
                    currentOpsList.map((item) => {
                      const hasBalance =
                        item.invoiceBalanceDue && parseFloat(item.invoiceBalanceDue) > 0
                      return (
                        <tr key={item.allocationId} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">
                              Room {item.roomNo}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.roomCategoryName} • {item.buildingName} F{item.floorNo}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {item.guestName}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {item.guestPhone && (
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="size-3" /> {item.guestPhone}
                                </span>
                              )}
                              {item.guestEmail && (
                                <span className="inline-flex items-center gap-1">
                                  <Mail className="size-3" /> {item.guestEmail}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="text-xs">
                              <span className="font-medium">{item.arrivalDate}</span> →{" "}
                              <span className="font-medium">{item.departureDate}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.stayNights} night{item.stayNights > 1 ? "s" : ""}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-medium">
                            {formatMoney(parseFloat(item.bookedNightlyRate) || 0)}
                          </td>

                          <td className="px-4 py-3">
                            <StatusBadge status={item.allocationStatus} />
                          </td>

                          <td className="px-4 py-3">
                            {item.invoiceNumber ? (
                              <div>
                                <div className="text-xs font-mono font-medium">
                                  {item.invoiceNumber}
                                </div>
                                <div className="text-xs">
                                  {hasBalance ? (
                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                      Balance: {formatMoney(parseFloat(item.invoiceBalanceDue!) || 0)}
                                    </span>
                                  ) : (
                                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                      Fully Paid
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No Invoice</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {item.invoiceId && hasBalance && (
                                <Link
                                  href={`/billing/${item.invoiceId}`}
                                  className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                                >
                                  Collect
                                </Link>
                              )}
                              <Link
                                href={`/reservations/${item.reservationId}`}
                                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium hover:bg-muted/80"
                              >
                                View
                                <ExternalLink className="size-3" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
