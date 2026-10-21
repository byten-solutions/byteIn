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
  Search,
  Printer,
  X,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatCard, StatusBadge, PaginationFooter } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type {
  DailyOperationsCountsDTO,
  DailyOperationsListDTO,
  DailyOperationItemDTO,
} from "@/modules/reports/reports.types"
import { useReportQuery } from "./use-report-query"
import { ReportSectionError, StatCardsSkeleton, TableSkeleton } from "./report-section-shell"

type OpsSubTab = "arrivals" | "departures" | "in-house" | "overdue"

interface DailyOpsTabProps {
  initialTodayDate: string
  initialOpsSubTab?: string
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

  const normalizeInitialSubTab = (subtab: string): OpsSubTab => {
    if (subtab === "in_house") return "in-house"
    if (subtab === "pending") return "overdue"
    if (subtab === "departures") return "departures"
    if (subtab === "in-house") return "in-house"
    if (subtab === "overdue") return "overdue"
    return "arrivals"
  }

  const [activeSubTab, setActiveSubTab] = React.useState<OpsSubTab>(() =>
    normalizeInitialSubTab(initialOpsSubTab)
  )

  const [q, setQ] = React.useState<string>("")
  const [debouncedQ, setDebouncedQ] = React.useState<string>("")
  const [page, setPage] = React.useState<number>(1)
  const [limit, setLimit] = React.useState<number>(25)

  // Print mode state
  const [isPrinting, setIsPrinting] = React.useState<boolean>(false)
  const [printData, setPrintData] = React.useState<{ rows: DailyOperationItemDTO[]; total: number } | null>(null)

  // Debounce search input (300ms)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  // 1. Counts query (target < 30ms)
  const {
    data: countsData,
    isLoading: isCountsLoading,
    error: countsError,
    refetch: refetchCounts,
  } = useReportQuery<DailyOperationsCountsDTO>({
    endpoint: "/api/reports/daily-operations/counts",
    params: {
      date: opsDate,
      propertyId,
    },
    enabled: true,
    refreshTrigger,
  })

  // 2. Active subtab items query (paged, target < 150ms)
  const {
    data: listData,
    isLoading: isListLoading,
    error: listError,
    refetch: refetchList,
  } = useReportQuery<DailyOperationsListDTO>({
    endpoint: "/api/reports/daily-operations/list",
    params: {
      type: activeSubTab,
      date: opsDate,
      propertyId,
      q: debouncedQ,
      page,
      limit,
    },
    enabled: true,
    refreshTrigger,
  })

  // Handle Tab Change
  const handleSubTabChange = (newTab: OpsSubTab) => {
    setActiveSubTab(newTab)
    setPage(1)
    setPrintData(null)
  }

  // Handle on-demand Print (caps at 2,000 rows)
  const handlePrintClick = async () => {
    setIsPrinting(true)
    try {
      const propParam = propertyId ? `&propertyId=${encodeURIComponent(propertyId)}` : ""
      const qParam = debouncedQ ? `&q=${encodeURIComponent(debouncedQ)}` : ""
      const res = await fetch(
        `/api/reports/daily-operations/list?type=${activeSubTab}&date=${opsDate}${propParam}${qParam}&page=1&limit=2000`
      )
      if (!res.ok) throw new Error("Failed to load records for print")
      const json = await res.json()
      if (json.success && json.data) {
        setPrintData({
          rows: json.data.rows,
          total: json.data.total,
        })
        // Allow state to render before triggering browser print dialog
        setTimeout(() => {
          window.print()
          setIsPrinting(false)
        }, 300)
      }
    } catch {
      setIsPrinting(false)
    }
  }

  const rows = printData ? printData.rows : listData?.rows || []
  const total = printData ? printData.total : listData?.total || 0

