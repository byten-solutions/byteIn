"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Plus,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  Loader2,
} from "lucide-react"
import { RoleName } from "@prisma/client"
import { CreateExpenseDialog } from "@/app/finance/expense-dialogs"
import { CreateIncomeDialog } from "@/app/finance/income-dialogs"
import { CreateTransferDialog } from "@/app/finance/transfer-dialog"
import { CollectPaymentQuickDialog } from "./collect-payment-quick-dialog"
import type { ExpenseHeadDTO } from "@/modules/expenses/expenses.types"
import type { IncomeHeadDTO } from "@/modules/income/income.types"
import type { FinancialAccountWithBalanceDTO } from "@/modules/financial-accounts/financial-accounts.types"

export interface DashboardQuickActionsProps {
  role: RoleName
  propertyId: string
}

export function DashboardQuickActions({
  role,
  propertyId,
}: DashboardQuickActionsProps) {
  const router = useRouter()

  // Dialog open states
  const [isExpenseOpen, setIsExpenseOpen] = React.useState(false)
  const [isIncomeOpen, setIsIncomeOpen] = React.useState(false)
  const [isTransferOpen, setIsTransferOpen] = React.useState(false)
  const [isCollectPaymentOpen, setIsCollectPaymentOpen] = React.useState(false)

  // Lazy loaded options
  const [expenseCategories, setExpenseCategories] = React.useState<ExpenseHeadDTO[]>([])
  const [incomeCategories, setIncomeCategories] = React.useState<IncomeHeadDTO[]>([])
  const [accounts, setAccounts] = React.useState<FinancialAccountWithBalanceDTO[]>([])

  const [loadingExpenseCategories, setLoadingExpenseCategories] = React.useState(false)
  const [loadingIncomeCategories, setLoadingIncomeCategories] = React.useState(false)
  const [loadingAccounts, setLoadingAccounts] = React.useState(false)

  const handleOpenExpense = async () => {
    if (expenseCategories.length === 0) {
      setLoadingExpenseCategories(true)
      try {
        const res = await fetch(`/api/expense-heads?propertyId=${propertyId}&isActive=true`)
        const data = await res.json()
        if (res.ok && Array.isArray(data.expenseHeads)) {
          setExpenseCategories(data.expenseHeads)
        }
      } catch (err) {
        console.error("Failed to load expense categories:", err)
      } finally {
        setLoadingExpenseCategories(false)
      }
    }
    setIsExpenseOpen(true)
  }

  const handleOpenIncome = async () => {
    if (incomeCategories.length === 0) {
      setLoadingIncomeCategories(true)
      try {
        const res = await fetch(`/api/income-heads?propertyId=${propertyId}&isActive=true`)
        const data = await res.json()
        if (res.ok && Array.isArray(data.incomeHeads)) {
          setIncomeCategories(data.incomeHeads)
        }
      } catch (err) {
        console.error("Failed to load income categories:", err)
      } finally {
        setLoadingIncomeCategories(false)
      }
    }
    setIsIncomeOpen(true)
  }

  const handleOpenTransfer = async () => {
    if (accounts.length === 0) {
      setLoadingAccounts(true)
      try {
        const res = await fetch(`/api/financial-accounts?propertyId=${propertyId}&isActive=true`)
        const data = await res.json()
        if (res.ok && Array.isArray(data.accounts)) {
          setAccounts(data.accounts)
        }
      } catch (err) {
        console.error("Failed to load financial accounts:", err)
      } finally {
        setLoadingAccounts(false)
      }
    }
    setIsTransferOpen(true)
  }

  const handleActionSuccess = () => {
    router.refresh()
  }

  const isReceptionist = role === RoleName.RECEPTIONIST

  return (
    <>
      {/* Quick Links Row: Icon followed by text, no large buttons or enclosing cards */}
      <div className="flex items-center gap-x-5 gap-y-2 flex-wrap py-1 text-xs">
        <Link
          href="/reservations/new"
          className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <Plus className="size-3.5 text-primary" />
          <span>New Reservation</span>
        </Link>

        <button
          type="button"
          onClick={() => setIsCollectPaymentOpen(true)}
          className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Receipt className="size-3.5 text-muted-foreground" />
          <span>Collect Payment</span>
        </button>

        {!isReceptionist && (
          <>
            <button
              type="button"
              disabled={loadingExpenseCategories}
              onClick={handleOpenExpense}
              className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingExpenseCategories ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowDownRight className="size-3.5 text-muted-foreground" />
              )}
              <span>New Expense</span>
            </button>

            <button
              type="button"
              disabled={loadingIncomeCategories}
              onClick={handleOpenIncome}
              className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingIncomeCategories ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowUpRight className="size-3.5 text-muted-foreground" />
              )}
              <span>Record Income</span>
            </button>

            <button
              type="button"
              disabled={loadingAccounts}
              onClick={handleOpenTransfer}
              className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingAccounts ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowRightLeft className="size-3.5 text-muted-foreground" />
              )}
              <span>Account Transfer</span>
            </button>
          </>
        )}
      </div>

      {/* Collect Payment Dialog */}
      <CollectPaymentQuickDialog
        isOpen={isCollectPaymentOpen}
        onClose={() => setIsCollectPaymentOpen(false)}
        propertyId={propertyId}
        onSuccess={handleActionSuccess}
      />

      {/* Expense Creation Dialog (Admin / Super Admin) */}
      {!isReceptionist && (
        <>
          <CreateExpenseDialog
            isOpen={isExpenseOpen}
            onClose={() => setIsExpenseOpen(false)}
            propertyId={propertyId}
            categories={expenseCategories}
            onSuccess={handleActionSuccess}
          />

          <CreateIncomeDialog
            isOpen={isIncomeOpen}
            onClose={() => setIsIncomeOpen(false)}
            propertyId={propertyId}
            categories={incomeCategories}
            onSuccess={handleActionSuccess}
          />

          <CreateTransferDialog
            isOpen={isTransferOpen}
            onClose={() => setIsTransferOpen(false)}
            propertyId={propertyId}
            accounts={accounts}
            onSuccess={handleActionSuccess}
          />
        </>
      )}
    </>
  )
}
