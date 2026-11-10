"use client"

import * as React from "react"
import { Plus, ArrowRightLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DataTableShell,
  StatusBadge,
  MoneyText,
  EmptyState,
} from "@/components/ui-kit"
import { formatDate } from "@/lib/date-format"
import { CreateTransferDialog } from "./transfer-dialog"
import type {
  AccountTransferDTO,
  FinancialAccountWithBalanceDTO,
} from "@/modules/financial-accounts/financial-accounts.types"

export function TransfersTab({
  propertyId,
  accounts,
  refreshKey,
  onTransferSuccess,
}: {
  propertyId: string
  accounts: FinancialAccountWithBalanceDTO[]
  refreshKey: number
  onTransferSuccess: () => void
}) {
  const [transfers, setTransfers] = React.useState<AccountTransferDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [page, setPage] = React.useState(1)
  const [limit, setLimit] = React.useState(20)
  const [total, setTotal] = React.useState(0)

  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")

  const [isTransferOpen, setIsTransferOpen] = React.useState(false)

  const refresh = React.useCallback(() => {
    setLoading(true)
    onTransferSuccess()
  }, [onTransferSuccess])

  React.useEffect(() => {
    if (!propertyId) return
    let mounted = true

    async function loadTransfers() {
      try {
        const params = new URLSearchParams({
          propertyId,
          page: String(page),
          limit: String(limit),
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        })

        const res = await fetch(`/api/account-transfers?${params.toString()}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load transfer history")
        if (mounted) {
          setTransfers(data.transfers || [])
          setTotal(data.total || 0)
          setError(null)
          setLoading(false)
        }
      } catch (err: unknown) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : "Failed to load transfer history"
          setError(msg)
          setLoading(false)
        }
      }
    }

    loadTransfers()

    return () => {
      mounted = false
    }
  }, [propertyId, page, limit, startDate, endDate, refreshKey])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6">
      {/* Header Filters & Action */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="trFilterStart" className="text-xs font-medium text-muted-foreground">From:</Label>
            <Input
              id="trFilterStart"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(1)
              }}
              className="h-9 w-36 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="trFilterEnd" className="text-xs font-medium text-muted-foreground">To:</Label>
            <Input
              id="trFilterEnd"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(1)
              }}
              className="h-9 w-36 text-xs"
            />
          </div>
          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate("")
                setEndDate("")
                setPage(1)
              }}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear Dates
            </Button>
          )}
        </div>

        <Button
          size="sm"
          onClick={() => setIsTransferOpen(true)}
          className="gap-1.5 font-semibold text-xs shrink-0"
        >
          <Plus className="size-3.5" />
          New Inter-Account Transfer
        </Button>
      </div>

      {/* Transfers Table */}
      <DataTableShell
        isLoading={loading}
        error={error}
        onRetry={refresh}
        isEmpty={transfers.length === 0}
        emptyState={
          <EmptyState
            icon={<ArrowRightLeft className="size-6 text-muted-foreground" />}
            title="No account transfers recorded"
            description="Execute funds transfers between physical cash drawers and bank operating accounts."
            action={
              <Button size="sm" onClick={() => setIsTransferOpen(true)}>
                <Plus className="size-3.5 mr-1" /> New Transfer
              </Button>
            }
          />
        }
        pagination={{
          page,
          totalPages,
          totalCount: total,
          limit,
          onPageChange: (p) => setPage(p),
          onLimitChange: (l) => {
            setLimit(l)
            setPage(1)
          },
        }}
      >
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-foreground w-28">Date</TableHead>
                <TableHead className="font-semibold text-foreground">Transfer Flow (Source → Destination)</TableHead>
                <TableHead className="font-semibold text-foreground">Ref #</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Amount</TableHead>
                <TableHead className="font-semibold text-foreground">Description / Notes</TableHead>
                <TableHead className="font-semibold text-foreground">Executed By</TableHead>
                <TableHead className="font-semibold text-foreground text-center w-24">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((tr) => (
                <TableRow key={tr.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                    {formatDate(tr.transferDate)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="text-foreground">{tr.fromAccountName}</span>
                      <ArrowRight className="size-3 text-muted-foreground" />
                      <span className="text-foreground font-semibold">{tr.toAccountName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {tr.referenceNumber || "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-sm text-foreground">
                    <MoneyText value={tr.amount} />
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {tr.description || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tr.createdByName || "Staff"}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={tr.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataTableShell>

      {/* Transfer Dialog */}
      <CreateTransferDialog
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        propertyId={propertyId}
        accounts={accounts}
        onSuccess={() => {
          onTransferSuccess()
        }}
      />
    </div>
  )
}
