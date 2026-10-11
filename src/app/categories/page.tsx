import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { RoomCategoryService, AmenityService } from "@/modules/rooms/room.service";
import { AppShell } from "@/components/app-shell";
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
    <AppShell session={session}>
      <div className="container mx-auto max-w-6xl px-6 py-8 lg:px-10 space-y-6">
        <CategoryManager
          initialCategories={serializedCategories}
          amenities={amenities}
          userRole={session.role}
        />
      </div>
    </AppShell>
  );
}
