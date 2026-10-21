"use client";

import { useState } from "react";
import {
  Bed,
  Plus,
  Search,
  CheckCircle2,
  Wrench,
  Clock,
  Ban,
  Users,
  Pencil,
  Trash2,
  X,
  FileText,
  Eye,
  Loader2,
} from "lucide-react";
import { useInfiniteList } from "@/lib/use-infinite-list";
import { RoomStatus, RoleName } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/ui-kit/page-header";
import { StatusBadge } from "@/components/ui-kit/status-badge";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { RowActionsMenu } from "@/components/ui-kit/row-actions-menu";
import { MoneyText } from "@/components/ui-kit/money-text";
import { formatMoney } from "@/lib/currency";
import { FormSection } from "@/components/ui-kit/form-section";
import { cn } from "@/lib/utils";

interface CategoryOption {
  id: string;
  name: string;
  basePrice: string | number;
  maxOccupancy: number;
}

interface BuildingOption {
  id: string;
  name: string;
  propertyName?: string;
  floors: { id: string; floorNo: number; name: string | null }[];
}

interface PropertyOption {
  id: string;
  name: string;
  buildings: BuildingOption[];
}

export interface RoomItem {
  id: string;
  propertyId: string;
  buildingId: string;
  floorId: string;
  roomCategoryId: string;
  roomNo: string;
  displayName: string | null;
  capacity: number;
  status: RoomStatus;
  priceOverride: string | number | null;
  notes: string | null;
  category: {
    id: string;
    name: string;
    basePrice: string | number;
  };
  building: {
    id: string;
    name: string;
  };
  floor: {
    id: string;
    floorNo: number;
    name: string | null;
  };
}

interface Props {
  initialRooms: RoomItem[];
  initialPagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  initialNextCursor?: string | null;
  summaryCounts: {
    total: number;
    clean: number;
    dirty: number;
    occupied: number;
    maintenance: number;
    outOfService: number;
  };
  categories: CategoryOption[];
  properties: PropertyOption[];
  userRole: "SUPER_ADMIN" | "ADMIN" | "RECEPTIONIST";
  initialStatus?: string;
  initialPropertyId?: string;
  initialBuildingId?: string;
  initialFloorId?: string;
}

const STATUS_FILTER_ITEMS: {
  status: RoomStatus;
  label: string;
  dotClass: string;
  icon: typeof CheckCircle2;
}[] = [
  {
    status: RoomStatus.VACANT_CLEAN,
    label: "Clean",
    dotClass: "bg-emerald-500",
    icon: CheckCircle2,
  },
  {
    status: RoomStatus.VACANT_DIRTY,
    label: "Dirty",
    dotClass: "bg-amber-500",
    icon: Clock,
  },
  {
    status: RoomStatus.OCCUPIED,
    label: "Occupied",
    dotClass: "bg-sky-500",
    icon: Users,
  },
  {
    status: RoomStatus.MAINTENANCE,
    label: "Maintenance",
    dotClass: "bg-purple-500",
    icon: Wrench,
  },
  {
    status: RoomStatus.OUT_OF_SERVICE,
    label: "Out of Service",
    dotClass: "bg-neutral-400",
    icon: Ban,
  },
];