  return (
    <div className="space-y-6">
      {/* Date & Search Control Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="opsDate" className="whitespace-nowrap font-medium text-xs">
            Shift Date:
          </Label>
          <Input
            id="opsDate"
            type="date"
            value={opsDate}
            onChange={(e) => {
              setOpsDate(e.target.value)
              setPage(1)
            }}
            className="w-40 text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date().toISOString().split("T")[0]!
              setOpsDate(today)
              setPage(1)
            }}
            className="h-8 text-xs"
          >
            Today
          </Button>

          {/* Search Input (guest name, reservation #, room #) */}
          <div className="relative w-56 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter guest, res #, room..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={isPrinting}
            onClick={handlePrintClick}
            className="gap-1.5 h-8 text-xs"
          >
            <Printer className="size-3.5" />
            {isPrinting ? "Preparing..." : "Print Active Tab"}
          </Button>

          <span className="text-xs text-muted-foreground hidden lg:inline">
            Shift: <span className="font-semibold text-foreground">{opsDate}</span>
          </span>
        </div>
      </div>

      {/* 1. Four KPI Badges / Stat Cards */}
      {isCountsLoading && !countsData ? (
        <StatCardsSkeleton count={4} />
      ) : countsError && !countsData ? (
        <ReportSectionError
          title="Failed to load daily operational counts"
          error={countsError}
          onRetry={refetchCounts}
        />
      ) : countsData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Expected Arrivals"
            value={countsData.arrivals}
            subtext={`${countsData.checkedInArrivals} already checked in`}
            icon={<CalendarCheck className="size-4" />}
          />
          <StatCard
            label="Expected Departures"
            value={countsData.departures}
            subtext={`${countsData.checkedOutDepartures} checked out`}
            icon={<Clock className="size-4" />}
          />
          <StatCard
            label="In-House Guests"
            value={countsData.inHouse}
            subtext="Active staying guests"
            icon={<BedDouble className="size-4" />}
          />
          <StatCard
            label="Pending / No-Shows"
            value={countsData.overdue}
            subtext="Overdue check-ins"
            icon={<AlertCircle className="size-4" />}
          />
        </div>
      ) : null}

      {/* 2. Operations Sub-Tabs Navigation */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3 print:hidden">
          <button
            onClick={() => handleSubTabChange("arrivals")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeSubTab === "arrivals"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            Today&apos;s Arrivals
            {countsData && (
              <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.2 text-[10px] font-semibold">
                {countsData.arrivals}
              </span>
            )}
          </button>

          <button
            onClick={() => handleSubTabChange("departures")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeSubTab === "departures"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            Today&apos;s Departures
            {countsData && (
              <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.2 text-[10px] font-semibold">
                {countsData.departures}
              </span>
            )}
          </button>

          <button
            onClick={() => handleSubTabChange("in-house")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeSubTab === "in-house"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            In-House Guests
            {countsData && (
              <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.2 text-[10px] font-semibold">
                {countsData.inHouse}
              </span>
            )}
          </button>

          <button
            onClick={() => handleSubTabChange("overdue")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeSubTab === "overdue"
                ? "bg-amber-600 text-white"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            Overdue / No-Shows
            {countsData && (
              <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-semibold">
                {countsData.overdue}
              </span>
            )}
          </button>
        </div>

        {/* Print cap notice */}
        {printData && printData.total > 2000 && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Notice: Print view is capped at the first 2,000 records ({printData.total} total matching).</span>
          </div>
        )}

        {/* 3. Shift Operations Table */}
        {isListLoading && !listData && !printData ? (
          <TableSkeleton rows={5} cols={7} />
        ) : listError && !listData && !printData ? (
          <div className="p-4">
            <ReportSectionError
              title={`Failed to load ${activeSubTab} list`}
              error={listError}
              onRetry={refetchList}
            />
          </div>
        ) : (
          <div>
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
                    <th className="px-4 py-3 text-right print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No records found for this operational filter on {opsDate}.
                      </td>
                    </tr>
                  ) : (
                    rows.map((item) => {
                      const hasBalance =
                        item.invoiceBalanceDue && parseFloat(item.invoiceBalanceDue) > 0
                      return (
                        <tr key={item.allocationId} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">
                              Room {item.roomNo}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {item.roomCategoryName} • {item.buildingName} F{item.floorNo}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {item.guestName}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
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
                            <div className="text-[11px] text-muted-foreground">
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
                                <div className="text-[11px] font-mono font-medium">
                                  {item.invoiceNumber}
                                </div>
                                <div className="text-[11px]">
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
                              <span className="text-[11px] text-muted-foreground">No Invoice</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right print:hidden">
                            <div className="flex items-center justify-end gap-2">
                              {item.invoiceId && hasBalance && (
                                <Link
                                  href={`/billing/${item.invoiceId}`}
                                  className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                                >
                                  Collect
                                </Link>
                              )}
                              <Link
                                href={`/reservations/${item.reservationId}`}
                                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] font-medium hover:bg-muted/80"
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

            {/* Pagination Footer (when not in full print mode) */}
            {!printData && total > 10 && (
              <div className="p-3 border-t border-border">
                <PaginationFooter
                  page={page}
                  limit={limit}
                  total={total}
                  onPageChange={setPage}
                  onLimitChange={(newLimit) => {
                    setLimit(newLimit)
                    setPage(1)
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
