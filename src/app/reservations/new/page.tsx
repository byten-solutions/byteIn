import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { RoomCategoryService } from "@/modules/rooms/room.service";
import { AppShell } from "@/components/app-shell";
import { NewReservationForm } from "./new-reservation-form";

export default async function NewReservationPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const categories = await RoomCategoryService.getCategories();
  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    basePrice: c.basePrice.toString(),
    maxOccupancy: c.maxOccupancy,
  }));

  return (
    <AppShell session={session}>
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        <NewReservationForm categories={serializedCategories} />
      </div>
    </AppShell>
  );
}
