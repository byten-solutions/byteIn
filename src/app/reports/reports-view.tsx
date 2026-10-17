"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  BarChart3,
  CalendarDays,
  Printer,
  RefreshCw,
  TrendingUp,
  CreditCard,
  BedDouble,
  Clock,
  Receipt,
  Wallet,
  AlertCircle,
  CalendarCheck,
  Phone,
  Mail,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
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
  DailyOperationsReportDTO,
  AvailabilityGridDTO,
  ShiftCollectionsReportDTO,
  ReceivablesReportDTO,
} from "@/modules/reports/reports.types"

interface ReportsViewProps {
  initialStartDate: string
  initialEndDate: string
  initialTodayDate: string
  initialWeekLaterDate: string
  initialOccupancy: OccupancyReportDTO
  initialRevenue: RevenueReportDTO
  initialReservations: ReservationStatusReportDTO
  initialDailyOps: DailyOperationsReportDTO
  initialAvailabilityGrid: AvailabilityGridDTO
  initialCollections: ShiftCollectionsReportDTO
  initialReceivables: ReceivablesReportDTO
}

type MainTab = "daily_ops" | "availability_grid" | "financial" | "performance"

export function ReportsView({
  initialStartDate,
  initialEndDate,
  initialTodayDate,
  initialWeekLaterDate,
  initialOccupancy,
  initialRevenue,
  initialReservations,
  initialDailyOps,
  initialAvailabilityGrid,
  initialCollections,
  initialReceivables,
}: ReportsViewProps) {
  const [activeTab, setActiveTab] = React.useState<MainTab>("daily_ops")

  // Date filters
  const [startDate, setStartDate] = React.useState(initialStartDate)
  const [endDate, setEndDate] = React.useState(initialEndDate)
  const [opsDate, setOpsDate] = React.useState(initialTodayDate)
  const [gridStart, setGridStart] = React.useState(initialTodayDate)
  const [gridEnd, setGridEnd] = React.useState(initialWeekLaterDate)

  // Sub-tab states
  const [opsSubTab, setOpsSubTab] = React.useState<"arrivals" | "departures" | "in_house" | "pending">("arrivals")
  const [receivablesFilter, setReceivablesFilter] = React.useState<"all" | "in_house" | "departed">("all")

  // Data states
  const [loading, setLoading] = React.useState(false)
  const [occupancyData, setOccupancyData] = React.useState<OccupancyReportDTO>(initialOccupancy)
  const [revenueData, setRevenueData] = React.useState<RevenueReportDTO>(initialRevenue)
  const [reservationsData, setReservationsData] = React.useState<ReservationStatusReportDTO>(initialReservations)
  const [dailyOpsData, setDailyOpsData] = React.useState<DailyOperationsReportDTO>(initialDailyOps)
  const [gridData, setGridData] = React.useState<AvailabilityGridDTO>(initialAvailabilityGrid)
  const [collectionsData, setCollectionsData] = React.useState<ShiftCollectionsReportDTO>(initialCollections)
  const [receivablesData, setReceivablesData] = React.useState<ReceivablesReportDTO>(initialReceivables)

  // Refetch helpers
  const fetchPerformanceReports = async (start: string, end: string) => {
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

      if (occJson.success) setOccupancyData(occJson.data)
      if (revJson.success) setRevenueData(revJson.data)
      if (resJson.success) setReservationsData(resJson.data)
      toast.success("Performance metrics updated")
    } catch {
      toast.error("Failed to load performance metrics")
    } finally {
      setLoading(false)
    }
  }

  const fetchDailyOperations = async (date: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/daily-operations?date=${date}`)
      const json = await res.json()
      if (json.success) {
        setDailyOpsData(json.data)
        toast.success(`Daily operations updated for ${date}`)
      } else {
        toast.error(json.error || "Failed to load operations")
      }
    } catch {
      toast.error("Failed to fetch daily operations")
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailabilityGrid = async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/availability-grid?startDate=${start}&endDate=${end}`)
      const json = await res.json()
      if (json.success) {
        setGridData(json.data)
        toast.success("Availability grid updated")
      } else {
        toast.error(json.error || "Failed to load grid")
      }
    } catch {
      toast.error("Failed to fetch availability grid")
    } finally {
      setLoading(false)
    }
  }

  const fetchFinancials = async (date: string) => {
    setLoading(true)
    try {
      const [colRes, recRes] = await Promise.all([
        fetch(`/api/reports/collections?date=${date}`),
        fetch(`/api/reports/receivables`),
      ])
      const [colJson, recJson] = await Promise.all([colRes.json(), recRes.json()])
      if (colJson.success) setCollectionsData(colJson.data)
      if (recJson.success) setReceivablesData(recJson.data)
      toast.success("Financial reports updated")
    } catch {
      toast.error("Failed to load financial reports")
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Preset Date Range Helpers for Performance Tab
  const setPreset = (preset: "last7" | "thisMonth" | "last30" | "lastMonth") => {
    const today = new Date()
    const y = today.getUTCFullYear()
    const m = today.getUTCMonth()

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
    fetchPerformanceReports(start, end)
  }

  // Active sub-list for daily operations
  const currentOpsList =
    opsSubTab === "arrivals"
      ? dailyOpsData.arrivals
      : opsSubTab === "departures"
      ? dailyOpsData.departures
      : opsSubTab === "in_house"
      ? dailyOpsData.inHouse
      : dailyOpsData.pendingArrivals

  // Filtered receivables
  const filteredReceivables = receivablesData.items.filter((item) => {
    if (receivablesFilter === "in_house") return item.isGuestInHouse
    if (receivablesFilter === "departed") return !item.isGuestInHouse
    return true
  })

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------------------------- */}
      {/* 1. Header & Navigation Controls                                       */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            PMS Operations & Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Daily front desk operations, room tape chart, shift collections, and financial performance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="size-4" />
            Print Report
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              if (activeTab === "daily_ops") fetchDailyOperations(opsDate)
              else if (activeTab === "availability_grid") fetchAvailabilityGrid(gridStart, gridEnd)
              else if (activeTab === "financial") fetchFinancials(opsDate)
              else fetchPerformanceReports(startDate, endDate)
            }}
            className="gap-2"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. Primary Tab Switcher                                               */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2 print:hidden">
        <button
          onClick={() => setActiveTab("daily_ops")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            activeTab === "daily_ops"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <CalendarCheck className="size-4" />
          Daily Operations
          {dailyOpsData.summary.expectedArrivalsCount > 0 && (
            <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-xs font-semibold">
              {dailyOpsData.summary.expectedArrivalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("availability_grid")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            activeTab === "availability_grid"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <CalendarDays className="size-4" />
          Availability Grid
        </button>

        <button
          onClick={() => setActiveTab("financial")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            activeTab === "financial"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Wallet className="size-4" />
          Financial & Collections
        </button>

        <button
          onClick={() => setActiveTab("performance")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            activeTab === "performance"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <TrendingUp className="size-4" />
          Performance & KPIs
        </button>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. TAB 1: DAILY OPERATIONS                                            */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "daily_ops" && (
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
                onChange={(e) => {
                  setOpsDate(e.target.value)
                  fetchDailyOperations(e.target.value)
                }}
                className="w-44"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0]!
                  setOpsDate(today)
                  fetchDailyOperations(today)
                }}
              >
                Today
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Showing reception shift operations for <span className="font-semibold text-foreground">{opsDate}</span>
            </div>
          </div>

          {/* Daily Ops KPI Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Expected Arrivals"
              value={dailyOpsData.summary.expectedArrivalsCount}
              subtext={`${dailyOpsData.summary.checkedInArrivalsCount} already checked in`}
              icon={<CalendarCheck className="size-4" />}
            />
            <StatCard
              label="Expected Departures"
              value={dailyOpsData.summary.expectedDeparturesCount}
              subtext={`${dailyOpsData.summary.checkedOutDeparturesCount} checked out`}
              icon={<Clock className="size-4" />}
            />
            <StatCard
              label="In-House Guests"
              value={dailyOpsData.summary.inHouseCount}
              subtext={`₹${dailyOpsData.summary.totalInHouseBalanceDue} pending balance`}
              icon={<BedDouble className="size-4" />}
            />
            <StatCard
              label="Pending / No-Shows"
              value={dailyOpsData.summary.pendingArrivalsCount}
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
                Today&apos;s Arrivals ({dailyOpsData.arrivals.length})
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
                Today&apos;s Departures ({dailyOpsData.departures.length})
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
                In-House Guests ({dailyOpsData.inHouse.length})
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
                Overdue / No-Shows ({dailyOpsData.pendingArrivals.length})
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
                            {formatMoney(parseFloat(item.bookedNightlyRate))}
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
                                      Balance: {formatMoney(parseFloat(item.invoiceBalanceDue!))}
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
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. TAB 2: AVAILABILITY GRID (TAPE CHART)                              */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "availability_grid" && (
        <div className="space-y-4">
          {/* Grid Controls */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="font-medium">Window:</Label>
              <Input
                type="date"
                value={gridStart}
                onChange={(e) => {
                  setGridStart(e.target.value)
                  fetchAvailabilityGrid(e.target.value, gridEnd)
                }}
                className="w-40"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={gridEnd}
                onChange={(e) => {
                  setGridEnd(e.target.value)
                  fetchAvailabilityGrid(gridStart, e.target.value)
                }}
                className="w-40"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date()
                  const s = now.toISOString().split("T")[0]!
                  const e = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!
                  setGridStart(s)
                  setGridEnd(e)
                  fetchAvailabilityGrid(s, e)
                }}
              >
                Next 7 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date()
                  const s = now.toISOString().split("T")[0]!
                  const e = new Date(now.getTime() + 13 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!
                  setGridStart(s)
                  setGridEnd(e)
                  fetchAvailabilityGrid(s, e)
                }}
              >
                14 Days
              </Button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-xs bg-emerald-100 border border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800" />
                Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-xs bg-blue-500 text-white" />
                Booked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-xs bg-amber-500 text-white" />
                Checked In
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-xs bg-rose-500 text-white" />
                Maintenance
              </span>
            </div>
          </div>

          {/* Tape Chart Matrix */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="sticky left-0 z-20 min-w-[140px] border-r border-border bg-muted px-3 py-2.5 font-semibold">
                      Room / Cat
                    </th>
                    {gridData.dates.map((dateStr) => {
                      const d = new Date(`${dateStr}T00:00:00.000Z`)
                      const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]
                      const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6
                      return (
                        <th
                          key={dateStr}
                          className={cn(
                            "min-w-[90px] border-r border-border px-2 py-2 text-center",
                            isWeekend && "bg-muted/80"
                          )}
                        >
                          <div className="font-semibold">{dayName}</div>
                          <div className="text-[11px] text-muted-foreground">{dateStr.slice(5)}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {gridData.rooms.map((room) => (
                    <tr key={room.roomId} className="hover:bg-muted/10">
                      {/* Fixed Left Header Column */}
                      <td className="sticky left-0 z-10 border-r border-border bg-card px-3 py-2 font-medium">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">Room {room.roomNo}</span>
                          <span className="text-[10px] text-muted-foreground">F{room.floorNo}</span>
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {room.categoryName}
                        </div>
                      </td>

                      {/* Day Slot Cells */}
                      {room.slots.map((slot) => {
                        if (slot.isOccupied) {
                          const isCheckedIn = slot.allocationStatus === "CHECKED_IN"
                          return (
                            <td
                              key={slot.date}
                              className="border-r border-border p-1"
                            >
                              <Link
                                href={`/reservations/${slot.reservationId}`}
                                title={`${slot.guestName || "Guest"} (${slot.reservationNo})`}
                                className={cn(
                                  "block rounded-md p-1.5 text-[11px] font-medium transition-opacity hover:opacity-80 text-white",
                                  isCheckedIn ? "bg-amber-600" : "bg-blue-600"
                                )}
                              >
                                <div className="truncate font-semibold">{slot.guestName || "Guest"}</div>
                                <div className="truncate text-[9px] opacity-90">{slot.reservationNo}</div>
                              </Link>
                            </td>
                          )
                        }

                        if (slot.isMaintenance) {
                          return (
                            <td
                              key={slot.date}
                              className="border-r border-border bg-rose-50 p-1 text-center dark:bg-rose-950/20"
                            >
                              <div className="rounded-md bg-rose-500/20 py-2 text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                                Mnt
                              </div>
                            </td>
                          )
                        }

                        // Free / Available
                        return (
                          <td
                            key={slot.date}
                            className="border-r border-border bg-emerald-50/40 p-1 text-center hover:bg-emerald-100/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30"
                          >
                            <div className="py-2 text-[11px] font-medium text-emerald-800 dark:text-emerald-400">
                              {formatMoney(parseFloat(slot.nightlyRate))}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 5. TAB 3: FINANCIAL & COLLECTIONS                                     */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "financial" && (
        <div className="space-y-6">
          {/* Shift Date Filter */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap font-medium">Reconciliation Date:</Label>
              <Input
                type="date"
                value={opsDate}
                onChange={(e) => {
                  setOpsDate(e.target.value)
                  fetchFinancials(e.target.value)
                }}
                className="w-44"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0]!
                  setOpsDate(today)
                  fetchFinancials(today)
                }}
              >
                Today
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              End-of-shift drawer reconciliation & receivables as of {opsDate}
            </div>
          </div>

          {/* Financial Summary KPIs */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Shift Collections"
              value={formatMoney(parseFloat(collectionsData.totalCollected))}
              subtext={`${collectionsData.totalTransactions} recorded payments`}
              icon={<Wallet className="size-4" />}
            />
            <StatCard
              label="Total Receivables"
              value={formatMoney(parseFloat(receivablesData.totalReceivables))}
              subtext={`${receivablesData.totalInvoices} unpaid folios`}
              icon={<Receipt className="size-4" />}
            />
            <StatCard
              label="In-House Receivables"
              value={formatMoney(parseFloat(receivablesData.inHouseReceivables))}
              subtext={`${receivablesData.inHouseCount} active staying guests`}
              icon={<BedDouble className="size-4" />}
            />
            <StatCard
              label="Departed Debtors"
              value={formatMoney(parseFloat(receivablesData.departedReceivables))}
              subtext={`${receivablesData.departedCount} unpaid after checkout`}
              icon={<ShieldAlert className="size-4" />}
            />
          </div>

          {/* Shift Cash Drawer Reconciliation */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* By Payment Method */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="font-semibold text-foreground">Shift Collections by Method</h3>
                <span className="text-xs text-muted-foreground">
                  Total: {formatMoney(parseFloat(collectionsData.totalCollected))}
                </span>
              </div>

              {collectionsData.methodBreakdown.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No payments recorded for this shift date.
                </div>
              ) : (
                <div className="space-y-3">
                  {collectionsData.methodBreakdown.map((pm) => (
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
                          style={{ width: `${pm.percentage}%` }}
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

              {collectionsData.staffBreakdown.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No staff payment entries recorded on {opsDate}.
                </div>
              ) : (
                <div className="space-y-3">
                  {collectionsData.staffBreakdown.map((staff) => (
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

          {/* Receivables & Aging Report */}
          <div className="rounded-xl border border-border bg-card space-y-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-semibold text-foreground">Outstanding Balances & Aging</h3>
                <p className="text-xs text-muted-foreground">
                  All active uncollected folios categorized by aging and guest stay status.
                </p>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReceivablesFilter("all")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    receivablesFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  All ({receivablesData.items.length})
                </button>
                <button
                  onClick={() => setReceivablesFilter("in_house")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    receivablesFilter === "in_house" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  In-House ({receivablesData.inHouseCount})
                </button>
                <button
                  onClick={() => setReceivablesFilter("departed")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    receivablesFilter === "departed" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  Departed ({receivablesData.departedCount})
                </button>
              </div>
            </div>

            {/* Aging summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-muted/40 p-2.5 text-center">
                <div className="text-[11px] text-muted-foreground">0 - 7 Days (Current)</div>
                <div className="text-sm font-semibold text-foreground">
                  {formatMoney(parseFloat(receivablesData.agingSummary.bucket0to7))}
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5 text-center">
                <div className="text-[11px] text-muted-foreground">8 - 30 Days</div>
                <div className="text-sm font-semibold text-foreground">
                  {formatMoney(parseFloat(receivablesData.agingSummary.bucket8to30))}
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5 text-center">
                <div className="text-[11px] text-muted-foreground">31 - 60 Days</div>
                <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  {formatMoney(parseFloat(receivablesData.agingSummary.bucket31to60))}
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5 text-center">
                <div className="text-[11px] text-muted-foreground">60+ Days (Delinquent)</div>
                <div className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                  {formatMoney(parseFloat(receivablesData.agingSummary.bucket60Plus))}
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
                  {filteredReceivables.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-muted-foreground">
                        No outstanding balances in this view.
                      </td>
                    </tr>
                  ) : (
                    filteredReceivables.map((rec) => (
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
                        <td className="px-3 py-2">{formatMoney(parseFloat(rec.grandTotal))}</td>
                        <td className="px-3 py-2 font-semibold text-amber-600 dark:text-amber-400">
                          {formatMoney(parseFloat(rec.balanceDue))}
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
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 6. TAB 4: PERFORMANCE & KPIS (ADR, RevPAR, Categories)                */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "performance" && (
        <div className="space-y-6">
          {/* Preset buttons & custom date filter */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Presets:</span>
              <Button variant="outline" size="sm" onClick={() => setPreset("last7")}>
                Last 7 Days
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreset("thisMonth")}>
                This Month (MTD)
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreset("last30")}>
                Last 30 Days
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreset("lastMonth")}>
                Last Month
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36 text-xs"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36 text-xs"
              />
              <Button
                size="sm"
                onClick={() => fetchPerformanceReports(startDate, endDate)}
                disabled={loading}
              >
                Apply
              </Button>
            </div>
          </div>

          {/* Performance KPIs: Occupancy, ADR, RevPAR, Room Revenue */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Occupancy Rate"
              value={`${occupancyData.occupancyRate}%`}
              subtext={`${occupancyData.totalOccupiedRoomNights} of ${occupancyData.totalAvailableRoomNights} nights`}
              icon={<TrendingUp className="size-4" />}
            />
            <StatCard
              label="ADR (Avg Daily Rate)"
              value={formatMoney(parseFloat(occupancyData.adr))}
              subtext="Room revenue / rooms sold"
              icon={<CreditCard className="size-4" />}
            />
            <StatCard
              label="RevPAR"
              value={formatMoney(parseFloat(occupancyData.revpar))}
              subtext="Room revenue / available rooms"
              icon={<BarChart3 className="size-4" />}
            />
            <StatCard
              label="Total Room Revenue"
              value={formatMoney(parseFloat(occupancyData.totalRoomRevenue))}
              subtext={`${occupancyData.totalDays} calendar days`}
              icon={<Receipt className="size-4" />}
            />
          </div>

          {/* Room Category Performance Table */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="border-b border-border pb-2">
              <h3 className="font-semibold text-foreground">Room Category Performance Breakdown</h3>
              <p className="text-xs text-muted-foreground">
                Category sales volume, occupancy rates, ADR, and revenue generation.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                    <th className="px-3 py-2.5">Room Category</th>
                    <th className="px-3 py-2.5">Total Rooms</th>
                    <th className="px-3 py-2.5">Available Nights</th>
                    <th className="px-3 py-2.5">Occupied Nights</th>
                    <th className="px-3 py-2.5">Occupancy %</th>
                    <th className="px-3 py-2.5">Room Revenue</th>
                    <th className="px-3 py-2.5">ADR</th>
                    <th className="px-3 py-2.5">RevPAR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {occupancyData.categoryBreakdown.map((cat) => (
                    <tr key={cat.categoryId} className="hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-semibold text-foreground">
                        {cat.categoryName}
                      </td>
                      <td className="px-3 py-2.5">{cat.totalRooms}</td>
                      <td className="px-3 py-2.5">{cat.availableRoomNights}</td>
                      <td className="px-3 py-2.5 font-medium">{cat.occupiedRoomNights}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{cat.occupancyRate}%</span>
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${Math.min(100, cat.occupancyRate)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-medium">{formatMoney(parseFloat(cat.roomRevenue))}</td>
                      <td className="px-3 py-2.5">{formatMoney(parseFloat(cat.adr))}</td>
                      <td className="px-3 py-2.5">{formatMoney(parseFloat(cat.revpar))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Occupancy Trend Table */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="border-b border-border pb-2">
              <h3 className="font-semibold text-foreground">Daily Occupancy & Revenue Trend</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Day</th>
                    <th className="px-3 py-2">Occupied / Total</th>
                    <th className="px-3 py-2">Occupancy Rate</th>
                    <th className="px-3 py-2">Room Revenue</th>
                    <th className="px-3 py-2">ADR</th>
                    <th className="px-3 py-2">RevPAR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {occupancyData.dailyBreakdown.map((d) => (
                    <tr key={d.date} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono">{d.date}</td>
                      <td className="px-3 py-2 text-muted-foreground">{d.dayOfWeek}</td>
                      <td className="px-3 py-2">
                        {d.occupiedRooms} / {d.totalRooms}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{d.occupancyRate}%</span>
                          <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${Math.min(100, d.occupancyRate)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-medium">{formatMoney(parseFloat(d.roomRevenue))}</td>
                      <td className="px-3 py-2">{formatMoney(parseFloat(d.adr))}</td>
                      <td className="px-3 py-2">{formatMoney(parseFloat(d.revpar))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Period Financial & Reservation Totals */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="font-semibold text-foreground">Invoiced vs Collected ({startDate} to {endDate})</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <div className="text-muted-foreground">Total Invoiced</div>
                  <div className="text-base font-bold text-foreground">
                    {formatMoney(parseFloat(revenueData.totalInvoiced))}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{revenueData.invoiceCount} invoices</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <div className="text-muted-foreground">Total Collected</div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(parseFloat(revenueData.totalCollected))}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{revenueData.paymentCount} payments</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="font-semibold text-foreground">Reservation Volume & Stay Metrics</h3>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-muted/40 p-2.5 text-center">
                  <div className="text-muted-foreground">Total Bookings</div>
                  <div className="text-base font-bold text-foreground">{reservationsData.totalReservations}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5 text-center">
                  <div className="text-muted-foreground">Avg Stay (ALOS)</div>
                  <div className="text-base font-bold text-foreground">{reservationsData.averageLengthOfStay} nights</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5 text-center">
                  <div className="text-muted-foreground">Cancellation %</div>
                  <div className="text-base font-bold text-rose-600 dark:text-rose-400">{reservationsData.cancellationRate}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
