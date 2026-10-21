"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Users,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  CalendarPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  PageHeader,
  DataTableShell,
  MobileCardList,
  EmptyState,
} from "@/components/ui-kit"
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination"
import { getIdProofOptions } from "@/lib/constants"
import { formatDate } from "@/lib/date-format"

export interface SerializedCustomerReservation {
  id: string
  status: string
  createdAt: string
  rooms: {
    arrivalDate: string
    departureDate: string
    status: string
  }[]
}

export interface SerializedCustomer {
  id: string
  firstName: string
  lastName: string | null
  phone: string | null
  email: string | null
  nationality: string | null
  address: string | null
  idProofType: string | null
  idProofNumber: string | null
  remarks: string | null
  reservationsCount: number
  createdAt: string
  reservations?: SerializedCustomerReservation[]
}

export interface CustomerPagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

export type FilterTab = "ALL" | "IN_HOUSE" | "UPCOMING" | "REPEAT"
export type StayStatus = "IN_HOUSE" | "UPCOMING" | "PAST" | "NONE"

interface CustomerListProps {
  initialCustomers: SerializedCustomer[]
  initialPagination?: CustomerPagination
  initialTab?: FilterTab
}

export interface CustomerStayMeta {
  status: StayStatus
  statusLabel: string
  lastStayDateStr: string
  sortDate: number
}

function getCustomerStayMeta(c: SerializedCustomer): CustomerStayMeta {
  const reservations = c.reservations || []
  if (reservations.length === 0) {
    return {
      status: "NONE",
      statusLabel: "No stays",
      lastStayDateStr: "—",
      sortDate: 0,
    }
  }

  const todayStr = new Date().toISOString().split("T")[0]
  let hasInHouse = false
  let hasUpcoming = false
  let latestArrival = ""
  let latestSortTimestamp = 0

  for (const res of reservations) {
    if (res.status === "CANCELLED" || res.status === "NO_SHOW") continue

    for (const rm of res.rooms) {
      const arr = rm.arrivalDate
      const dep = rm.departureDate
      const arrivalTime = new Date(arr).getTime()

      if (arrivalTime > latestSortTimestamp) {
        latestSortTimestamp = arrivalTime
        latestArrival = arr
      }

      if (rm.status === "OCCUPIED" || (res.status === "CHECKED_IN" && arr <= todayStr && dep >= todayStr)) {
        hasInHouse = true
      } else if (arr > todayStr && (res.status === "CONFIRMED" || res.status === "CHECKED_IN")) {
        hasUpcoming = true
      }
    }
  }

  if (latestSortTimestamp === 0 && reservations[0]) {
    latestSortTimestamp = new Date(reservations[0].createdAt).getTime()
  }

  let status: StayStatus = "PAST"
  let statusLabel = "Past"
  if (hasInHouse) {
    status = "IN_HOUSE"
    statusLabel = "In house"
  } else if (hasUpcoming) {
    status = "UPCOMING"
    statusLabel = "Upcoming"
  } else if (latestSortTimestamp === 0) {
    status = "NONE"
    statusLabel = "No stays"
  }

  const lastStayDateStr = latestArrival
    ? formatDate(latestArrival)
    : reservations[0]
    ? formatDate(reservations[0].createdAt)
    : "—"

  return {
    status,
    statusLabel,
    lastStayDateStr,
    sortDate: latestSortTimestamp,
  }
}

