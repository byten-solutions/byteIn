"use client"

import * as React from "react"
import { RoleName } from "@prisma/client"
import { Wallet, CreditCard, ArrowLeftRight, Building2, TrendingUp, Receipt } from "lucide-react"
import { PageHeader } from "@/components/ui-kit"
import { AccountsTab } from "./accounts-tab"
import { MethodsTab } from "./methods-tab"
import { TransfersTab } from "./transfers-tab"
import { IncomeTab } from "./income-tab"
import { ExpensesTab } from "./expenses-tab"
import { cn } from "@/lib/utils"
import type { SessionPayload } from "@/modules/auth/auth.types"
import type { FinancialAccountWithBalanceDTO } from "@/modules/financial-accounts/financial-accounts.types"

type FinanceTab = "accounts" | "methods" | "transfers" | "income" | "expenses"

interface PropertyItem {
  id: string
  name: string
  city: string | null
  status: string
}

export function FinanceView({
  session,
  properties,
  initialPropertyId,
}: {
  session: SessionPayload
  properties: PropertyItem[]
  initialPropertyId: string
}) {
  const [activeTab, setActiveTab] = React.useState<FinanceTab>("accounts")
  const [selectedPropertyId, setSelectedPropertyId] = React.useState(initialPropertyId)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [accounts, setAccounts] = React.useState<FinancialAccountWithBalanceDTO[]>([])

  const isSuperAdmin = session.role === RoleName.SUPER_ADMIN
  const effectivePropertyId = isSuperAdmin ? selectedPropertyId : session.propertyId || ""

  React.useEffect(() => {
    if (!effectivePropertyId) return
    let mounted = true

    async function fetchShared() {
      try {
        const res = await fetch(`/api/financial-accounts?propertyId=${effectivePropertyId}`)
        const data = await res.json()
        if (mounted && res.ok) {
          setAccounts(data.accounts || [])
        }
      } catch (err) {
        console.error("Failed to load shared accounts:", err)
      }
    }

    fetchShared()

    return () => {
      mounted = false
    }
  }, [effectivePropertyId, refreshKey])

  const handleDataChange = () => {
    setRefreshKey((k) => k + 1)
  }

  const activeProperty = properties.find((p) => p.id === effectivePropertyId)
  const propertySubtitle = activeProperty
    ? `${activeProperty.name}${activeProperty.city ? ` (${activeProperty.city})` : ""}`
    : "Hotel Property Operations"

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Finance & Cash Management"
          description={`Liquidity control, cash drawers, bank accounts, and funds transfers for ${propertySubtitle}.`}
        />

        {/* SuperAdmin Property Selector */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2 bg-card border border-border/80 px-3 py-2 rounded-xl shadow-2xs shrink-0 self-start sm:self-auto">
            <Building2 className="size-4 text-primary shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Active Hotel
              </span>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-foreground outline-hidden cursor-pointer"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.city ? `(${p.city})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {!effectivePropertyId ? (
        <div className="text-center py-16 border rounded-xl bg-card border-dashed p-8 space-y-2">
          <Building2 className="size-8 text-muted-foreground mx-auto" />
          <h3 className="text-sm font-semibold">No Hotel Selected</h3>
          <p className="text-xs text-muted-foreground">Please select an active hotel property to manage financial accounts.</p>
        </div>
      ) : (
        <>
          {/* Primary Navigation Tabs */}
          <div className="flex items-center gap-6 border-b border-border print:hidden overflow-x-auto">
            <button
              onClick={() => setActiveTab("accounts")}
              className={cn(
                "flex items-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer",
                activeTab === "accounts"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Wallet className="size-4" />
              Accounts & Balances
            </button>

            <button
              onClick={() => setActiveTab("methods")}
              className={cn(
                "flex items-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer",
                activeTab === "methods"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <CreditCard className="size-4" />
              Payment Methods
            </button>

            <button
              onClick={() => setActiveTab("transfers")}
              className={cn(
                "flex items-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer",
                activeTab === "transfers"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <ArrowLeftRight className="size-4" />
              Account Transfers
            </button>

            <button
              onClick={() => setActiveTab("income")}
              className={cn(
                "flex items-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer",
                activeTab === "income"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <TrendingUp className="size-4" />
              Direct Income
            </button>

            <button
              onClick={() => setActiveTab("expenses")}
              className={cn(
                "flex items-center gap-2 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer",
                activeTab === "expenses"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Receipt className="size-4" />
              Expenses
            </button>
          </div>

          {/* Tab Content Panes */}
          <div className="pt-2">
            {activeTab === "accounts" && (
              <AccountsTab
                propertyId={effectivePropertyId}
                refreshKey={refreshKey}
                onAccountChange={handleDataChange}
              />
            )}

            {activeTab === "methods" && (
              <MethodsTab
                propertyId={effectivePropertyId}
                accounts={accounts}
                refreshKey={refreshKey}
                onMethodChange={handleDataChange}
              />
            )}

            {activeTab === "transfers" && (
              <TransfersTab
                propertyId={effectivePropertyId}
                accounts={accounts}
                refreshKey={refreshKey}
                onTransferSuccess={handleDataChange}
              />
            )}

            {activeTab === "income" && (
              <IncomeTab
                propertyId={effectivePropertyId}
                accounts={accounts}
                refreshKey={refreshKey}
                onDataChange={handleDataChange}
              />
            )}

            {activeTab === "expenses" && (
              <ExpensesTab
                propertyId={effectivePropertyId}
                accounts={accounts}
                refreshKey={refreshKey}
                onDataChange={handleDataChange}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
