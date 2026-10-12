"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  BarChart3,
  CalendarDays,
  Printer,
  RefreshCw,
  TrendingUp,
  CreditCard,
  BedDouble,
  Users,
  XCircle,
  Clock,
  Receipt,
  Wallet,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatCard, StatusBadge } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type {
  OccupancyReportDTO,
  RevenueReportDTO,
  ReservationStatusReportDTO,
} from "@/modules/reports/reports.types"

interface ReportsViewProps {
  initialStartDate: string
  initialEndDate: string
  initialOccupancy: OccupancyReportDTO
  initialRevenue: RevenueReportDTO
  initialReservations: ReservationStatusReportDTO
}

type ReportTab = "occupancy" | "revenue" | "reservations"

export function ReportsView({
  initialStartDate,
  initialEndDate,
  initialOccupancy,
  initialRevenue,
  initialReservations,
}: ReportsViewProps) {
  const [activeTab, setActiveTab] = React.useState<ReportTab>("occupancy")
  const [startDate, setStartDate] = React.useState(initialStartDate)
  const [endDate, setEndDate] = React.useState(initialEndDate)
  const [loading, setLoading] = React.useState(false)

  const [occupancyData, setOccupancyData] = React.useState<OccupancyReportDTO>(initialOccupancy)
  const [revenueData, setRevenueData] = React.useState<RevenueReportDTO>(initialRevenue)
  const [reservationsData, setReservationsData] = React.useState<ReservationStatusReportDTO>(initialReservations)

  // Preset Date Range Helpers
  const setPreset = (preset: "last7" | "thisMonth" | "last30" | "lastMonth") => {
    const today = new Date()
    const y = today.getUTCFullYear()
    const m = today.getUTCMonth() // 0-indexed

    let start = ""
    let end = today.toISOString().split("T")[0]!

    if (preset === "last7") {
      const d = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
      start = d.toISOString().split("T")[0]!
    } else if (preset === "thisMonth") {
      const monthStr = String(m + 1).padStart(2, "0")
      start = `${y}-${monthStr}-01`
    } else if (preset === "last30") {
      const d = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
      start = d.toISOString().split("T")[0]!
    } else if (preset === "lastMonth") {
      const prevMonthYear = m === 0 ? y - 1 : y
      const prevMonth = m === 0 ? 12 : m
      const prevMonthStr = String(prevMonth).padStart(2, "0")
      start = `${prevMonthYear}-${prevMonthStr}-01`
      const lastDayOfPrevMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
      end = `${prevMonthYear}-${prevMonthStr}-${String(lastDayOfPrevMonth).padStart(2, "0")}`
    }

    setStartDate(start)
    setEndDate(end)
    fetchReports(start, end)
  }

  const fetchReports = async (start: string, end: string) => {
    setLoading(true)
    try {
      const [occRes, revRes, resRes] = await Promise.all([
        fetch(`/api/reports/occupancy?startDate=${start}&endDate=${end}`),
        fetch(`/api/reports/revenue?startDate=${start}&endDate=${end}`),
        fetch(`/api/reports/reservations?startDate=${start}&endDate=${end}`),
      ])

      const [occJson, revJson, resJson] = await Promise.all([
        occRes.json(),
        revRes.json(),
        resRes.json(),
      ])

      if (!occRes.ok) throw new Error(occJson.error || "Failed to load occupancy report")
      if (!revRes.ok) throw new Error(revJson.error || "Failed to load revenue report")
      if (!resRes.ok) throw new Error(resJson.error || "Failed to load reservations report")

      setOccupancyData(occJson.data)
      setRevenueData(revJson.data)
      setReservationsData(resJson.data)
      toast.success("Reports refreshed successfully")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load reports"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault()
    if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
      toast.error("End date must be on or after start date")
      return
    }
    fetchReports(startDate, endDate)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            <span>Reports & Analytics</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Historical occupancy tracking, billed revenue vs collections, and reservation breakdown.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="text-xs h-9 gap-1.5 print:hidden"
          >
            <Printer className="size-3.5" />
            <span>Print Report</span>
          </Button>
        </div>
      </div>

      {/* Date Range & Filter Bar */}
      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs space-y-3 print:hidden">
        <form onSubmit={handleApplyFilter} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">From Date</Label>
            <Input
              type="date"
              className="h-9 text-xs w-36"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">To Date</Label>
            <Input
              type="date"
              className="h-9 text-xs w-36"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className="h-9 text-xs gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            <span>Apply Filter</span>
          </Button>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <span className="text-[11px] text-muted-foreground mr-1 hidden md:inline">Presets:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreset("last7")}
              className="h-7 text-[11px] px-2"
            >
              Last 7 Days
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreset("thisMonth")}
              className="h-7 text-[11px] px-2"
            >
              This Month
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreset("last30")}
              className="h-7 text-[11px] px-2"
            >
              Last 30 Days
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreset("lastMonth")}
              className="h-7 text-[11px] px-2"
            >
              Last Month
            </Button>
          </div>
        </form>

        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border/40">
          <CalendarDays className="size-3.5 text-primary" />
          <span>
            Active reporting interval: <strong>{startDate}</strong> to <strong>{endDate}</strong> ({occupancyData.totalDays} day{occupancyData.totalDays === 1 ? "" : "s"})
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border/80 gap-2 print:hidden">
        <button
          onClick={() => setActiveTab("occupancy")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors",
            activeTab === "occupancy"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BedDouble className="size-4" />
          <span>Occupancy Report</span>
        </button>

        <button
          onClick={() => setActiveTab("revenue")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors",
            activeTab === "revenue"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Receipt className="size-4" />
          <span>Revenue & Collections</span>
        </button>

        <button
          onClick={() => setActiveTab("reservations")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors",
            activeTab === "reservations"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="size-4" />
          <span>Reservation Breakdown</span>
        </button>
      </div>

      {/* TAB 1: OCCUPANCY REPORT */}
      {activeTab === "occupancy" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Occupancy Rate"
              value={`${occupancyData.occupancyRate.toFixed(1)}%`}
              icon={<TrendingUp className="size-4" />}
              subtext={`Across ${occupancyData.totalRooms} rooms over ${occupancyData.totalDays} days`}
            />
            <StatCard
              label="Occupied Room Nights"
              value={occupancyData.totalOccupiedRoomNights.toLocaleString()}
              icon={<BedDouble className="size-4" />}
              subtext="Nights occupied by active stays"
            />
            <StatCard
              label="Available Room Nights"
              value={occupancyData.totalAvailableRoomNights.toLocaleString()}
              icon={<CalendarDays className="size-4" />}
              subtext="Total capacity in period"
            />
            <StatCard
              label="Avg Daily Occupancy"
              value={`${occupancyData.averageDailyOccupancy.toFixed(1)} rooms`}
              icon={<BarChart3 className="size-4" />}
              subtext="Mean rooms occupied per night"
            />
          </div>

          {/* Daily Occupancy Table */}
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border/60 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Daily Occupancy Breakdown ({occupancyData.dailyBreakdown.length} days)
              </h3>
              <span className="text-xs text-muted-foreground">
                Inventory: {occupancyData.totalRooms} physical rooms
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 border-b border-border/60 text-muted-foreground font-medium">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Day</th>
                    <th className="py-2.5 px-4 text-right">Occupied Rooms</th>
                    <th className="py-2.5 px-4 text-right">Available Rooms</th>
                    <th className="py-2.5 px-4 text-right">Occupancy %</th>
                    <th className="py-2.5 px-4 w-40">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {occupancyData.dailyBreakdown.map((row) => (
                    <tr key={row.date} className="hover:bg-muted/10 transition-colors">
                      <td className="py-2.5 px-4 font-sans font-medium text-foreground">
                        {row.date}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground font-sans">
                        {row.dayOfWeek}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-foreground">
                        {row.occupiedRooms}
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">
                        {row.availableRooms}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-foreground">
                        {row.occupancyRate.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              row.occupancyRate >= 75
                                ? "bg-emerald-600"
                                : row.occupancyRate >= 40
                                ? "bg-primary"
                                : "bg-amber-500"
                            )}
                            style={{ width: `${Math.min(100, row.occupancyRate)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REVENUE & COLLECTIONS */}
      {activeTab === "revenue" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Billed Revenue"
              value={formatMoney(revenueData.totalInvoiced)}
              icon={<Receipt className="size-4" />}
              subtext={`${revenueData.invoiceCount} invoices created/issued`}
            />
            <StatCard
              label="Collections Recorded"
              value={formatMoney(revenueData.totalCollected)}
              icon={<Wallet className="size-4" />}
              subtext={`${revenueData.paymentCount} payments received`}
            />
            <StatCard
              label="Outstanding Balance"
              value={formatMoney(revenueData.totalOutstanding)}
              icon={<AlertCircle className="size-4" />}
              subtext="Unpaid balance on period invoices"
            />
            <StatCard
              label="Room Charges"
              value={formatMoney(revenueData.roomChargesTotal)}
              icon={<BedDouble className="size-4" />}
              subtext={`Extra charges: ${formatMoney(revenueData.extraChargesTotal)}`}
            />
          </div>

          {/* Breakdown Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Methods */}
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <CreditCard className="size-4 text-primary" />
                  <span>Collections by Payment Method</span>
                </h4>
                <span className="text-xs font-mono font-medium text-foreground">
                  {formatMoney(revenueData.totalCollected)}
                </span>
              </div>

              {revenueData.paymentMethodBreakdown.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No payments recorded during this period.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {revenueData.paymentMethodBreakdown.map((pm) => (
                    <div key={pm.method} className="space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-foreground">{pm.method}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-[11px]">
                            ({pm.count} pay{pm.count === 1 ? "" : "s"})
                          </span>
                          <span className="font-mono font-semibold text-foreground">
                            {formatMoney(pm.amount)}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                            {pm.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${Math.min(100, pm.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Charge Types Breakdown */}
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Receipt className="size-4 text-primary" />
                  <span>Billed Charges Breakdown</span>
                </h4>
                <span className="text-xs font-mono font-medium text-foreground">
                  {formatMoney(revenueData.totalInvoiced)}
                </span>
              </div>

              {revenueData.chargeTypeBreakdown.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No invoices created during this period.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {revenueData.chargeTypeBreakdown.map((ct) => (
                    <div key={ct.itemType} className="space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-foreground">
                          {ct.itemType.replace("_", " ")}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-[11px]">
                            ({ct.count} item{ct.count === 1 ? "" : "s"})
                          </span>
                          <span className="font-mono font-semibold text-foreground">
                            {formatMoney(ct.amount)}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                            {ct.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full"
                          style={{ width: `${Math.min(100, ct.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Daily Revenue Table */}
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border/60 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Daily Financial Overview ({revenueData.dailyBreakdown.length} days)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 border-b border-border/60 text-muted-foreground font-medium">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4 text-right">Invoiced Amount</th>
                    <th className="py-2.5 px-4 text-right">Collections Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {revenueData.dailyBreakdown.map((row) => (
                    <tr key={row.date} className="hover:bg-muted/10 transition-colors">
                      <td className="py-2.5 px-4 font-sans font-medium text-foreground">
                        {row.date}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-foreground">
                        {formatMoney(row.invoicedAmount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(row.collectedAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RESERVATIONS BREAKDOWN */}
      {activeTab === "reservations" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Reservations"
              value={reservationsData.totalReservations.toLocaleString()}
              icon={<CalendarDays className="size-4" />}
              subtext="Bookings created in date range"
            />
            <StatCard
              label="Allocated Rooms"
              value={reservationsData.totalAllocations.toLocaleString()}
              icon={<BedDouble className="size-4" />}
              subtext={`Across ${reservationsData.totalStayNights} stay nights`}
            />
            <StatCard
              label="Avg Length of Stay"
              value={`${reservationsData.averageLengthOfStay.toFixed(1)} nights`}
              icon={<Clock className="size-4" />}
              subtext="Average nights per reservation"
            />
            <StatCard
              label="Cancellation Rate"
              value={`${reservationsData.cancellationRate.toFixed(1)}%`}
              icon={<XCircle className="size-4" />}
              subtext={`Completion rate: ${reservationsData.completionRate.toFixed(1)}%`}
            />
          </div>

          {/* Status Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reservationsData.statusBreakdown.map((item) => (
              <div
                key={item.status}
                className="rounded-xl border border-border/80 bg-card p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <StatusBadge status={item.status} />
                  <span className="text-xs font-mono font-bold text-foreground">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Reservations</span>
                    <span className="font-mono font-medium text-foreground">{item.count}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Room Nights</span>
                    <span className="font-mono font-medium text-foreground">{item.roomNights}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/40">
                    <span>Total Booking Value</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatMoney(item.totalValue)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