export function RoomManager({
  initialRooms,
  initialPagination,
  initialNextCursor,
  summaryCounts,
  categories,
  properties,
  userRole,
  initialStatus,
  initialPropertyId,
  initialBuildingId,
  initialFloorId,
}: Props) {
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<string>(
    initialPropertyId || "ALL"
  );
  const [buildingFilter, setBuildingFilter] = useState<string>(
    initialBuildingId || "ALL"
  );
  const [floorFilter, setFloorFilter] = useState<string>(
    initialFloorId || "ALL"
  );
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus || "ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [counts, setCounts] = useState(summaryCounts);

  const {
    items: rooms,
    total: totalRooms,
    isLoading: isFetchingRooms,
    isLoadingMore,
    hasMore,
    error: listError,
    loadMore,
    retry: retryFetchRooms,
    sentinelRef,
  } = useInfiniteList<
    RoomItem,
    {
      propertyId: string;
      buildingId: string;
      floorId: string;
      roomCategoryId: string;
      status: string;
      search: string;
    }
  >({
    endpoint: "/api/rooms",
    limit: 24,
    initialItems: initialRooms,
    initialNextCursor: initialNextCursor ?? null,
    initialTotal: initialPagination?.total,
    filters: {
      propertyId: propertyFilter,
      buildingId: buildingFilter,
      floorId: floorFilter,
      roomCategoryId: categoryFilter,
      status: statusFilter,
      search,
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Status Change Dialog
  const [statusModalRoom, setStatusModalRoom] = useState<RoomItem | null>(null);
  const [newStatus, setNewStatus] = useState<RoomStatus>(RoomStatus.VACANT_CLEAN);
  const [statusNotes, setStatusNotes] = useState("");
  const [selectedRoomDetail, setSelectedRoomDetail] = useState<RoomItem | null>(null);

  // Delete Room Dialog
  const [roomToDelete, setRoomToDelete] = useState<RoomItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Room Form Modal (Add / Edit)
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomItem | null>(null);

  // Form Fields
  const [formPropertyId, setFormPropertyId] = useState(properties[0]?.id || "");
  const [formBuildingId, setFormBuildingId] = useState(
    properties[0]?.buildings[0]?.id || ""
  );
  const [formFloorId, setFormFloorId] = useState(
    properties[0]?.buildings[0]?.floors[0]?.id || ""
  );
  const [formCategoryId, setFormCategoryId] = useState(categories[0]?.id || "");
  const [formRoomNo, setFormRoomNo] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formCapacity, setFormCapacity] = useState("2");
  const [formPriceOverride, setFormPriceOverride] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

  // Derive buildings and floors for the selected property
  const activeProperty = properties.find((p) => p.id === formPropertyId) || properties[0];
  const activeBuildings = activeProperty?.buildings || [];
  const activeBuilding = activeBuildings.find((b) => b.id === formBuildingId) || activeBuildings[0];
  const activeFloors = activeBuilding?.floors || [];

  const handlePropertyChange = (propId: string) => {
    setFormPropertyId(propId);
    const p = properties.find((item) => item.id === propId);
    if (p && p.buildings.length > 0) {
      setFormBuildingId(p.buildings[0].id);
      if (p.buildings[0].floors.length > 0) {
        setFormFloorId(p.buildings[0].floors[0].id);
      }
    }
  };

  const handleBuildingChange = (bldgId: string) => {
    setFormBuildingId(bldgId);
    const b = activeBuildings.find((item) => item.id === bldgId);
    if (b && b.floors.length > 0) {
      setFormFloorId(b.floors[0].id);
    }
  };

  const refreshSummary = async () => {
    try {
      const res = await fetch("/api/rooms?summary=true");
      const data = await res.json();
      if (data.success && data.counts) {
        setCounts(data.counts);
      }
    } catch {
      // Ignore
    }
  };

  // Open Create Room Modal
  const openCreateRoom = () => {
    setEditingRoom(null);
    setFormRoomNo("");
    setFormDisplayName("");
    setFormCapacity("2");
    setFormPriceOverride("");
    setFormNotes("");
    if (categories[0]) setFormCategoryId(categories[0].id);
    const targetProp = properties.find((p) => p.id === propertyFilter) || properties[0];
    if (targetProp) {
      setFormPropertyId(targetProp.id);
      const bldg = (buildingFilter !== "ALL" ? targetProp.buildings.find((b) => b.id === buildingFilter) : null) || targetProp.buildings[0];
      if (bldg) {
        setFormBuildingId(bldg.id);
        const flr = (floorFilter !== "ALL" ? bldg.floors.find((f) => f.id === floorFilter) : null) || bldg.floors[0];
        if (flr) setFormFloorId(flr.id);
      }
    }
    setError(null);
    setIsRoomModalOpen(true);
  };

  // Open Edit Room Modal
  const openEditRoom = (room: RoomItem) => {
    setEditingRoom(room);
    setFormPropertyId(room.propertyId);
    setFormBuildingId(room.buildingId);
    setFormFloorId(room.floorId);
    setFormCategoryId(room.roomCategoryId);
    setFormRoomNo(room.roomNo);
    setFormDisplayName(room.displayName || "");
    setFormCapacity(room.capacity.toString());
    setFormPriceOverride(room.priceOverride ? room.priceOverride.toString() : "");
    setFormNotes(room.notes || "");
    setError(null);
    setIsRoomModalOpen(true);
  };

  // Open Status Change Dialog
  const openStatusChange = (room: RoomItem) => {
    setStatusModalRoom(room);
    setNewStatus(room.status);
    setStatusNotes(room.notes || "");
    setError(null);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        propertyId: formPropertyId,
        buildingId: formBuildingId,
        floorId: formFloorId,
        roomCategoryId: formCategoryId,
        roomNo: formRoomNo.trim(),
        displayName: formDisplayName.trim() || null,
        capacity: parseInt(formCapacity, 10) || 1,
        priceOverride: formPriceOverride ? parseFloat(formPriceOverride) : null,
        notes: formNotes.trim() || null,
      };

      const url = editingRoom ? `/api/rooms/${editingRoom.id}` : "/api/rooms";
      const method = editingRoom ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save room");
      }

      setIsRoomModalOpen(false);
      toast.success(editingRoom ? `Room ${data.room.roomNo} updated` : `Room ${data.room.roomNo} created`);
      await refreshSummary();
      retryFetchRooms();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error saving room";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalRoom) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${statusModalRoom.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          notes: statusNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update room status");
      }

      toast.success(`Room ${statusModalRoom.roomNo} updated to ${newStatus.replace(/_/g, " ").toLowerCase()}`);
      setStatusModalRoom(null);
      await refreshSummary();
      retryFetchRooms();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error updating room status";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!roomToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/rooms/${roomToDelete.id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete room");
      }

      toast.success(`Room ${roomToDelete.roomNo} deleted`);
      setRoomToDelete(null);
      await refreshSummary();
      retryFetchRooms();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error deleting room";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter toolbar building and floor options
  const filterProperty = properties.find((p) => p.id === propertyFilter);
  const filterBuildings: BuildingOption[] = filterProperty
    ? filterProperty.buildings.map((b) => ({ ...b, propertyName: filterProperty.name }))
    : properties.flatMap((p) =>
        p.buildings.map((b) => ({ ...b, propertyName: p.name }))
      );
  const selectedBldg = filterBuildings.find((b) => b.id === buildingFilter);
  const filterFloors = selectedBldg
    ? selectedBldg.floors
    : filterBuildings.length === 1
    ? filterBuildings[0].floors
    : [];

  const hasActiveFilters =
    search !== "" ||
    statusFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    buildingFilter !== "ALL" ||
    floorFilter !== "ALL" ||
    (userRole === RoleName.SUPER_ADMIN ? propertyFilter !== "ALL" : false);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setBuildingFilter("ALL");
    setFloorFilter("ALL");
    const defaultProp =
      userRole === RoleName.SUPER_ADMIN ? "ALL" : (initialPropertyId || "ALL");
    setPropertyFilter(defaultProp);
  };

  const isCustomDisplayName = (
    displayName: string | null | undefined,
    roomNo: string,
    categoryName: string
  ): boolean => {
    if (!displayName || !displayName.trim()) return false;
    const trimmed = displayName.trim().toLowerCase();
    const rNo = roomNo.trim().toLowerCase();
    const cat = categoryName.trim().toLowerCase();
    if (trimmed.startsWith(`room ${rNo}`)) return false;
    if (trimmed.startsWith(rNo)) return false;
    if (trimmed === cat || trimmed === `room (${cat})`) return false;
    return true;
  };

  // Group rooms by building, then floor
  const groupedBuildings = rooms.reduce<
    {
      buildingId: string;
      buildingName: string;
      propertyName?: string;
      floors: {
        floorId: string;
        floorNo: number;
        floorName: string | null;
        rooms: RoomItem[];
      }[];
    }[]
  >((acc, room) => {
    let bldg = acc.find((b) => b.buildingId === room.building.id);
    if (!bldg) {
      const prop = properties.find((p) => p.id === room.propertyId);
      bldg = {
        buildingId: room.building.id,
        buildingName: room.building.name,
        propertyName: prop?.name,
        floors: [],
      };
      acc.push(bldg);
    }
    let flr = bldg.floors.find((f) => f.floorNo === room.floor.floorNo);
    if (!flr) {
      flr = {
        floorId: room.floor.id,
        floorNo: room.floor.floorNo,
        floorName: room.floor.name,
        rooms: [],
      };
      bldg.floors.push(flr);
    }
    flr.rooms.push(room);
    return acc;
  }, []);

  groupedBuildings.sort((a, b) => a.buildingName.localeCompare(b.buildingName));
  groupedBuildings.forEach((b) => b.floors.sort((a, b) => a.floorNo - b.floorNo));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Rooms"
        description="Monitor physical room conditions, update operational statuses, and configure inventory."
        action={
          isAdmin ? (
            <Button onClick={openCreateRoom} size="sm" className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs">
              <Plus className="size-3.5" />
              <span>Add room</span>
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium flex items-center justify-between"
        >
          <span>{error}</span>
          <Button variant="ghost" size="xs" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Compact Status Filter Chip Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => {
            setStatusFilter("ALL");
          }}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap cursor-pointer shrink-0",
            statusFilter === "ALL"
              ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
              : "bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground border-border/80"
          )}
        >
          <Bed className="size-3.5" />
          <span>All</span>
          <span
            className={cn(
              "font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded-full font-semibold",
              statusFilter === "ALL" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
            )}
          >
            {counts.total}
          </span>
        </button>

        {STATUS_FILTER_ITEMS.map((item) => {
          const isActive = statusFilter === item.status;
          const count =
            item.status === RoomStatus.VACANT_CLEAN
              ? counts.clean
              : item.status === RoomStatus.VACANT_DIRTY
                ? counts.dirty
                : item.status === RoomStatus.OCCUPIED
                  ? counts.occupied
                  : item.status === RoomStatus.MAINTENANCE
                    ? counts.maintenance
                    : counts.outOfService;

          return (
            <button
              key={item.status}
              type="button"
              onClick={() => {
                const next = statusFilter === item.status ? "ALL" : item.status;
                setStatusFilter(next);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap cursor-pointer shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                  : "bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground border-border/80"
              )}
            >
              <span className={cn("size-2 rounded-full shrink-0 shadow-2xs", item.dotClass)} />
              <span>{item.label}</span>
              <span
                className={cn(
                  "font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded-full font-semibold",
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Single Toolbar Row */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search room no or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>

        {properties.length > 1 && (
          <select
            value={propertyFilter}
            onChange={(e) => {
              const val = e.target.value;
              setPropertyFilter(val);
              setBuildingFilter("ALL");
              setFloorFilter("ALL");
            }}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={buildingFilter}
          onChange={(e) => {
            const val = e.target.value;
            setBuildingFilter(val);
            setFloorFilter("ALL");
          }}
          className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">All Buildings</option>
          {filterBuildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {propertyFilter === "ALL" && properties.length > 1 && b.propertyName
                ? ` (${b.propertyName})`
                : ""}
            </option>
          ))}
        </select>

        <select
          value={floorFilter}
          onChange={(e) => {
            const val = e.target.value;
            setFloorFilter(val);
          }}
          className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">All Floors</option>
          {filterFloors.map((flr) => (
            <option key={flr.id} value={flr.id}>
              Floor {flr.floorNo} {flr.name ? `(${flr.name})` : ""}
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => {
            const val = e.target.value;
            setCategoryFilter(val);
          }}
          className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs h-9 text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
          >
            <X className="size-3.5" />
            <span>Reset</span>
          </Button>
        )}
      </div>

      {/* Rooms Grid */}
      {rooms.length === 0 ? (
        <EmptyState
          icon={<Bed className="size-6" />}
          title={totalRooms === 0 ? "No rooms configured" : "No matching rooms"}
          description={
            totalRooms === 0
              ? "Set up physical rooms and attach them to categories to begin managing operations."
              : "No rooms match your filter criteria. Try adjusting your search or clearing filters."
          }
          action={
            isAdmin && totalRooms === 0 ? (
              <Button onClick={openCreateRoom} size="sm">
                <Plus className="size-4 mr-1.5" />
                Add first room
              </Button>
            ) : hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={cn("space-y-6 transition-opacity duration-200", isFetchingRooms && "opacity-60 pointer-events-none")}>
          {groupedBuildings.map((bldg) => (
            <div key={bldg.buildingId} className="space-y-4">
              {bldg.floors.map((flr) => (
                <div key={flr.floorId} className="space-y-2.5">
                  {/* Quiet Section Header: "Main Wing · Floor 1" */}
                  <div className="flex items-center gap-2 pt-2 first:pt-0">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {properties.length > 1 && bldg.propertyName ? `${bldg.propertyName} · ` : ""}
                      {bldg.buildingName} · Floor {flr.floorNo}
                    </span>
                    <div className="h-px bg-border/60 flex-1" />
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {flr.rooms.length} {flr.rooms.length === 1 ? "room" : "rooms"}
                    </span>
                  </div>

                  {/* Responsive compact card grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                    {flr.rooms.map((room) => {
                      const hasCustomName = isCustomDisplayName(
                        room.displayName,
                        room.roomNo,
                        room.category.name
                      );
                      const statusCfg = STATUS_FILTER_ITEMS.find(
                        (s) => s.status === room.status
                      ) || {
                        label: room.status,
                        dotClass: "bg-muted-foreground",
                      };

                      return (
                        <div
                          key={room.id}
                          onClick={() => setSelectedRoomDetail(room)}
                          className="rounded-xl border border-border/80 bg-card p-2.5 flex flex-col justify-between hover:border-foreground/30 hover:shadow-xs transition-all cursor-pointer group text-xs relative"
                        >
                          <div className="space-y-1">
                            {/* Top row: Room Number & RowActionsMenu */}
                            <div className="flex items-start justify-between gap-1 min-w-0">
                              <div className="min-w-0 flex-1">
                                <span className="font-mono font-bold text-sm sm:text-base text-foreground tracking-tight truncate block">
                                  {room.roomNo}
                                </span>
                                {hasCustomName && (
                                  <span
                                    className="text-[10px] text-muted-foreground truncate block leading-tight"
                                    title={room.displayName!}
                                  >
                                    {room.displayName}
                                  </span>
                                )}
                              </div>
                              <div
                                className="shrink-0 -mr-1 -mt-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <RowActionsMenu
                                  items={[
                                    {
                                      label: "View details",
                                      icon: <Eye className="size-3.5" />,
                                      onClick: () => setSelectedRoomDetail(room),
                                    },
                                    {
                                      label: "Update status",
                                      icon: <CheckCircle2 className="size-3.5" />,
                                      onClick: () => openStatusChange(room),
                                    },
                                    ...(isAdmin
                                      ? [
                                          {
                                            label: "Edit room",
                                            icon: <Pencil className="size-3.5" />,
                                            onClick: () => openEditRoom(room),
                                          },
                                          {
                                            label: "Delete room",
                                            icon: <Trash2 className="size-3.5" />,
                                            variant: "destructive" as const,
                                            onClick: () => setRoomToDelete(room),
                                          },
                                        ]
                                      : []),
                                  ]}
                                />
                              </div>
                            </div>

                            {/* Category: small muted */}
                            <div
                              className="text-[11px] text-muted-foreground truncate"
                              title={room.category.name}
                            >
                              {room.category.name}
                            </div>

                            {/* Status & Attributes: dot + text on left, notes and capacity on right */}
                            <div className="flex items-center justify-between gap-1 pt-0.5 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={cn("size-2 rounded-full shrink-0", statusCfg.dotClass)}
                                />
                                <span className="text-[11px] text-muted-foreground truncate font-medium">
                                  {statusCfg.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {room.notes && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="shrink-0"
                                  >
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <span className="text-muted-foreground hover:text-foreground cursor-help inline-flex p-0.5">
                                            <FileText className="size-3" />
                                          </span>
                                        }
                                      />
                                      <TooltipContent>
                                        <p className="max-w-xs text-xs">{room.notes}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                )}
                                <div
                                  className="flex items-center gap-1 text-muted-foreground/80 shrink-0"
                                  title={`Max capacity: ${room.capacity} ${room.capacity === 1 ? "guest" : "guests"}`}
                                >
                                  <Users className="size-3 text-muted-foreground/70" />
                                  <span className="font-mono text-[11px] text-foreground font-medium">
                                    {room.capacity}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Bottom row: Dedicated Pricing Row (nightly rate with subtle cents) */}
                          <div className="flex items-baseline justify-between gap-1 text-xs pt-1.5 mt-2 border-t border-border/50 text-muted-foreground min-w-0">
                            <span className="text-[10px] text-muted-foreground/70 font-medium shrink-0">
                              /night
                            </span>

                            <div className="flex items-baseline gap-1.5 font-mono text-right min-w-0 flex-wrap justify-end">
                              {room.priceOverride ? (
                                <>
                                  <MoneyText
                                    value={room.priceOverride}
                                    className="font-bold text-primary text-xs tabular-nums"
                                    subtleCents
                                  />
                                  <MoneyText
                                    value={room.category.basePrice}
                                    className="text-[10px] text-muted-foreground/60 line-through tabular-nums"
                                    subtleCents
                                  />
                                </>
                              ) : (
                                <MoneyText
                                  value={room.category.basePrice}
                                  className="font-semibold text-foreground text-xs tabular-nums"
                                  subtleCents
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel and Load More Trigger */}
      <div className="py-6 flex flex-col items-center justify-center gap-3">
        {/* Sentinel element observed ~400px before end of scroll */}
        <div ref={sentinelRef} className="h-2 w-full pointer-events-none" />

        {isLoadingMore && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Loading more rooms...</span>
          </div>
        )}

        {hasMore && !isLoadingMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMore()}
            className="text-xs h-8 px-4 gap-1.5 shadow-2xs"
          >
            <span>Load more rooms</span>
            <span className="font-mono text-muted-foreground">
              ({rooms.length} of {totalRooms})
            </span>
          </Button>
        )}

        {!hasMore && rooms.length > 0 && (
          <div className="text-xs text-muted-foreground/60 font-mono">
            Showing all {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
          </div>
        )}

        {listError && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <span>Failed to load more rooms</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => retryFetchRooms()}
              className="h-7 text-xs px-2"
            >
              Retry
            </Button>
          </div>
        )}
      </div>

      {/* Room Detail Slide-Over Side Panel */}
      {selectedRoomDetail && (
        <Sheet
          open={selectedRoomDetail !== null}
          onOpenChange={(open) => !open && setSelectedRoomDetail(null)}
        >
        <SheetContent side="right" className="w-full sm:max-w-md p-6 overflow-y-auto">
          {selectedRoomDetail && (
            <>
              <SheetHeader className="pb-4 border-b border-border/60">
                <div className="flex items-center justify-between gap-3">
                  <SheetTitle className="font-mono text-xl font-bold tracking-tight text-foreground">
                    Room {selectedRoomDetail.roomNo}
                  </SheetTitle>
                  <StatusBadge status={selectedRoomDetail.status} size="sm" />
                </div>
                {selectedRoomDetail.displayName && (
                  <SheetDescription className="text-xs text-muted-foreground font-medium">
                    {selectedRoomDetail.displayName}
                  </SheetDescription>
                )}
              </SheetHeader>

              <div className="space-y-5 py-4 text-xs">
                {/* Location */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Location
                  </span>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Building:</span>
                      <span className="font-medium text-foreground">{selectedRoomDetail.building.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Floor:</span>
                      <span className="font-medium text-foreground">Floor {selectedRoomDetail.floor.floorNo}</span>
                    </div>
                  </div>
                </div>

                {/* Category & Rates */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Category & Rates
                  </span>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-1.5 font-mono">
                    <div className="flex justify-between font-sans">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="font-medium text-foreground">{selectedRoomDetail.category.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Capacity:</span>
                      <span className="font-medium text-foreground">{selectedRoomDetail.capacity} guests</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Base Rate:</span>
                      <MoneyText value={selectedRoomDetail.category.basePrice} className="font-medium text-foreground" />
                    </div>
                    {selectedRoomDetail.priceOverride && (
                      <div className="flex justify-between font-semibold text-primary">
                        <span className="font-sans">Active Override:</span>
                        <MoneyText value={selectedRoomDetail.priceOverride} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Operational Status */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Operational Status
                  </span>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 flex items-center justify-between">
                    <StatusBadge status={selectedRoomDetail.status} />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-primary"
                      onClick={() => {
                        const r = selectedRoomDetail;
                        setSelectedRoomDetail(null);
                        openStatusChange(r);
                      }}
                    >
                      Change Status
                    </Button>
                  </div>
                </div>

                {/* Notes */}
                {selectedRoomDetail.notes && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Housekeeping / Front Desk Notes
                    </span>
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-foreground whitespace-pre-wrap">
                      {selectedRoomDetail.notes}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border/60 flex flex-row items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium"
                  onClick={() => setSelectedRoomDetail(null)}
                >
                  Close
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    className="h-8 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-2xs"
                    onClick={() => {
                      const r = selectedRoomDetail;
                      setSelectedRoomDetail(null);
                      openEditRoom(r);
                    }}
                  >
                    <Pencil className="size-3.5" />
                    <span>Edit Room</span>
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      )}

      {/* Operational Status Change Modal */}
      {statusModalRoom && (
        <Dialog
          open={statusModalRoom !== null}
          onOpenChange={(open) => !open && setStatusModalRoom(null)}
        >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Room Status — Room {statusModalRoom?.roomNo}</DialogTitle>
            <DialogDescription>
              Transition operational condition for housekeeping and desk awareness.
            </DialogDescription>
          </DialogHeader>

          {statusModalRoom?.status === RoomStatus.OCCUPIED ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-4 text-xs text-sky-800 dark:text-sky-300 space-y-1">
                <p className="font-semibold text-sm">Room is Currently Occupied</p>
                <p>
                  This room has an active in-house guest reservation. Operational status
                  cannot be manually modified while occupied.
                </p>
                <p className="pt-1 text-[11px] opacity-80">
                  Room will automatically transition to <strong>Vacant Dirty</strong> upon
                  guest checkout.
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusModalRoom(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div className="space-y-2">
                <Label>Select New Condition *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { status: RoomStatus.VACANT_CLEAN, label: "Vacant Clean", dot: "bg-emerald-500" },
                    { status: RoomStatus.VACANT_DIRTY, label: "Vacant Dirty", dot: "bg-amber-500" },
                    { status: RoomStatus.MAINTENANCE, label: "Maintenance", dot: "bg-purple-500" },
                    { status: RoomStatus.OUT_OF_SERVICE, label: "Out of Service", dot: "bg-neutral-400" },
                  ].map((cfg) => {
                    const isSelected = newStatus === cfg.status;

                    return (
                      <button
                        key={cfg.status}
                        type="button"
                        onClick={() => setNewStatus(cfg.status)}
                        className={cn(
                          "flex items-center gap-2 p-2.5 rounded-lg border text-xs text-left font-medium transition-all cursor-pointer",
                          isSelected
                            ? "bg-primary/10 border-primary text-primary ring-1 ring-primary"
                            : "bg-card hover:bg-muted/50 border-input text-foreground"
                        )}
                      >
                        <span className={cn("size-2.5 rounded-full shrink-0", cfg.dot)} />
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="statusNotes">Operational Notes</Label>
                <Textarea
                  id="statusNotes"
                  rows={2}
                  placeholder="e.g. Cleaned by staff, Plumbing inspection needed..."
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  disabled={loading}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusModalRoom(null)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? "Updating..." : "Save Status"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {roomToDelete && (
        <ConfirmDialog
          open={roomToDelete !== null}
          onOpenChange={(open) => !open && setRoomToDelete(null)}
          title="Delete Room"
          description={`Are you sure you want to delete Room ${roomToDelete?.roomNo}? This action cannot be undone.`}
          confirmText="Delete Room"
          variant="destructive"
          isPending={isDeleting}
          onConfirm={handleDeleteRoom}
        />
      )}

      {/* Add / Edit Room Modal */}
      {isRoomModalOpen && (
        <Dialog open={isRoomModalOpen} onOpenChange={setIsRoomModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRoom ? `Edit Room ${editingRoom.roomNo}` : "Add Physical Room"}
            </DialogTitle>
            <DialogDescription>
              Configure room allocation, category assignment, and building location.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRoom} className="space-y-4">
            <FormSection title="Location">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="roomProperty">Property *</Label>
                  <select
                    id="roomProperty"
                    value={formPropertyId}
                    onChange={(e) => handlePropertyChange(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                    disabled={loading || Boolean(editingRoom)}
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="roomBuilding">Building *</Label>
                  <select
                    id="roomBuilding"
                    value={formBuildingId}
                    onChange={(e) => handleBuildingChange(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                    disabled={loading || Boolean(editingRoom)}
                  >
                    {activeBuildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="roomFloor">Floor *</Label>
                  <select
                    id="roomFloor"
                    value={formFloorId}
                    onChange={(e) => setFormFloorId(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                    disabled={loading}
                  >
                    {activeFloors.map((f) => (
                      <option key={f.id} value={f.id}>
                        Floor {f.floorNo} {f.name ? `(${f.name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </FormSection>

            <FormSection title="Room Details">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="roomNo">Room No *</Label>
                  <Input
                    id="roomNo"
                    required
                    placeholder="e.g. 101"
                    value={formRoomNo}
                    onChange={(e) => setFormRoomNo(e.target.value)}
                    disabled={loading}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="roomCategory">Category *</Label>
                  <select
                    id="roomCategory"
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                    disabled={loading}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({formatMoney(c.basePrice)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="roomCapacity">Capacity *</Label>
                  <Input
                    id="roomCapacity"
                    type="number"
                    min="1"
                    required
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    disabled={loading}
                    className="text-xs"
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Pricing & Notes">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="priceOverride">Rate Override</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground select-none">
                      ₹
                    </span>
                    <Input
                      id="priceOverride"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Optional override per night"
                      value={formPriceOverride}
                      onChange={(e) => setFormPriceOverride(e.target.value)}
                      disabled={loading}
                      className="pl-7 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder="e.g. Executive Corner Suite"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    disabled={loading}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="roomNotes">Operational Notes</Label>
                  <Textarea
                    id="roomNotes"
                    rows={2}
                    placeholder="View, quiet room, accessibility features..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    disabled={loading}
                    className="text-xs"
                  />
                </div>
              </div>
            </FormSection>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRoomModalOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Saving..." : editingRoom ? "Update Room" : "Create Room"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