export function CustomerList({
  initialCustomers,
  initialPagination,
  initialTab = "ALL",
}: CustomerListProps) {
  const router = useRouter()
  const [customers, setCustomers] = React.useState<SerializedCustomer[]>(initialCustomers)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [filterTab, setFilterTab] = React.useState<FilterTab>(initialTab)
  const [currentPage, setCurrentPage] = React.useState(initialPagination?.page || 1)
  const [currentLimit, setCurrentLimit] = React.useState(initialPagination?.limit || DEFAULT_PAGE_SIZE)
  const [tabCounts, setTabCounts] = React.useState<Record<FilterTab, number>>({
    ALL: initialTab === "ALL" ? (initialPagination?.total || initialCustomers.length) : 0,
    IN_HOUSE: initialTab === "IN_HOUSE" ? (initialPagination?.total || 0) : 0,
    UPCOMING: initialTab === "UPCOMING" ? (initialPagination?.total || 0) : 0,
    REPEAT: initialTab === "REPEAT" ? (initialPagination?.total || 0) : 0,
  })
  const [pagination, setPagination] = React.useState<CustomerPagination>(
    initialPagination || {
      total: initialCustomers.length,
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(initialCustomers.length / DEFAULT_PAGE_SIZE)),
    }
  )
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  // Track previous filters to prevent initial mount and Strict Mode double refetches
  const prevFiltersRef = React.useRef({
    searchTerm,
    currentPage,
    currentLimit,
    filterTab,
  })

  // Register Guest Dialog State
  const [isRegisterOpen, setIsRegisterOpen] = React.useState(false)
  const [showIdAddress, setShowIdAddress] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const [formData, setFormData] = React.useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    nationality: "",
    address: "",
    idProofType: "Passport",
    idProofNumber: "",
    remarks: "",
  })

  const fetchCustomers = React.useCallback(async (
    query = searchTerm,
    page = currentPage,
    limit = currentLimit,
    tab = filterTab
  ) => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set("search", query.trim())
      if (tab !== "ALL") params.set("tab", tab)
      params.set("page", String(page))
      params.set("limit", String(limit))

      const res = await fetch(`/api/customers?${params.toString()}`, {
        signal: controller.signal,
      })
      if (!res.ok) throw new Error("Failed to fetch customers")
      const data = await res.json()

      if (data.success) {
        const mapped: SerializedCustomer[] = data.customers.map((c: {
          id: string
          firstName: string
          lastName: string | null
          phone: string | null
          email: string | null
          nationality: string | null
          address: string | null
          idProofType: string | null
          idProofNumber: string | null
          remarks: string | null
          _count?: { reservations: number }
          reservationsCount?: number
          createdAt: string | Date
          reservations?: {
            id: string
            status: string
            createdAt: string | Date
            rooms?: {
              arrivalDate: string | Date
              departureDate: string | Date
              status: string
            }[]
          }[]
        }) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          email: c.email,
          nationality: c.nationality,
          address: c.address,
          idProofType: c.idProofType,
          idProofNumber: c.idProofNumber,
          remarks: c.remarks,
          reservationsCount: c._count?.reservations ?? c.reservationsCount ?? 0,
          createdAt: typeof c.createdAt === "string" ? c.createdAt : new Date(c.createdAt).toISOString(),
          reservations: c.reservations?.map((r) => ({
            id: r.id,
            status: r.status,
            createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt).toISOString(),
            rooms: r.rooms?.map((rm) => ({
              arrivalDate: typeof rm.arrivalDate === "string" ? rm.arrivalDate.split("T")[0] : new Date(rm.arrivalDate).toISOString().split("T")[0],
              departureDate: typeof rm.departureDate === "string" ? rm.departureDate.split("T")[0] : new Date(rm.departureDate).toISOString().split("T")[0],
              status: rm.status,
            })) || [],
          })) || [],
        }))

        setCustomers(mapped)
        if (data.pagination) {
          setPagination(data.pagination)
          setTabCounts((prev) => ({
            ...prev,
            [tab]: data.pagination.total,
          }))
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return
      }
      console.error("Error fetching customers:", err)
      setError("Unable to load guest directory. Please retry.")
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false)
      }
    }
  }, [searchTerm, currentPage, currentLimit, filterTab])

  React.useEffect(() => {
    const prev = prevFiltersRef.current
    const searchChanged = prev.searchTerm !== searchTerm
    const pageChanged = prev.currentPage !== currentPage
    const limitChanged = prev.currentLimit !== currentLimit
    const tabChanged = prev.filterTab !== filterTab

    if (!searchChanged && !pageChanged && !limitChanged && !tabChanged) {
      return
    }

    if ((searchChanged || limitChanged || tabChanged) && currentPage !== 1) {
      prevFiltersRef.current = { searchTerm, currentPage: 1, currentLimit, filterTab }
      setCurrentPage(1)
      return
    }

    prevFiltersRef.current = { searchTerm, currentPage, currentLimit, filterTab }

    const timer = setTimeout(() => {
      fetchCustomers(searchTerm, currentPage, currentLimit, filterTab)
    }, 300)

    return () => clearTimeout(timer)
  }, [fetchCustomers, searchTerm, currentPage, currentLimit, filterTab])

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  // Attach stay meta to each customer and sort by last stay date descending
  const customersWithMeta = React.useMemo(() => {
    return customers.map((c) => ({
      customer: c,
      meta: getCustomerStayMeta(c),
    }))
  }, [customers])

  // Sort customers by last stay date descending; if no stay, sort by registration date descending
  const sortedCustomers = React.useMemo(() => {
    const list = [...customersWithMeta]
    list.sort((a, b) => {
      if (a.meta.sortDate !== b.meta.sortDate) {
        return b.meta.sortDate - a.meta.sortDate
      }
      return new Date(b.customer.createdAt).getTime() - new Date(a.customer.createdAt).getTime()
    })
    return list
  }, [customersWithMeta])

  const handleRegisterGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.firstName.trim()) {
      setFormError("First name is required.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to register guest")
      }

      const newCustomer: SerializedCustomer = {
        id: data.customer.id,
        firstName: data.customer.firstName,
        lastName: data.customer.lastName,
        phone: data.customer.phone,
        email: data.customer.email,
        nationality: data.customer.nationality,
        address: data.customer.address,
        idProofType: data.customer.idProofType,
        idProofNumber: data.customer.idProofNumber,
        remarks: data.customer.remarks,
        reservationsCount: 0,
        createdAt: new Date().toISOString(),
        reservations: [],
      }

      setCustomers((prev) => [newCustomer, ...prev])
      setPagination((prev) => ({
        ...prev,
        total: prev.total + 1,
      }))

      toast.success(`Guest ${newCustomer.firstName} registered successfully`)
      setIsRegisterOpen(false)
      setFormData({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        nationality: "",
        address: "",
        idProofType: "Passport",
        idProofNumber: "",
        remarks: "",
      })
      setShowIdAddress(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to register guest"
      setFormError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: tabCounts.ALL },
    { key: "IN_HOUSE", label: "In house", count: tabCounts.IN_HOUSE },
    { key: "UPCOMING", label: "Upcoming", count: tabCounts.UPCOMING },
    { key: "REPEAT", label: "Repeat", count: tabCounts.REPEAT },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Guests"
        description="Reception desk guest directory, profiles, and stay records"
        action={
          <Button
            size="sm"
            onClick={() => {
              setFormError(null)
              setIsRegisterOpen(true)
            }}
            className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs font-semibold"
          >
            <Plus className="size-3.5" />
            <span>Register Guest</span>
          </Button>
        }
      />

      {/* Toolbar: Filter chips and Search input */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => {
            const isActive = filterTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterTab(tab.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground font-semibold"
                      : "bg-muted-foreground/15 text-muted-foreground"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
          <Input
            placeholder="Search by name, phone, email, or ID..."
            className="pl-9 h-9 text-xs sm:text-sm bg-card border-border/80 shadow-2xs"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
          />
        </div>
      </div>

      {/* Table & Mobile Cards */}
      <DataTableShell
        isLoading={loading}
        error={error}
        onRetry={() => fetchCustomers()}
        isEmpty={sortedCustomers.length === 0}
        emptyState={
          <EmptyState
            icon={<Users className="size-6" />}
            title="No guests found"
            description={
              searchTerm
                ? `No guests match "${searchTerm}".`
                : filterTab !== "ALL"
                ? `No guests in the "${filterTabs.find((t) => t.key === filterTab)?.label}" filter.`
                : "No guests registered in directory yet."
            }
            action={
              filterTab !== "ALL" ? (
                <Button size="sm" variant="outline" onClick={() => setFilterTab("ALL")}>
                  Clear Filter
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setIsRegisterOpen(true)}
                  className="gap-1.5"
                >
                  <Plus className="size-4" />
                  <span>Register First Guest</span>
                </Button>
              )
            }
          />
        }
        pagination={{
          page: currentPage,
          totalPages: pagination.totalPages,
          totalCount: pagination.total,
          limit: currentLimit,
          onPageChange: (p) => setCurrentPage(p),
          onLimitChange: (l) => {
            setCurrentLimit(l)
            setCurrentPage(1)
          },
        }}
        mobileView={
          <MobileCardList
            items={sortedCustomers}
            keyExtractor={({ customer }) => customer.id}
            renderCard={({ customer: c, meta }) => {
              const fullName = `${c.firstName} ${c.lastName || ""}`.trim()
              const initials = `${c.firstName[0] || ""}${c.lastName?.[0] || ""}`.toUpperCase()
              const subline = c.address
                ? c.nationality
                  ? `${c.address} · ${c.nationality}`
                  : c.address
                : c.nationality || null

              return (
                <div
                  onClick={() => router.push(`/customers/${c.id}`)}
                  onMouseEnter={() => router.prefetch(`/customers/${c.id}`)}
                  className="rounded-xl border border-border/80 bg-card p-4 space-y-3 cursor-pointer hover:border-primary/40 transition-colors shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground text-sm block truncate">
                          {fullName}
                        </span>
                        {subline && (
                          <span className="text-xs text-muted-foreground block truncate">
                            {subline}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[11px] font-mono text-muted-foreground shrink-0">
                      {c.reservationsCount} stay{c.reservationsCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                    <div className="space-y-0.5 text-muted-foreground">
                      <div>{c.phone || c.email || "No contact"}</div>
                      {c.idProofNumber && (
                        <div className="font-mono text-[11px]">
                          {c.idProofType || "ID"}: {c.idProofNumber.startsWith("••••") ? c.idProofNumber : `•••• ${c.idProofNumber.slice(-4)}`}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-foreground font-medium block">
                        {meta.lastStayDateStr}
                      </span>
                      {meta.status !== "NONE" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              meta.status === "IN_HOUSE" && "bg-emerald-500",
                              meta.status === "UPCOMING" && "bg-blue-500",
                              meta.status === "PAST" && "bg-muted-foreground/60"
                            )}
                          />
                          {meta.statusLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            }}
          />
        }
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold">Guest</TableHead>
              <TableHead className="text-xs font-semibold">Contact</TableHead>
              <TableHead className="text-xs font-semibold">ID Proof</TableHead>
              <TableHead className="text-xs font-semibold">Last Stay</TableHead>
              <TableHead className="text-right text-xs font-semibold">Stays</TableHead>
              <TableHead className="w-[120px] text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCustomers.map(({ customer: c, meta }) => {
              const fullName = `${c.firstName} ${c.lastName || ""}`.trim()
              const initials = `${c.firstName[0] || ""}${c.lastName?.[0] || ""}`.toUpperCase()
              const subline = c.address
                ? c.nationality
                  ? `${c.address} · ${c.nationality}`
                  : c.address
                : c.nationality || null

              return (
                <TableRow
                  key={c.id}
                  onClick={() => router.push(`/customers/${c.id}`)}
                  onMouseEnter={() => router.prefetch(`/customers/${c.id}`)}
                  className="h-16 text-xs hover:bg-muted/40 cursor-pointer transition-colors group"
                >
                  {/* Guest: Initials avatar + name + muted subline */}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground text-xs sm:text-sm block group-hover:text-primary transition-colors truncate max-w-[200px]">
                          {fullName}
                        </span>
                        <span className="text-[11px] text-muted-foreground block truncate max-w-[200px]">
                          {subline || "—"}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Contact: Phone & Email */}
                  <TableCell>
                    <span className="text-foreground text-xs font-mono block">{c.phone || "—"}</span>
                    <span className="text-[11px] text-muted-foreground block truncate max-w-[190px]">
                      {c.email || "No email"}
                    </span>
                  </TableCell>

                  {/* ID Proof: Masked ID (•••• 1234) */}
                  <TableCell>
                    {c.idProofNumber ? (
                      <div>
                        <span className="font-mono text-foreground text-xs block">
                          {c.idProofNumber.startsWith("••••")
                            ? c.idProofNumber
                            : `•••• ${c.idProofNumber.slice(-4)}`}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {c.idProofType || "Document"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50 italic text-xs">Unrecorded</span>
                    )}
                  </TableCell>

                  {/* Last Stay: Date with small status tag (In house / Upcoming / Past) */}
                  <TableCell>
                    <div>
                      <span className="text-foreground text-xs font-medium block">
                        {meta.lastStayDateStr}
                      </span>
                      {meta.status !== "NONE" ? (
                        <div className="inline-flex items-center gap-1.5 mt-0.5">
                          <span
                            className={cn(
                              "size-1.5 rounded-full shrink-0",
                              meta.status === "IN_HOUSE" && "bg-emerald-500",
                              meta.status === "UPCOMING" && "bg-blue-500",
                              meta.status === "PAST" && "bg-muted-foreground/60"
                            )}
                          />
                          <span
                            className={cn(
                              "text-[10px] font-medium",
                              meta.status === "IN_HOUSE" && "text-emerald-700 dark:text-emerald-400",
                              meta.status === "UPCOMING" && "text-blue-700 dark:text-blue-400",
                              meta.status === "PAST" && "text-muted-foreground"
                            )}
                          >
                            {meta.statusLabel}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/60">No prior stays</span>
                      )}
                    </div>
                  </TableCell>

                  {/* Stays Count */}
                  <TableCell className="text-right font-mono font-medium">
                    <span className="rounded-full bg-muted/80 px-2.5 py-0.5 text-xs text-foreground">
                      {c.reservationsCount} stay{c.reservationsCount === 1 ? "" : "s"}
                    </span>
                  </TableCell>

                  {/* Action: Hover "Book stay" + Chevron */}
                  <TableCell className="text-right pr-4">
                    <div
                      className="flex items-center justify-end gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link href={`/reservations/new?customerId=${c.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-[11px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity font-medium border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
                        >
                          <CalendarPlus className="size-3" />
                          <span>Book stay</span>
                        </Button>
                      </Link>
                      <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground transition-colors ml-1" />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </DataTableShell>

      {/* REGISTER GUEST DIALOG */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Guest</DialogTitle>
            <DialogDescription>
              Create a new guest record in the property directory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterGuest} className="space-y-4 py-2 text-xs">
            {formError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive font-medium">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">First Name *</Label>
                <Input
                  placeholder="e.g. Jane"
                  className="h-10 text-xs sm:text-sm"
                  value={formData.firstName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Last Name</Label>
                <Input
                  placeholder="e.g. Smith"
                  className="h-10 text-xs sm:text-sm"
                  value={formData.lastName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone</Label>
                <Input
                  placeholder="+91 98765 43210"
                  className="h-10 text-xs sm:text-sm font-mono"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <Input
                  type="email"
                  placeholder="e.g. jane@example.com"
                  className="h-10 text-xs sm:text-sm"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>

            {/* Collapsed ID and address section */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowIdAddress(!showIdAddress)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                {showIdAddress ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                <span>ID proof & address (optional)</span>
              </button>

              {showIdAddress && (
                <div className="mt-2.5 space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3.5 animate-in fade-in-50">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">Nationality</Label>
                    <Input
                      placeholder="e.g. Indian"
                      className="h-9 text-xs"
                      value={formData.nationality}
                      onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium">ID Proof Type</Label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-xs"
                        value={formData.idProofType}
                        onChange={(e) => setFormData((prev) => ({ ...prev, idProofType: e.target.value }))}
                      >
                        {getIdProofOptions(formData.idProofType).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium">ID Proof Number</Label>
                      <Input
                        placeholder="e.g. Pass No or National ID"
                        className="h-9 text-xs font-mono"
                        value={formData.idProofNumber}
                        onChange={(e) => setFormData((prev) => ({ ...prev, idProofNumber: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">Residential Address</Label>
                    <Input
                      placeholder="City, State"
                      className="h-9 text-xs"
                      value={formData.address}
                      onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium">Remarks / Preferences</Label>
                    <Input
                      placeholder="VIP, quiet room requested..."
                      className="h-9 text-xs"
                      value={formData.remarks}
                      onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRegisterOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Registering...
                  </>
                ) : (
                  "Register Guest"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
