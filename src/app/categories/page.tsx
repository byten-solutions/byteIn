import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { RoomCategoryService, AmenityService } from "@/modules/rooms/room.service";
import { Navbar } from "@/components/navbar";
import { CategoryManager } from "./category-manager";

export default async function CategoriesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [categories, amenities] = await Promise.all([
    RoomCategoryService.getCategories(),
    AmenityService.getAmenities(),
  ]);

  // Serializing Decimal for client props
  const serializedCategories = categories.map((cat) => ({
    id: cat.id,
    propertyId: cat.propertyId,
    name: cat.name,
    description: cat.description,
    basePrice: cat.basePrice.toString(),
    maxOccupancy: cat.maxOccupancy,
    amenities: cat.amenities.map((a) => ({
      amenity: {
        id: a.amenity.id,
        name: a.amenity.name,
        description: a.amenity.description,
      },
    })),
    _count: cat._count,
  }));

  return (
    <div className="min-h-svh bg-muted/15 flex flex-col">
      <Navbar />

      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-8 flex-1">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Room Categories & Amenities</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage category configurations, snapshotted base nightly rates, occupancy limits, and attached amenities.
          </p>
        </div>

        <CategoryManager
          initialCategories={serializedCategories}
          amenities={amenities}
          userRole={session.role}
        />
      </main>
    </div>
  );
}
