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
  DollarSign,
  Users,
  Edit,
  Trash2,
  Layers,
} from "lucide-react";
import { RoomStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
}

const STATUS_CONFIG: Record<
  RoomStatus,
  { label: string; bg: string; text: string; border: string; icon: typeof CheckCircle2 }
> = {
  VACANT_CLEAN: {
    label: "Vacant Clean",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/20",
    icon: CheckCircle2,
  },
  VACANT_DIRTY: {
    label: "Vacant Dirty",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/20",
    icon: Clock,
  },
  OCCUPIED: {
    label: "Occupied",
    bg: "bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-500/20",
    icon: Users,
  },
  MAINTENANCE: {
    label: "Maintenance",
    bg: "bg-purple-500/10",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-500/20",
    icon: Wrench,
  },
  OUT_OF_SERVICE: {
    label: "Out of Service",
    bg: "bg-zinc-500/10",
    text: "text-zinc-700 dark:text-zinc-400",
    border: "border-zinc-500/20",
    icon: Ban,
  },
};

export function RoomManager({
  initialRooms,
  categories,
  properties,
  userRole,
}: Props) {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomItem[]>(initialRooms);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [floorFilter, setFloorFilter] = useState<string>("ALL");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Status Change Dialog
  const [statusModalRoom, setStatusModalRoom] = useState<RoomItem | null>(null);
  const [newStatus, setNewStatus] = useState<RoomStatus>(RoomStatus.VACANT_CLEAN);
  const [statusNotes, setStatusNotes] = useState("");

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
      router.refresh();

      if (editingRoom) {
        setRooms((prev) =>
          prev.map((r) => (r.id === editingRoom.id ? data.room : r))
        );
      } else {
        setRooms((prev) => [...prev, data.room]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving room");
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
      setStatusModalRoom(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating room status");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (room: RoomItem) => {
    if (!confirm(`Are you sure you want to delete Room ${room.roomNo}?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete room");
      }

      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting room");
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6">
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

      {/* Status KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className={`rounded-xl border p-3.5 text-left transition-all ${
            statusFilter === "ALL"
              ? "border-primary bg-primary/5 shadow-xs"
              : "bg-card hover:border-foreground/20"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Rooms</span>
            <Bed className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono">{counts.total}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(RoomStatus.VACANT_CLEAN)}
          className={`rounded-xl border p-3.5 text-left transition-all ${
            statusFilter === RoomStatus.VACANT_CLEAN
              ? "border-emerald-500 bg-emerald-500/10 shadow-xs"
              : "bg-card hover:border-foreground/20"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            <span>Clean</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
            {counts.clean}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(RoomStatus.VACANT_DIRTY)}
          className={`rounded-xl border p-3.5 text-left transition-all ${
            statusFilter === RoomStatus.VACANT_DIRTY
              ? "border-amber-500 bg-amber-500/10 shadow-xs"
              : "bg-card hover:border-foreground/20"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-medium">
            <span>Dirty</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">
            {counts.dirty}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(RoomStatus.OCCUPIED)}
          className={`rounded-xl border p-3.5 text-left transition-all ${
            statusFilter === RoomStatus.OCCUPIED
              ? "border-blue-500 bg-blue-500/10 shadow-xs"
              : "bg-card hover:border-foreground/20"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-400 font-medium">
            <span>Occupied</span>
            <Users className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-blue-700 dark:text-blue-400">
            {counts.occupied}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(RoomStatus.MAINTENANCE)}
          className={`rounded-xl border p-3.5 text-left transition-all ${
            statusFilter === RoomStatus.MAINTENANCE
              ? "border-purple-500 bg-purple-500/10 shadow-xs"
              : "bg-card hover:border-foreground/20"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-purple-700 dark:text-purple-400 font-medium">
            <span>Maintenance</span>
            <Wrench className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-purple-700 dark:text-purple-400">
            {counts.maintenance}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(RoomStatus.OUT_OF_SERVICE)}
          className={`rounded-xl border p-3.5 text-left transition-all ${
            statusFilter === RoomStatus.OUT_OF_SERVICE
              ? "border-zinc-500 bg-zinc-500/10 shadow-xs"
              : "bg-card hover:border-foreground/20"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-400 font-medium">
            <span>Out of Service</span>
            <Ban className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-zinc-700 dark:text-zinc-400">
            {counts.outOfService}
          </div>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between bg-card p-3 rounded-xl border">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search room no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All Statuses</option>
            <option value={RoomStatus.VACANT_CLEAN}>Vacant Clean</option>
            <option value={RoomStatus.VACANT_DIRTY}>Vacant Dirty</option>
            <option value={RoomStatus.OCCUPIED}>Occupied</option>
            <option value={RoomStatus.MAINTENANCE}>Maintenance</option>
            <option value={RoomStatus.OUT_OF_SERVICE}>Out of Service</option>
          </select>

          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All Floors</option>
            {distinctFloors.map((fNo) => (
              <option key={fNo} value={fNo.toString()}>
                Floor {fNo}
              </option>
            ))}
          </select>
        </div>

        {isAdmin && (
          <Button size="sm" onClick={openCreateRoom}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Room
          </Button>
        )}
      </div>

      {/* Rooms Grid */}
      {filteredRooms.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <CardContent className="space-y-2 pt-6">
            <Bed className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
            <h3 className="text-base font-semibold">No rooms match your filter</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Try adjusting your search criteria or clear status filters.
            </p>
            {isAdmin && rooms.length === 0 && (
              <Button size="sm" onClick={openCreateRoom} className="mt-4">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add First Room
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredRooms.map((room) => {
            const statusConfig = STATUS_CONFIG[room.status];
            const StatusIcon = statusConfig.icon;

            return (
              <Card
                key={room.id}
                className="flex flex-col justify-between shadow-xs hover:border-foreground/20 transition-all group"
              >
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold tracking-tight font-mono">
                          {room.roomNo}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 font-normal">
                          {room.category.name}
                        </Badge>
                      </div>
                      {room.displayName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {room.displayName}
                        </p>
                      )}
                    </div>

                    {/* Operational Status Badge */}
                    <button
                      type="button"
                      onClick={() => openStatusChange(room)}
                      title="Click to change operational status"
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold border transition-transform hover:scale-105 ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      <span>{statusConfig.label}</span>
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-3">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" /> Location
                      </span>
                      <span className="font-medium text-foreground">
                        {room.building.name} • Floor {room.floor.floorNo}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> Max Capacity
                      </span>
                      <span className="font-medium text-foreground">
                        {room.capacity} {room.capacity === 1 ? "Guest" : "Guests"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> Nightly Rate
                      </span>
                      <span className="font-medium font-mono text-foreground">
                        {room.priceOverride ? (
                          <>
                            <span className="text-primary font-semibold">
                              ${Number(room.priceOverride).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-muted-foreground line-through ml-1">
                              ${Number(room.category.basePrice).toFixed(2)}
                            </span>
                          </>
                        ) : (
                          <span>${Number(room.category.basePrice).toFixed(2)}</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {room.notes && (
                    <div className="rounded bg-muted/40 p-2 text-[11px] text-muted-foreground border border-dashed">
                      <span className="font-medium text-foreground">Note: </span>
                      {room.notes}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <button
                      type="button"
                      onClick={() => openStatusChange(room)}
                      className="text-primary hover:underline text-[11px] font-medium"
                    >
                      Update Status
                    </button>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => openEditRoom(room)}
                          disabled={loading}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteRoom(room)}
                          disabled={loading}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
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
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-xs text-blue-800 dark:text-blue-300 space-y-1">
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
                    RoomStatus.VACANT_CLEAN,
                    RoomStatus.VACANT_DIRTY,
                    RoomStatus.MAINTENANCE,
                    RoomStatus.OUT_OF_SERVICE,
                  ].map((st) => {
                    const cfg = STATUS_CONFIG[st];
                    const isSelected = newStatus === st;

                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setNewStatus(st)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs text-left font-medium transition-all ${
                          isSelected
                            ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-1 ring-primary`
                            : "bg-card hover:bg-muted/50 border-input text-foreground"
                        }`}
                      >
                        <cfg.icon className="h-4 w-4 shrink-0" />
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
            <div className="grid grid-cols-2 gap-3">
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
            </div>

            <div className="grid grid-cols-2 gap-3">
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

              <div className="space-y-1.5">
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
                      {c.name} (${Number(c.basePrice).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
                />
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
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priceOverride">Rate Override ($)</Label>
                <Input
                  id="priceOverride"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  value={formPriceOverride}
                  onChange={(e) => setFormPriceOverride(e.target.value)}
                  disabled={loading}
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
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="roomNotes">Notes</Label>
              <Textarea
                id="roomNotes"
                rows={2}
                placeholder="View, quiet room, accessibility features..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                disabled={loading}
              />
            </div>

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
