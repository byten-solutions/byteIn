import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { ReservationService } from "@/modules/reservations/reservation.service";
import { AppShell } from "@/components/app-shell";
import { ReservationList } from "./reservation-list";

export default async function ReservationsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const result = await ReservationService.getReservations({ page: 1, limit: 20 });

  // Serialize Decimal objects and Date objects for client component
  const serializedReservations = result.reservations.map((r) => ({
    id: r.id,
    reservationNo: r.reservationNo,
    status: r.status,
    specialRequests: r.specialRequests,
    createdAt: r.createdAt.toISOString(),
    customer: {
      id: r.customer.id,
      firstName: r.customer.firstName,
      lastName: r.customer.lastName,
      phone: r.customer.phone,
      email: r.customer.email,
    },
    creator: {
      id: r.creator.id,
      name: r.creator.name,
      email: r.creator.email,
      role: r.creator.role.name,
    },
    rooms: r.rooms.map((rm) => ({
      id: rm.id,
      roomId: rm.roomId,
      roomNo: rm.room.roomNo,
      displayName: rm.room.displayName,
      buildingName: rm.room.building.name,
      floorNo: rm.room.floor.floorNo,
      categoryName: rm.roomCategory.name,
      arrivalDate: rm.arrivalDate.toISOString().split("T")[0],
      departureDate: rm.departureDate.toISOString().split("T")[0],
      bookedNightlyRate: rm.bookedNightlyRate.toString(),
      adults: rm.adults,
      children: rm.children,
      status: rm.status,
    })),
  }));

  return (
    <AppShell session={session}>
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <ReservationList
          initialReservations={serializedReservations}
          initialPagination={result.pagination}
        />
      </div>
    </AppShell>
  );
}
