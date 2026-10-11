import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { CustomerService } from "@/modules/customers/customer.service";
import { Navbar } from "@/components/navbar";
import { CustomerList } from "./customer-list";

export default async function CustomersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const result = await CustomerService.getCustomers({ page: 1, limit: 50 });

  const serializedCustomers = result.customers.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    email: c.email,
    nationality: c.nationality,
    address: c.address,
    idProofType: c.idProofType,
    idProofNumber: c.idProofNumber,
    remarks: c.remarks,
    reservationsCount: c._count.reservations,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-svh bg-muted/15 flex flex-col">
      <Navbar />
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-8 flex-1">
        <CustomerList initialCustomers={serializedCustomers} />
      </main>
    </div>
  );
}
