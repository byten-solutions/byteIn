import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { RoomCategoryService } from "@/modules/rooms/room.service";
import { Navbar } from "@/components/navbar";
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
    <div className="min-h-svh bg-muted/15 flex flex-col">
      <Navbar />
      <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-8 flex-1">
        <NewReservationForm categories={serializedCategories} />
      </main>
    </div>
  );
}
