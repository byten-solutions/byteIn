"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PaginationFooter } from "@/components/ui-kit"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { AvailabilityGridDTO } from "@/modules/reports/reports.types"
import { useReportQuery } from "./use-report-query"
import { ReportSectionError, TableSkeleton } from "./report-section-shell"

interface AvailabilityGridTabProps {
  initialStartDate: string
  initialEndDate: string
  propertyId?: string
  isSuperAdmin?: boolean
  refreshTrigger?: number
}

interface PropertyOption {
  id: string
  name: string
}

interface CategoryOption {
  id: string
  name: string
}

interface FloorOption {
  id: string
  floorNo: number
}

interface BuildingOption {
  id: string
  name: string
  floors?: FloorOption[]
}

export function AvailabilityGridTab({
  initialStartDate,
  initialEndDate,
  propertyId,
  isSuperAdmin = false,
  refreshTrigger = 0,
}: AvailabilityGridTabProps) {
  const [selectedPropertyId, setSelectedPropertyId] = React.useState<string | undefined>(propertyId)
  const [gridStart, setGridStart] = React.useState<string>(initialStartDate)
  const [gridEnd, setGridEnd] = React.useState<string>(initialEndDate)
  const [categoryId, setCategoryId] = React.useState<string | undefined>(undefined)
  const [buildingId, setBuildingId] = React.useState<string | undefined>(undefined)
  const [floorId, setFloorId] = React.useState<string | undefined>(undefined)
  const [searchQuery, setSearchQuery] = React.useState<string>("")
  const [debouncedQuery, setDebouncedQuery] = React.useState<string>("")
  const [page, setPage] = React.useState<number>(1)
  const [limit, setLimit] = React.useState<number>(25)

  // Options loaded for selectors
  const [properties, setProperties] = React.useState<PropertyOption[]>([])
  const [categories, setCategories] = React.useState<CategoryOption[]>([])
  const [buildings, setBuildings] = React.useState<BuildingOption[]>([])

  // Debounce search input by 300ms
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Load properties for SUPER_ADMIN
  React.useEffect(() => {
    if (!isSuperAdmin) return
    let active = true
    fetch("/api/properties")
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success && Array.isArray(json.properties)) {
          setProperties(json.properties.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [isSuperAdmin])

  // Main grid query
  const queryParams = React.useMemo(() => {
    const p: Record<string, string | number | undefined> = {
      startDate: gridStart,
      endDate: gridEnd,
      propertyId: selectedPropertyId,
      buildingId,
      floorId,
      q: debouncedQuery || undefined,
      page,
      limit,
    }
    if (categoryId !== undefined) {
      p.categoryId = categoryId
    }
    return p
  }, [gridStart, gridEnd, selectedPropertyId, categoryId, buildingId, floorId, debouncedQuery, page, limit])

  const { data, isLoading, error, refetch } = useReportQuery<AvailabilityGridDTO>({
    endpoint: "/api/reports/availability-grid",
    params: queryParams,
    enabled: true,
    refreshTrigger,
  })

  // Synchronize effective property if not set initially
  const effectivePropertyId = selectedPropertyId || data?.selectedProperty?.id

  // Load categories scoped to the effective property
  React.useEffect(() => {
    if (!effectivePropertyId) return
    let active = true
    fetch(`/api/room-categories?propertyId=${effectivePropertyId}`)
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success && Array.isArray(json.categories)) {
          setCategories(json.categories.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [effectivePropertyId])

  // Load buildings scoped to the effective property
  React.useEffect(() => {
    if (!effectivePropertyId) return
    let active = true
    fetch(`/api/properties/${effectivePropertyId}/buildings`)
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success && Array.isArray(json.buildings)) {
          setBuildings(json.buildings)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [effectivePropertyId])

  // Derive floors for current building selection
  const availableFloors = React.useMemo(() => {
    if (!buildingId) {
      // Aggregate all floors from all buildings
      const allFloors: FloorOption[] = []
      const seen = new Set<string>()
      for (const b of buildings) {
        for (const fl of b.floors ?? []) {
          if (!seen.has(fl.id)) {
            seen.add(fl.id)
            allFloors.push(fl)
          }
        }
      }
      return allFloors.sort((a, b) => a.floorNo - b.floorNo)
    }
    const b = buildings.find((x) => x.id === buildingId)
    return (b?.floors ?? []).slice().sort((a, b) => a.floorNo - b.floorNo)
  }, [buildingId, buildings])

  // Current category selection (defaults to data.selectedCategory when undefined)
  const activeCategoryIdValue =
    categoryId !== undefined
      ? categoryId
      : data?.selectedCategory?.id ?? ""

  const activePropertyName =
    data?.selectedProperty?.name ||
    properties.find((p) => p.id === effectivePropertyId)?.name ||
    "Selected Hotel"

  const handlePropertyChange = (newPropId: string) => {
    setSelectedPropertyId(newPropId)
    setCategoryId(undefined)
    setBuildingId(undefined)
    setFloorId(undefined)
    setSearchQuery("")
    setPage(1)
  }

  const handleDateWindowPreset = (days: number) => {
    const now = new Date()
    const s = now.toISOString().split("T")[0]!
    const e = new Date(now.getTime() + (days - 1) * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!
    setGridStart(s)
    setGridEnd(e)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Super Admin Hotel Scope Switcher & Banner */}
      {isSuperAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground print:hidden">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary shrink-0" />
            <span>
              Showing <strong className="font-semibold text-primary">{activePropertyName}</strong>. Pick another hotel to switch.
            </span>
          </div>
          {properties.length > 0 && (
            <div className="flex items-center gap-2">
              <Label htmlFor="grid-hotel-select" className="text-xs text-muted-foreground whitespace-nowrap">
                Hotel:
              </Label>
              <select
                id="grid-hotel-select"
                value={effectivePropertyId || ""}
                onChange={(e) => handlePropertyChange(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Grid Controls & Filters */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4 print:hidden">
        {/* Top row: Date Range & Presets + Legend */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Window:
            </Label>
            <Input
              type="date"
              aria-label="Start Date"
              value={gridStart}
              onChange={(e) => {
                setGridStart(e.target.value)
                setPage(1)
              }}
              className="h-8 w-36 text-xs"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              aria-label="End Date"
              value={gridEnd}
              onChange={(e) => {
                setGridEnd(e.target.value)
                setPage(1)
              }}
              className="h-8 w-36 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleDateWindowPreset(7)}
            >
              Next 7 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleDateWindowPreset(14)}
            >
              14 Days
            </Button>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-3.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-xs bg-emerald-100 border border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-xs bg-blue-500 text-white" />
              Booked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-xs bg-amber-500 text-white" />
              Checked In
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-xs bg-rose-500 text-white" />
              Maintenance
            </span>
          </div>
        </div>

        {/* Bottom row: Category, Building, Floor & Search Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="size-3.5" />
            <span className="font-medium">Filter by:</span>
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5">
            <Label htmlFor="category-filter" className="text-xs text-muted-foreground">
              Category:
            </Label>
            <select
              id="category-filter"
              value={activeCategoryIdValue}
              onChange={(e) => {
                setCategoryId(e.target.value)
                setPage(1)
              }}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Building Dropdown */}
          {buildings.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Label htmlFor="building-filter" className="text-xs text-muted-foreground">
                Building:
              </Label>
              <select
                id="building-filter"
                value={buildingId || ""}
                onChange={(e) => {
                  setBuildingId(e.target.value || undefined)
                  setFloorId(undefined)
                  setPage(1)
                }}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Buildings</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Floor Dropdown */}
          {availableFloors.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Label htmlFor="floor-filter" className="text-xs text-muted-foreground">
                Floor:
              </Label>
              <select
                id="floor-filter"
                value={floorId || ""}
                onChange={(e) => {
                  setFloorId(e.target.value || undefined)
                  setPage(1)
                }}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Floors</option>
                {availableFloors.map((fl) => (
                  <option key={fl.id} value={fl.id}>
                    Floor {fl.floorNo}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Room Number Search Input */}
          <div className="relative ml-auto flex items-center min-w-[160px] max-w-[220px]">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              aria-label="Search room number"
              placeholder="Search room no..."
              maxLength={50}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {isLoading && !data && (
        <TableSkeleton rows={8} cols={8} />
      )}

      {error && !data && (
        <ReportSectionError
          title="Failed to load availability grid"
          error={error}
          onRetry={refetch}
        />
      )}

      {data && (
        <div className={cn("rounded-xl border border-border bg-card overflow-hidden", isLoading && "opacity-60")}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="sticky left-0 z-20 min-w-[140px] border-r border-border bg-muted px-3 py-2.5 font-semibold">
                    Room / Cat
                  </th>
                  {data.dates.map((dateStr) => {
                    const d = new Date(`${dateStr}T00:00:00.000Z`)
                    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]
                    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6
                    return (
                      <th
                        key={dateStr}
                        className={cn(
                          "min-w-[90px] border-r border-border px-2 py-2 text-center",
                          isWeekend && "bg-muted/80"
                        )}
                      >
                        <div className="font-semibold">{dayName}</div>
                        <div className="text-[11px] text-muted-foreground">{dateStr.slice(5)}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rooms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={data.dates.length + 1}
                      className="px-4 py-8 text-center text-xs text-muted-foreground"
                    >
                      No rooms found matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  data.rooms.map((room) => (
                    <tr key={room.roomId} className="hover:bg-muted/10">
                      {/* Fixed Left Header Column */}
                      <td className="sticky left-0 z-10 border-r border-border bg-card px-3 py-2 font-medium">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">Room {room.roomNo}</span>
                          <span className="text-[10px] text-muted-foreground">F{room.floorNo}</span>
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {room.categoryName}
                        </div>
                      </td>

                      {/* Day Slot Cells */}
                      {room.slots.map((slot) => {
                        if (slot.isOccupied) {
                          const isCheckedIn = slot.allocationStatus === "CHECKED_IN"
                          return (
                            <td
                              key={slot.date}
                              className="border-r border-border p-1"
                            >
                              <Link
                                href={`/reservations/${slot.reservationId}`}
                                title={`${slot.guestName || "Guest"} (${slot.reservationNo})`}
                                className={cn(
                                  "block rounded-md p-1.5 text-[11px] font-medium transition-opacity hover:opacity-80 text-white",
                                  isCheckedIn ? "bg-amber-600" : "bg-blue-600"
                                )}
                              >
                                <div className="truncate font-semibold">{slot.guestName || "Guest"}</div>
                                <div className="truncate text-[9px] opacity-90">{slot.reservationNo}</div>
                              </Link>
                            </td>
                          )
                        }

                        if (slot.isMaintenance) {
                          return (
                            <td
                              key={slot.date}
                              className="border-r border-border bg-rose-50 p-1 text-center dark:bg-rose-950/20"
                            >
                              <div className="rounded-md bg-rose-500/20 py-2 text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                                Mnt
                              </div>
                            </td>
                          )
                        }

                        // Free / Available
                        return (
                          <td
                            key={slot.date}
                            className="border-r border-border bg-emerald-50/40 p-1 text-center hover:bg-emerald-100/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30"
                          >
                            <div className="py-2 text-[11px] font-medium text-emerald-800 dark:text-emerald-400">
                              {formatMoney(parseFloat(slot.nightlyRate) || 0)}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3 border-t border-border">
            <PaginationFooter
              page={page}
              limit={limit}
              total={data.pagination?.total ?? data.totalRooms}
              totalPages={data.pagination?.totalPages}
              isLoading={isLoading}
              syncUrl={false}
              onPageChange={(newPage) => setPage(newPage)}
              onLimitChange={(newLimit) => {
                setLimit(newLimit)
                setPage(1)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
