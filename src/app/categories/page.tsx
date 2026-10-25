import { redirect } from "next/navigation";
import { getSession, resolveScope } from "@/lib/auth-guard";
import { RoomCategoryService, AmenityService } from "@/modules/rooms/room.service";
import { AppShell } from "@/components/app-shell";
import { CategoryManager } from "./category-manager";

export default async function CategoriesPage(props: {
  searchParams?: Promise<{ propertyId?: string; search?: string }>
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.mustChangePassword) {
    redirect("/change-password");
  }

  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const scope = resolveScope(session, searchParams?.propertyId, { allowSuperAdminGlobal: true });

  let categories: Awaited<ReturnType<typeof RoomCategoryService.getCategories>> = [];
  let amenities: Awaited<ReturnType<typeof AmenityService.getAmenities>> = [];

  try {
    const res = await Promise.all([
      RoomCategoryService.getCategories(scope ?? undefined, searchParams?.search),
      AmenityService.getAmenities(),
    ]);
    categories = res[0];
    amenities = res[1];
  } catch (err) {
    console.error("Failed to load categories or amenities in CategoriesPage:", err);
  }

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
