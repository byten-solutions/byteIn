"use client"

import * as React from "react"
import { Wallet, Receipt, Tag } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
      {/* Financial Sub-Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2 print:hidden">
        <button
          type="button"
          onClick={() => handleSubTabSelect("collections")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            activeSubTab === "collections"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Wallet className="size-4" />
          Collections
        </button>

        <button
          type="button"
          onClick={() => handleSubTabSelect("receivables")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            activeSubTab === "receivables"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Receipt className="size-4" />
          Receivables
        </button>

        <button
          type="button"
          onClick={() => handleSubTabSelect("discounts")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            activeSubTab === "discounts"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Tag className="size-4" />
          Discounts
        </button>
      </div>

      {/* Sub-Tab Panels */}
      <div>
        {openedSubTabs.has("collections") && (
          <div className={cn("space-y-6", activeSubTab !== "collections" && "hidden")}>
            {/* Shift Date Filter Bar */}
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
              <div className="flex items-center gap-3">
                <Label htmlFor="financial-date" className="whitespace-nowrap font-medium">
                  Reconciliation Date:
                </Label>
                <Input
                  id="financial-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-44"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date().toISOString().split("T")[0]!
                    setDate(today)
                  }}
                >
                  Today
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                Shift collections, drawer reconciliation & outstanding folios as of{" "}
                <span className="font-semibold text-foreground">{date}</span>
              </div>
            </div>

            {/* Section 1: Shift Collections */}
            <div className="space-y-3">
              <div className="border-b border-border pb-2">
                <h2 className="text-base font-semibold text-foreground">Shift Drawer & Collections</h2>
                <p className="text-xs text-muted-foreground">
                  Cash, card, and digital collections logged for the selected shift date.
                </p>
              </div>
              <CollectionsSection
                key={`collections-${date}-${propertyId || "global"}`}
                date={date}
                propertyId={propertyId}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </div>
        )}

        {openedSubTabs.has("receivables") && (
          <div className={cn("space-y-3", activeSubTab !== "receivables" && "hidden")}>
            <div className="border-b border-border pb-2">
              <h2 className="text-base font-semibold text-foreground">Outstanding Balances & Folio Aging</h2>
              <p className="text-xs text-muted-foreground">
                Unpaid invoices grouped by guest stay status and days overdue.
              </p>
            </div>
            <ReceivablesSection
              key={`receivables-${propertyId || "global"}`}
              propertyId={propertyId}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}

        {openedSubTabs.has("discounts") && (
          <div className={cn("space-y-3", activeSubTab !== "discounts" && "hidden")}>
            <div className="border-b border-border pb-2">
              <h2 className="text-base font-semibold text-foreground">Discounts & Rate Overrides</h2>
              <p className="text-xs text-muted-foreground">
                Revenue impact of manual invoice discounts and lower-than-rack bookings.
              </p>
            </div>
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
