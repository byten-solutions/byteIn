"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CollectionsSection } from "./collections-section"
import { ReceivablesSection } from "./receivables-section"
import { DiscountsSection } from "./discounts-section"

type FinancialSubTab = "collections" | "receivables" | "discounts"

interface FinancialTabProps {
  initialDate: string
  propertyId?: string
  refreshTrigger?: number
}

export function FinancialTab({
  initialDate,
  propertyId,
  refreshTrigger = 0,
}: FinancialTabProps) {
  const [activeSubTab, setActiveSubTab] = React.useState<FinancialSubTab>("collections")
  const [openedSubTabs, setOpenedSubTabs] = React.useState<Set<FinancialSubTab>>(
    () => new Set(["collections"])
  )
  const [date, setDate] = React.useState<string>(initialDate)

  const handleSubTabSelect = (tab: FinancialSubTab) => {
    setActiveSubTab(tab)
    setOpenedSubTabs((prev) => {
      if (prev.has(tab)) return prev
      const next = new Set(prev)
      next.add(tab)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Financial Sub-Tab Navigation — Secondary Segmented Pill */}
      <div className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-1 print:hidden">
        <button
          type="button"
          onClick={() => handleSubTabSelect("collections")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
            activeSubTab === "collections"
              ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Collections
        </button>

        <button
          type="button"
          onClick={() => handleSubTabSelect("receivables")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
            activeSubTab === "receivables"
              ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Receivables
        </button>

        <button
          type="button"
          onClick={() => handleSubTabSelect("discounts")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
            activeSubTab === "discounts"
              ? "bg-card text-foreground border border-border/60 shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Discounts
        </button>
      </div>

      {/* Sub-Tab Panels */}
      <div>
        {openedSubTabs.has("collections") && (
          <div className={cn(activeSubTab !== "collections" && "hidden")}>
            <CollectionsSection
              key={`collections-${date}-${propertyId || "global"}`}
              date={date}
              onDateChange={setDate}
              propertyId={propertyId}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}

        {openedSubTabs.has("receivables") && (
          <div className={cn(activeSubTab !== "receivables" && "hidden")}>
            <ReceivablesSection
              key={`receivables-${propertyId || "global"}`}
              propertyId={propertyId}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}

        {openedSubTabs.has("discounts") && (
          <div className={cn(activeSubTab !== "discounts" && "hidden")}>
            <DiscountsSection
              key={`discounts-${propertyId || "global"}`}
              propertyId={propertyId}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}
      </div>
    </div>
  )
}
