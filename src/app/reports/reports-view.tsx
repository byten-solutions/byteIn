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
  userRole?: string
}

export function ReportsView({
  initialStartDate,
  initialEndDate,
  initialTodayDate,
  initialWeekLaterDate,
  initialTab = "daily_ops",
  initialOpsSubTab = "arrivals",
  initialPropertyId,
  userRole,
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

      {/* Primary Tab Navigation — Underline Hierarchy */}
      <div className="flex items-center gap-6 border-b border-border print:hidden overflow-x-auto">
        <button
          onClick={() => handleTabSelect("daily_ops")}
          className={cn(
            "flex items-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer",
            activeTab === "daily_ops"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <CalendarCheck className="size-4" />
          Daily Operations
        </button>

        <button
          onClick={() => handleTabSelect("availability_grid")}
          className={cn(
            "flex items-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer",
            activeTab === "availability_grid"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <CalendarDays className="size-4" />
          Availability Grid
        </button>

        <button
          onClick={() => handleTabSelect("financial")}
          className={cn(
            "flex items-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer",
            activeTab === "financial"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <Wallet className="size-4" />
          Financial & Collections
        </button>

        <button
          onClick={() => handleTabSelect("performance")}
          className={cn(
            "flex items-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer",
            activeTab === "performance"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
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
              isSuperAdmin={userRole === "SUPER_ADMIN"}
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
