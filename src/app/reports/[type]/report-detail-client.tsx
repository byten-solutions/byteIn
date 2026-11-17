"use client"

import * as React from "react"
import { ReportPageShell, type PropertyOption } from "../components/report-page-shell"
import { TableSkeleton } from "../components/report-section-shell"
import { CollectionsSection } from "../components/financial/collections-section"
import { ReceivablesSection } from "../components/financial/receivables-section"
import { CashFlowSection } from "../components/financial/cash-flow-section"
import { OccupancySection } from "../components/performance/occupancy-section"
import { DailyOpsTab } from "../components/daily-ops-tab"
import { REPORT_CONFIGS, resolveCanonicalReportType, type ReportConfig } from "./report-configs"

// Lazy-load Availability Grid tape chart
const AvailabilityGridTab = React.lazy(() =>
  import("../components/availability-grid-tab").then((m) => ({ default: m.AvailabilityGridTab }))
)

export type { ReportConfig }

interface ReportDetailClientProps {
  type: string
  properties: PropertyOption[]
  initialPropertyId?: string
  isSuperAdmin: boolean
  userRole?: string
  initialStartDate?: string
  initialEndDate?: string
  initialSingleDate?: string
  initialWeekLaterDate?: string
  initialAccountId?: string
}

export function ReportDetailClient({
  type,
  properties,
  initialPropertyId,
  isSuperAdmin,
  userRole: _userRole,
  initialStartDate,
  initialEndDate,
  initialSingleDate,
  initialWeekLaterDate,
}: ReportDetailClientProps) {
  const [refreshTrigger, setRefreshTrigger] = React.useState<number>(0)
  const canonicalType = resolveCanonicalReportType(type)
  const config = REPORT_CONFIGS[canonicalType] || REPORT_CONFIGS["daily-operations"]

  const handleRefresh = React.useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  return (
    <ReportPageShell
      title={config.title}
      subtitle={config.subtitle}
      category={config.category}
      categoryHref={config.categoryHref}
      reportType={canonicalType}
      dateMode={config.dateMode}
      properties={properties}
      initialPropertyId={initialPropertyId}
      isSuperAdmin={isSuperAdmin}
      initialStartDate={initialStartDate}
      initialEndDate={initialEndDate}
      initialSingleDate={initialSingleDate}
      refreshTrigger={refreshTrigger}
      onRefresh={handleRefresh}
    >
      {({ startDate, endDate, singleDate, propertyId, refreshTrigger }) => {
        switch (canonicalType) {
          case "cash-flow":
            return (
              <CashFlowSection
                startDate={startDate}
                endDate={endDate}
                propertyId={propertyId}
                refreshTrigger={refreshTrigger}
              />
            )
          case "collections":
            return (
              <CollectionsSection
                date={singleDate}
                propertyId={propertyId}
                refreshTrigger={refreshTrigger}
              />
            )
          case "receivables":
          case "outstanding":
            return (
              <ReceivablesSection
                propertyId={propertyId}
                refreshTrigger={refreshTrigger}
              />
            )
          case "daily-operations":
            return (
              <DailyOpsTab
                initialTodayDate={singleDate}
                propertyId={propertyId}
                refreshTrigger={refreshTrigger}
              />
            )
          case "availability-grid":
            return (
              <React.Suspense fallback={<TableSkeleton rows={8} />}>
                <AvailabilityGridTab
                  initialStartDate={startDate}
                  initialEndDate={initialWeekLaterDate || endDate}
                  propertyId={propertyId}
                  isSuperAdmin={isSuperAdmin}
                  refreshTrigger={refreshTrigger}
                />
              </React.Suspense>
            )
          case "occupancy":
          case "revenue":
            return (
              <OccupancySection
                startDate={startDate}
                endDate={endDate}
                propertyId={propertyId}
                refreshTrigger={refreshTrigger}
              />
            )
          default:
            return (
              <DailyOpsTab
                initialTodayDate={singleDate}
                propertyId={propertyId}
                refreshTrigger={refreshTrigger}
              />
            )
        }
      }}
    </ReportPageShell>
  )
}
