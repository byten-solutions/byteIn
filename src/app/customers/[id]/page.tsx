import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { CustomerService } from "@/modules/customers/customer.service";
import { AppShell } from "@/components/app-shell";
import { CustomerDetailView } from "./customer-detail-view";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  let customer;
  try {
    customer = await CustomerService.getCustomerById(id);
  } catch {
    notFound();
  }

  const serializedCustomer = {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: customer.email,
    nationality: customer.nationality,
    address: customer.address,
    idProofType: customer.idProofType,
    idProofNumber: customer.idProofNumber,
    remarks: customer.remarks,
    createdAt: customer.createdAt.toISOString(),
    reservations: customer.reservations.map((r) => ({
      id: r.id,
      reservationNo: r.reservationNo,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      rooms: r.rooms.map((rm) => ({
        id: rm.id,
        roomNo: rm.room.roomNo,
        categoryName: rm.roomCategory.name,
        arrivalDate: rm.arrivalDate.toISOString().split("T")[0],
        departureDate: rm.departureDate.toISOString().split("T")[0],
        bookedNightlyRate: rm.bookedNightlyRate.toString(),
        status: rm.status,
      })),
    })),
  };

  return (
    <AppShell session={session}>
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        <CustomerDetailView customer={serializedCustomer} />
      </div>
    </AppShell>
  );
}
