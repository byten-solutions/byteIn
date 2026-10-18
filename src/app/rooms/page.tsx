import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { RoomService, RoomCategoryService } from "@/modules/rooms/room.service";
import { PropertyService } from "@/modules/properties/property.service";
import { AppShell } from "@/components/app-shell";
import { RoomManager } from "./room-manager";

const VALID_STATUSES = new Set([
  "VACANT_CLEAN",
  "VACANT_DIRTY",
  "OCCUPIED",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
]);

export default async function RoomsPage(props: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.mustChangePassword) {
    redirect("/change-password");
  }

  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const rawStatus = searchParams?.status;
  const initialStatus = rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : undefined;

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
      <div className="container mx-auto max-w-6xl px-6 py-8 lg:px-10 space-y-6">
        <RoomManager
          initialRooms={serializedRooms}
          categories={serializedCategories}
          properties={serializedProperties}
          userRole={session.role}
          initialStatus={initialStatus}
        />
      </div>
    </AppShell>
  );
}
