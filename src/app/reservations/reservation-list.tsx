"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  Plus,
  Search,
  ChevronRight,
  BedDouble,
} from "lucide-react"
import { ReservationStatus } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  StatusBadge,
  DataTableShell,
  MobileCardList,
  EmptyState,
  MoneyText,
} from "@/components/ui-kit"
import { formatDate, formatStayRange } from "@/lib/date-format"
import { cn } from "@/lib/utils"

export interface SerializedReservation {
  id: string
  reservationNo: string
  status: ReservationStatus
  specialRequests: string | null
  createdAt: string
  customer: {
    id: string
    firstName: string
    lastName: string | null
    phone: string | null
    email: string | null
  }
  creator: {
    id: string
    name: string
    email: string
    role: string
  }
  rooms: {
    id: string
    roomId: string
    roomNo: string
    displayName: string | null
    buildingName: string
    floorNo: number
    categoryName: string
    arrivalDate: string
    departureDate: string
    bookedNightlyRate: string
    adults: number
    children: number
    status: string
  }[]
}

export interface ReservationPagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface ReservationListProps {
  initialReservations: SerializedReservation[]
  initialPagination?: ReservationPagination
}

const STATUS_TABS = [
  { value: "ALL", label: "All" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
]

export function ReservationList({
  initialReservations,
  initialPagination,
}: ReservationListProps) {
  const router = useRouter()
  const [reservations, setReservations] = React.useState<SerializedReservation[]>(initialReservations)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")
  const [currentPage, setCurrentPage] = React.useState(initialPagination?.page || 1)
  const [pagination, setPagination] = React.useState<ReservationPagination>(
    initialPagination || {
      total: initialReservations.length,
      page: 1,
      limit: 20,
      totalPages: Math.max(1, Math.ceil(initialReservations.length / 20)),
    }
  )
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const prevFiltersRef = React.useRef({
    searchTerm,
    statusFilter,
    currentPage,
  })

  const fetchReservations = React.useCallback(async () => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (searchTerm.trim()) params.set("search", searchTerm.trim())
      if (statusFilter !== "ALL") params.set("status", statusFilter)
      params.set("page", String(currentPage))
      params.set("limit", "20")

      const res = await fetch(`/api/reservations?${params.toString()}`, {
        signal: controller.signal,
      })
      if (res.status === 403) {
        const errJson = await res.json().catch(() => null)
        if (errJson?.mustChangePassword) {
          router.push("/change-password")
          return
        }
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        throw new Error(errJson?.error || "Failed to load reservations")
      }
      const data = await res.json()

      if (data.success) {
        const mapped: SerializedReservation[] = data.reservations.map((r: {
          id: string
          reservationNo: string
          status: ReservationStatus
          specialRequests: string | null
          createdAt: string
          customer: { id: string; firstName: string; lastName: string | null; phone: string | null; email: string | null }
          creator: { id: string; name: string; email: string; role: { name: string } | string }
          rooms: Array<{
            id: string
            roomId: string
            room: { roomNo: string; displayName: string | null; building?: { name: string }; floor?: { floorNo: number } }
            roomCategory?: { name: string }
            arrivalDate: string
            departureDate: string
            bookedNightlyRate: string | number
            adults: number
            children: number
            status: string
          }>
        }) => ({
          id: r.id,
          reservationNo: r.reservationNo,
          status: r.status,
          specialRequests: r.specialRequests,
          createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt).toISOString(),
          customer: {
            id: r.customer.id,
            firstName: r.customer.firstName,
            lastName: r.customer.lastName,
            phone: r.customer.phone,
            email: r.customer.email,
          },
          creator: {
            id: r.creator.id,
            name: r.creator.name,
            email: r.creator.email,
            role: typeof r.creator.role === "object" && r.creator.role !== null ? (r.creator.role as { name: string }).name : String(r.creator.role),
          },
          rooms: r.rooms.map((rm) => ({
            id: rm.id,
            roomId: rm.roomId,
            roomNo: rm.room.roomNo,
            displayName: rm.room.displayName,
            buildingName: rm.room.building?.name || "",
            floorNo: rm.room.floor?.floorNo || 0,
            categoryName: rm.roomCategory?.name || "",
            arrivalDate: typeof rm.arrivalDate === "string" ? rm.arrivalDate.split("T")[0]! : new Date(rm.arrivalDate).toISOString().split("T")[0]!,
            departureDate: typeof rm.departureDate === "string" ? rm.departureDate.split("T")[0]! : new Date(rm.departureDate).toISOString().split("T")[0]!,
            bookedNightlyRate: String(rm.bookedNightlyRate),
            adults: rm.adults,
            children: rm.children,
            status: rm.status,
          })),
        }))

        setReservations(mapped)
        if (data.pagination) {
          setPagination(data.pagination)
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return
      }
      console.error("Error searching reservations:", err)
      const msg = err instanceof Error ? err.message : "Unable to load reservations. Please check your connection and retry."
      setError(msg)
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false)
      }
    }
  }, [searchTerm, statusFilter, currentPage, router])

  React.useEffect(() => {
    const prev = prevFiltersRef.current
    const hasChanged =
      prev.searchTerm !== searchTerm ||
      prev.statusFilter !== statusFilter ||
      prev.currentPage !== currentPage

    if (!hasChanged) {
      return
    }

    prevFiltersRef.current = { searchTerm, statusFilter, currentPage }

    const timer = setTimeout(() => {
      fetchReservations()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, statusFilter, currentPage, fetchReservations])

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const calculateStayDates = (rooms: SerializedReservation["rooms"]) => {
    if (rooms.length === 0) return { dates: "—", nights: 0 }
    const arrivals = rooms.map((r) => r.arrivalDate).sort()
    const departures = rooms.map((r) => r.departureDate).sort()
    const earliest = arrivals[0]!
    const latest = departures[departures.length - 1]!

    const arrDate = new Date(earliest)
    const depDate = new Date(latest)
    const nights = Math.max(1, Math.round((depDate.getTime() - arrDate.getTime()) / (1000 * 60 * 60 * 24)))

    return {
      dates: formatStayRange(earliest, latest),
      nights,
    }
  }

  const calculateTotalEst = (rooms: SerializedReservation["rooms"]) => {
    return rooms.reduce((sum, r) => {
      const arr = new Date(r.arrivalDate)
      const dep = new Date(r.departureDate)
      const nights = Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)))
      return sum + parseFloat(r.bookedNightlyRate || "0") * nights
    }, 0)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Reservations"
        description="Reception desk guest booking registry and stay schedules"
        action={
          <Link href="/reservations/new">
            <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs">
              <Plus className="size-3.5" />
              New Reservation
            </Button>
          </Link>
        }
      />

      {/* Toolbar: Search + Status Segmented Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
          <Input
            placeholder="Search reservation #, guest name, phone..."
            className="pl-9 h-9 text-xs sm:text-sm bg-card border-border/80 shadow-2xs"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
          />
        </div>

        {/* Status segmented control */}
        <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-1 shrink-0 overflow-x-auto shadow-2xs">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.value)
                  setCurrentPage(1)
                }}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer",
                  active
                    ? "bg-card text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table & Mobile Card List */}
      <DataTableShell
        isLoading={loading}
        error={error}
        onRetry={fetchReservations}
        isEmpty={reservations.length === 0}
        emptyState={
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title="No reservations found"
            description={
              searchTerm || statusFilter !== "ALL"
                ? "No bookings match your current search or status filter."
                : "No reservations have been registered yet."
            }
            action={
              <Link href="/reservations/new">
                <Button size="sm">
                  <Plus className="size-4 mr-1.5" />
                  Create Reservation
                </Button>
              </Link>
            }
          />
        }
        pagination={{
          page: currentPage,
          totalPages: pagination.totalPages,
          totalCount: pagination.total,
          limit: pagination.limit,
          onPageChange: (p) => setCurrentPage(p),
        }}
        mobileView={
          <MobileCardList
            items={reservations}
            keyExtractor={(r) => r.id}
            renderCard={(res) => {
              const guestName = `${res.customer.firstName} ${res.customer.lastName || ""}`.trim()
              const { dates, nights } = calculateStayDates(res.rooms)
              const totalEst = calculateTotalEst(res.rooms)

              return (
                <div
                  onClick={() => router.push(`/reservations/${res.id}`)}
                  onMouseEnter={() => router.prefetch(`/reservations/${res.id}`)}
                  className="rounded-xl border border-border/80 bg-card p-4 space-y-3 cursor-pointer hover:border-primary/40 transition-colors shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono font-bold text-sm text-foreground truncate min-w-0">
                      #{res.reservationNo}
                    </div>
                    <StatusBadge status={res.status} size="sm" />
                  </div>

                  <div className="space-y-1 text-xs min-w-0">
                    <div className="font-medium text-foreground text-sm truncate" title={guestName}>{guestName}</div>
                    {(res.customer.phone || res.customer.email) && (
                      <div className="text-muted-foreground truncate">
                        {res.customer.phone || res.customer.email}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                    <div>
                      <div className="text-muted-foreground">{dates}</div>
                      <div className="text-[11px] text-muted-foreground/80">{nights} night{nights === 1 ? "" : "s"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-muted-foreground text-[11px]">Est. Total</div>
                      <MoneyText value={totalEst} className="text-sm font-bold text-foreground" />
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
              <TableHead className="w-[170px] text-xs font-semibold">Reservation</TableHead>
              <TableHead className="text-xs font-semibold">Guest</TableHead>
              <TableHead className="text-xs font-semibold">Stay</TableHead>
              <TableHead className="text-xs font-semibold">Rooms</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-right text-xs font-semibold">Total (est.)</TableHead>
              <TableHead className="w-[44px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {reservations.map((res) => {
              const guestName = `${res.customer.firstName} ${res.customer.lastName || ""}`.trim()
              const { dates, nights } = calculateStayDates(res.rooms)
              const totalEst = calculateTotalEst(res.rooms)
              const firstRooms = res.rooms.slice(0, 2)
              const remainingCount = res.rooms.length - 2

              return (
                <TableRow
                  key={res.id}
                  onClick={() => router.push(`/reservations/${res.id}`)}
                  onMouseEnter={() => router.prefetch(`/reservations/${res.id}`)}
                  className="h-16 text-xs hover:bg-muted/40 cursor-pointer transition-colors group"
                >
                  <TableCell className="font-medium">
                    <span className="font-mono font-semibold text-foreground text-xs block">
                      #{res.reservationNo}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(res.createdAt)}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="font-medium text-foreground block truncate max-w-[200px]" title={guestName}>{guestName}</span>
                    <span className="text-[11px] text-muted-foreground truncate block max-w-[180px]">
                      {res.customer.phone || res.customer.email || "No contact"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="text-foreground block">{dates}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {nights} night{nights === 1 ? "" : "s"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {firstRooms.map((rm) => (
                        <span
                          key={rm.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/80 text-[11px] font-mono text-foreground border border-border/60 max-w-[140px]"
                          title={`Room ${rm.roomNo}`}
                        >
                          <BedDouble className="size-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{rm.roomNo}</span>
                        </span>
                      ))}
                      {remainingCount > 0 && (
                        <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50 border border-border/40 font-mono">
                          +{remainingCount}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={res.status} size="sm" />
                  </TableCell>

                  <TableCell className="text-right">
                    <MoneyText value={totalEst} className="font-semibold text-foreground text-xs" />
                  </TableCell>

                  <TableCell className="text-right p-0 pr-4">
                    <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground transition-colors ml-auto" />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </DataTableShell>
    </div>
  )
}
