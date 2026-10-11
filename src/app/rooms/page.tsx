import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { RoomService, RoomCategoryService } from "@/modules/rooms/room.service";
import { PropertyService } from "@/modules/properties/property.service";
import { AppShell } from "@/components/app-shell";
import { RoomManager } from "./room-manager";

export default async function RoomsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [rooms, categories, properties] = await Promise.all([
    RoomService.getRooms(),
    RoomCategoryService.getCategories(),
    PropertyService.getProperties(),
  ]);

  // Serialize Decimal objects for client component props
  const serializedRooms = rooms.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    buildingId: r.buildingId,
    floorId: r.floorId,
    roomCategoryId: r.roomCategoryId,
    roomNo: r.roomNo,
    displayName: r.displayName,
    capacity: r.capacity,
    status: r.status,
    priceOverride: r.priceOverride ? r.priceOverride.toString() : null,
    notes: r.notes,
    category: {
      id: r.category.id,
      name: r.category.name,
      basePrice: r.category.basePrice.toString(),
    },
    building: {
      id: r.building.id,
      name: r.building.name,
    },
    floor: {
      id: r.floor.id,
      floorNo: r.floor.floorNo,
      name: r.floor.name,
    },
  }));

  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    basePrice: c.basePrice.toString(),
    maxOccupancy: c.maxOccupancy,
  }));

  const serializedProperties = properties.map((p) => ({
    id: p.id,
    name: p.name,
    buildings: p.buildings.map((b) => ({
      id: b.id,
      name: b.name,
      floors: b.floors.map((f) => ({
        id: f.id,
        floorNo: f.floorNo,
        name: f.name,
      })),
    })),
  }));

  const cleanRooms = rooms.filter((r) => r.status === "VACANT_CLEAN").length;
  const dirtyRooms = rooms.filter((r) => r.status === "VACANT_DIRTY").length;

  return (
    <AppShell session={session} stats={{ cleanRooms, dirtyRooms }}>
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Room Inventory & Status</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Monitor physical room conditions, update operational statuses, and configure room allocations.
          </p>
        </div>

        <RoomManager
          initialRooms={serializedRooms}
          categories={serializedCategories}
          properties={serializedProperties}
          userRole={session.role}
        />
      </div>
    </AppShell>
  );
}
