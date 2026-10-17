"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Layers,
} from "lucide-react";
import { RoomStatus } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  categories: CategoryOption[];
  properties: PropertyOption[];
  userRole: "ADMIN" | "RECEPTIONIST";
  initialStatus?: string;
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
  categories,
  properties,
  userRole,
  initialStatus,
}: Props) {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomItem[]>(initialRooms);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus || "ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [floorFilter, setFloorFilter] = useState<string>("ALL");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Status Change Dialog
  const [statusModalRoom, setStatusModalRoom] = useState<RoomItem | null>(null);
  const [newStatus, setNewStatus] = useState<RoomStatus>(RoomStatus.VACANT_CLEAN);
  const [statusNotes, setStatusNotes] = useState("");

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

  const isAdmin = userRole === "ADMIN";

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

  // Open Create Room Modal
  const openCreateRoom = () => {
    setEditingRoom(null);
    setFormRoomNo("");
    setFormDisplayName("");
    setFormCapacity("2");
    setFormPriceOverride("");
    setFormNotes("");
    if (categories[0]) setFormCategoryId(categories[0].id);
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
      router.refresh();

      if (editingRoom) {
        setRooms((prev) =>
          prev.map((r) => (r.id === editingRoom.id ? data.room : r))
        );
      } else {
        setRooms((prev) => [...prev, data.room]);
      }
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

      setRooms((prev) =>
        prev.map((r) => (r.id === statusModalRoom.id ? data.room : r))
      );
      toast.success(`Room ${statusModalRoom.roomNo} updated to ${newStatus.replace(/_/g, " ").toLowerCase()}`);
      setStatusModalRoom(null);
      router.refresh();
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

      setRooms((prev) => prev.filter((r) => r.id !== roomToDelete.id));
      toast.success(`Room ${roomToDelete.roomNo} deleted`);
      setRoomToDelete(null);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error deleting room";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Counts for status metrics
  const counts = {
    total: rooms.length,
    clean: rooms.filter((r) => r.status === RoomStatus.VACANT_CLEAN).length,
    dirty: rooms.filter((r) => r.status === RoomStatus.VACANT_DIRTY).length,
    occupied: rooms.filter((r) => r.status === RoomStatus.OCCUPIED).length,
    maintenance: rooms.filter((r) => r.status === RoomStatus.MAINTENANCE).length,
    outOfService: rooms.filter((r) => r.status === RoomStatus.OUT_OF_SERVICE).length,
  };

  // Distinct floors for filtering
  const distinctFloors = Array.from(new Set(rooms.map((r) => r.floor.floorNo))).sort((a, b) => a - b);

  // Filtering
  const filteredRooms = rooms.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (categoryFilter !== "ALL" && r.roomCategoryId !== categoryFilter) return false;
    if (floorFilter !== "ALL" && r.floor.floorNo.toString() !== floorFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchNo = r.roomNo.toLowerCase().includes(q);
      const matchName = r.displayName && r.displayName.toLowerCase().includes(q);
      if (!matchNo && !matchName) return false;
    }
    return true;
  });

  const hasActiveFilters =
    search !== "" || statusFilter !== "ALL" || categoryFilter !== "ALL" || floorFilter !== "ALL";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setFloorFilter("ALL");
  };

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
          onClick={() => setStatusFilter("ALL")}
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
              onClick={() => setStatusFilter(item.status)}
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

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={floorFilter}
          onChange={(e) => setFloorFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">All Floors</option>
          {distinctFloors.map((fNo) => (
            <option key={fNo} value={fNo.toString()}>
              Floor {fNo}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs h-9 text-muted-foreground hover:text-foreground gap-1"
          >
            <X className="size-3.5" />
            <span>Reset</span>
          </Button>
        )}
      </div>

      {/* Rooms Grid */}
      {filteredRooms.length === 0 ? (
        <EmptyState
          icon={<Bed className="size-6" />}
          title={rooms.length === 0 ? "No rooms configured" : "No matching rooms"}
          description={
            rooms.length === 0
              ? "Set up physical rooms and attach them to categories to begin managing operations."
              : "No rooms match your filter criteria. Try adjusting your search or clearing filters."
          }
          action={
            isAdmin && rooms.length === 0 ? (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room) => {
            return (
              <Card
                key={room.id}
                className="flex flex-col justify-between shadow-xs hover:border-foreground/20 transition-colors group"
              >
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl font-bold font-mono tracking-tight text-foreground">
                          {room.roomNo}
                        </span>
                        <Badge variant="secondary" className="text-[11px] font-normal py-0 truncate">
                          {room.category.name}
                        </Badge>
                      </div>
                      {room.displayName && (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {room.displayName}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Clickable status badge button */}
                      <button
                        type="button"
                        onClick={() => openStatusChange(room)}
                        title="Click to update operational status"
                        className="transition-transform hover:scale-105 cursor-pointer shrink-0"
                      >
                        <StatusBadge status={room.status} size="sm" />
                      </button>

                      {isAdmin && (
                        <RowActionsMenu
                          items={[
                            {
                              label: "Edit room",
                              icon: <Pencil className="size-3.5" />,
                              onClick: () => openEditRoom(room),
                            },
                            {
                              label: "Delete room",
                              icon: <Trash2 className="size-3.5" />,
                              variant: "destructive",
                              onClick: () => setRoomToDelete(room),
                            },
                          ]}
                        />
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-3">
                  <div className="text-xs text-muted-foreground space-y-1.5">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Floor {room.floor.floorNo} · {room.capacity} {room.capacity === 1 ? "guest" : "guests"}</span>
                      <div className="flex items-baseline gap-1 text-foreground font-mono">
                        {room.priceOverride ? (
                          <>
                            <MoneyText value={room.priceOverride} className="font-semibold text-primary" />
                            <MoneyText
                              value={room.category.basePrice}
                              className="text-[10px] text-muted-foreground line-through ml-0.5"
                            />
                          </>
                        ) : (
                          <MoneyText value={room.category.basePrice} className="font-medium" />
                        )}
                        <span className="text-[10px] text-muted-foreground font-sans">/night</span>
                      </div>
                    </div>
                  </div>

                  {room.notes && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <div className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 truncate border border-border/50 cursor-help flex items-center gap-1.5">
                            <span className="font-medium text-foreground shrink-0 text-[11px]">Note:</span>
                            <span className="truncate text-[11px]">{room.notes}</span>
                          </div>
                        }
                      />
                      <TooltipContent>
                        <p className="max-w-xs text-xs">{room.notes}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <button
                      type="button"
                      onClick={() => openStatusChange(room)}
                      className="text-primary hover:underline text-xs font-medium cursor-pointer"
                    >
                      Update status
                    </button>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Layers className="size-3" />
                      <span>{room.building.name}</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Operational Status Change Modal */}
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

      {/* Delete Confirmation Dialog */}
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

      {/* Add / Edit Room Modal */}
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
            <FormSection
              title="Location"
              description="Assign physical property, building, and floor location"
            >
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

            <FormSection
              title="Room Details"
              description="Number, category, and maximum occupancy limit"
            >
              <div className="grid grid-cols-3 gap-3">
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

                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="roomCategory">Room Category *</Label>
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
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
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
                      placeholder="Optional override"
                      value={formPriceOverride}
                      onChange={(e) => setFormPriceOverride(e.target.value)}
                      disabled={loading}
                      className="pl-7 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Pricing & Notes"
              description="Custom display name and operational reception notes"
            >
              <div className="space-y-3">
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
    </div>
  );
}
