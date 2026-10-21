"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CollectionsSection } from "./collections-section"
import { ReceivablesSection } from "./receivables-section"
import { DiscountsSection } from "./discounts-section"

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
  const [date, setDate] = React.useState<string>(initialDate)

  return (
    <div className="space-y-8">
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

      {/* Section 2: Receivables & Aging */}
      <div className="space-y-3">
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

      {/* Section 3: Discounts & Rate Concessions */}
      <div className="space-y-3">
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
    </div>
  )
}
