"use client"

import * as React from "react"
import {
  Printer,
  RefreshCw,
  TrendingUp,
  CalendarDays,
  Wallet,
  CalendarCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DailyOpsTab } from "./components/daily-ops-tab"
import { AvailabilityGridTab } from "./components/availability-grid-tab"
import { FinancialTab } from "./components/financial/financial-tab"
import { PerformanceTab } from "./components/performance/performance-tab"
import { invalidateReportCacheKeys } from "./components/use-report-query"

type MainTab = "daily_ops" | "availability_grid" | "financial" | "performance"

interface ReportsViewProps {
  initialStartDate: string
  initialEndDate: string
  initialTodayDate: string
  initialWeekLaterDate: string
  initialTab?: MainTab
  initialOpsSubTab?: "arrivals" | "departures" | "in_house" | "pending"
  initialPropertyId?: string
}

export function ReportsView({
  initialStartDate,
  initialEndDate,
  initialTodayDate,
  initialWeekLaterDate,
  initialTab = "daily_ops",
  initialOpsSubTab = "arrivals",
  initialPropertyId,
}: ReportsViewProps) {
  const [activeTab, setActiveTab] = React.useState<MainTab>(initialTab)

  // Track tab-specific refresh triggers so "Refresh" only invalidates and refetches the visible tab
  const [refreshTriggers, setRefreshTriggers] = React.useState<Record<MainTab, number>>({
    daily_ops: 0,
    availability_grid: 0,
    financial: 0,
    performance: 0,
  })

  // Set of tabs that have been opened during this session
  const [openedTabs, setOpenedTabs] = React.useState<Set<MainTab>>(() => new Set([initialTab]))

  const handleTabSelect = (tab: MainTab) => {
    setActiveTab(tab)
    setOpenedTabs((prev) => {
      if (prev.has(tab)) return prev
      const next = new Set(prev)
      next.add(tab)
      return next
    })
  }

  const handleRefreshActiveTab = () => {
    // Invalidate session cache for the active tab only
    if (activeTab === "daily_ops") {
      invalidateReportCacheKeys(["/api/reports/daily-operations"])
    } else if (activeTab === "availability_grid") {
      invalidateReportCacheKeys(["/api/reports/availability-grid"])
    } else if (activeTab === "financial") {
      invalidateReportCacheKeys([
        "/api/reports/collections",
        "/api/reports/receivables",
        "/api/reports/discounts",
      ])
    } else if (activeTab === "performance") {
      invalidateReportCacheKeys([
        "/api/reports/occupancy",
        "/api/reports/revenue",
        "/api/reports/reservations",
      ])
    }

    setRefreshTriggers((prev) => ({
      ...prev,
      [activeTab]: prev[activeTab] + 1,
    }))
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header & Global Controls */}
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
            onClick={handleRefreshActiveTab}
            className="gap-2"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2 print:hidden">
        <button
          onClick={() => handleTabSelect("daily_ops")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            activeTab === "daily_ops"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <CalendarCheck className="size-4" />
          Daily Operations
        </button>

        <button
          onClick={() => handleTabSelect("availability_grid")}
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
          onClick={() => handleTabSelect("financial")}
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
          onClick={() => handleTabSelect("performance")}
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

      {/* Tab Panels: Keep mounted once opened so state/scroll are preserved */}
      <div>
        {openedTabs.has("daily_ops") && (
          <div className={cn(activeTab !== "daily_ops" && "hidden")}>
            <DailyOpsTab
              initialTodayDate={initialTodayDate}
              initialOpsSubTab={initialOpsSubTab}
              propertyId={initialPropertyId}
              refreshTrigger={refreshTriggers.daily_ops}
            />
          </div>
        )}

        {openedTabs.has("availability_grid") && (
          <div className={cn(activeTab !== "availability_grid" && "hidden")}>
            <AvailabilityGridTab
              initialStartDate={initialTodayDate}
              initialEndDate={initialWeekLaterDate}
              propertyId={initialPropertyId}
              refreshTrigger={refreshTriggers.availability_grid}
            />
          </div>
        )}

        {openedTabs.has("financial") && (
          <div className={cn(activeTab !== "financial" && "hidden")}>
            <FinancialTab
              initialDate={initialTodayDate}
              propertyId={initialPropertyId}
              refreshTrigger={refreshTriggers.financial}
            />
          </div>
        )}

        {openedTabs.has("performance") && (
          <div className={cn(activeTab !== "performance" && "hidden")}>
            <PerformanceTab
              initialStartDate={initialStartDate}
              initialEndDate={initialEndDate}
              propertyId={initialPropertyId}
              refreshTrigger={refreshTriggers.performance}
            />
          </div>
        )}
      </div>
    </div>
  )
}
