import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { RoomService, RoomCategoryService } from "@/modules/rooms/room.service";
import { PropertyService } from "@/modules/properties/property.service";
import { AppShell } from "@/components/app-shell";
import { RoomManager } from "./room-manager";
import { RoomStatus } from "@prisma/client";

const VALID_STATUSES = new Set([
  "VACANT_CLEAN",
  "VACANT_DIRTY",
  "OCCUPIED",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
]);

export default async function RoomsPage(props: {
  searchParams?: Promise<{
    status?: string;
    propertyId?: string;
    buildingId?: string;
    floorId?: string;
    category?: string;
    search?: string;
    page?: string;
  }>;
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

  const [summary, categories, properties] = await Promise.all([
    RoomService.getRoomsSummary(),
    RoomCategoryService.getCategories(),
    PropertyService.getProperties(),
  ]);

  const defaultPropertyId = searchParams?.propertyId || properties[0]?.id;
  const activeProperty = properties.find((p) => p.id === defaultPropertyId) || properties[0];
  const defaultBuildingId = searchParams?.buildingId || activeProperty?.buildings[0]?.id;
  const activeBuilding =
    activeProperty?.buildings.find((b) => b.id === defaultBuildingId) ||
    activeProperty?.buildings[0];
  const defaultFloorId = searchParams?.floorId || activeBuilding?.floors[0]?.id;

  const page = searchParams?.page ? parseInt(searchParams.page, 10) : 1;

  const initialRoomsResult = await RoomService.getRoomsPage({
    propertyId: defaultPropertyId,
    buildingId: defaultBuildingId,
    floorId: defaultFloorId,
    roomCategoryId: searchParams?.category,
    status: initialStatus as RoomStatus | undefined,
    search: searchParams?.search,
    page: isNaN(page) ? 1 : page,
    limit: 50,
  });

  // Serialize Decimal objects for client component props
  const serializedRooms = initialRoomsResult.rooms.map((r) => ({
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

  const cleanRooms = summary.counts.clean;
  const dirtyRooms = summary.counts.dirty;

  return (
    <AppShell session={session} stats={{ cleanRooms, dirtyRooms }}>
      <div className="container mx-auto max-w-6xl px-6 py-8 lg:px-10 space-y-6">
        <RoomManager
          initialRooms={serializedRooms}
          initialPagination={{
            page: initialRoomsResult.page,
            limit: initialRoomsResult.limit,
            total: initialRoomsResult.total,
            totalPages: initialRoomsResult.totalPages,
          }}
          summaryCounts={summary.counts}
          categories={serializedCategories}
          properties={serializedProperties}
          userRole={session.role}
          initialStatus={initialStatus}
          initialPropertyId={defaultPropertyId}
          initialBuildingId={defaultBuildingId}
          initialFloorId={defaultFloorId}
        />
      </div>
    </AppShell>
  );
}
