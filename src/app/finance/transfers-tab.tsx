"use client"

import * as React from "react"
import { Plus, ArrowRightLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
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
  selectedTransferId: propSelectedTransferId,
}: {
  propertyId: string
  accounts: FinancialAccountWithBalanceDTO[]
  refreshKey: number
  onTransferSuccess: () => void
  selectedTransferId?: string
}) {
  const [selectedTransferId, setSelectedTransferId] = React.useState<string | null>(
    propSelectedTransferId || null
  )
  const [transfers, setTransfers] = React.useState<AccountTransferDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [page, setPage] = React.useState(1)
  const [limit, setLimit] = React.useState(20)
  const [total, setTotal] = React.useState(0)

  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")

  const [isTransferOpen, setIsTransferOpen] = React.useState(false)
  const selectedRowRef = React.useRef<HTMLTableRowElement | null>(null)

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
          let list: AccountTransferDTO[] = data.transfers || []

          // If selectedTransferId is set but not in list, attempt to fetch it specifically so it's visible
          if (selectedTransferId && !list.some((t) => t.id === selectedTransferId)) {
            try {
              const singleRes = await fetch(
                `/api/account-transfers?propertyId=${encodeURIComponent(propertyId)}&transferId=${encodeURIComponent(selectedTransferId)}`
              )
              const singleData = await singleRes.json()
              if (singleRes.ok && singleData.transfers && singleData.transfers.length > 0) {
                list = [singleData.transfers[0], ...list]
              }
            } catch {
              // Ignore single transfer fetch failure and keep main list
            }
          }

          setTransfers(list)
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
  }, [propertyId, page, limit, startDate, endDate, refreshKey, selectedTransferId])

  React.useEffect(() => {
    if (selectedTransferId && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [selectedTransferId, transfers])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6">
      {/* Selected Transfer Banner */}
      {selectedTransferId && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <span className="flex size-2 rounded-full bg-primary animate-pulse" />
            <span>Focused on selected transfer from Financial Activity Timeline.</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTransferId(null)}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear Focus
          </Button>
        </div>
      )}

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
        <div className="rounded-xl border border-border bg-card overflow-x-auto max-h-[540px] overflow-y-auto">
          <Table className="text-xs">
            <TableHeader className="sticky top-0 bg-muted/95 backdrop-blur z-10">
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
              {transfers.map((tr) => {
                const isSelected = selectedTransferId === tr.id
                return (
                  <TableRow
                    key={tr.id}
                    ref={isSelected ? selectedRowRef : undefined}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      isSelected && "bg-primary/10 border-l-4 border-primary font-medium"
                    )}
                  >
                    <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{formatDate(tr.transferDate)}</span>
                        {isSelected && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono px-1 py-0 h-4 border-primary/30 bg-primary/15 text-primary"
                          >
                            Selected
                          </Badge>
                        )}
                      </div>
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
                )
              })}
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
