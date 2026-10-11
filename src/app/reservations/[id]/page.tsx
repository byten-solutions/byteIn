import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  User,
  Bed,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowLeft,
  ShieldCheck,
  FileText,
  PlusCircle,
} from "lucide-react";
import { getSession } from "@/lib/auth-guard";
import { ReservationService } from "@/modules/reservations/reservation.service";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AllocationActionRow } from "./allocation-action-row";

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  let reservation;
  try {
    reservation = await ReservationService.getReservationById(id);
  } catch {
    notFound();
  }

  const guestFullName = `${reservation.customer.firstName} ${reservation.customer.lastName || ""}`.trim();

  const getNights = (arrival: Date, departure: Date) => {
    return Math.max(
      1,
      Math.round((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24))
    );
  };

  const totalNights = reservation.rooms.reduce(
    (sum, r) => sum + getNights(r.arrivalDate, r.departureDate),
    0
  );

  const totalBookingValue = reservation.rooms.reduce(
    (sum, r) =>
      sum +
      getNights(r.arrivalDate, r.departureDate) * parseFloat(r.bookedNightlyRate.toString()),
    0
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Confirmed
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
            <Clock className="h-3.5 w-3.5 mr-1" />
            Completed
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30">
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-svh bg-muted/15 flex flex-col">
      <Navbar />

      <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-8 flex-1 space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6">
          <div className="flex items-center gap-3">
            <Link href="/reservations">
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                <ArrowLeft className="h-4 w-4 mr-1" />
                All Reservations
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono">
                  {reservation.reservationNo}
                </h1>
                {getStatusBadge(reservation.status)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Booked on {reservation.createdAt.toLocaleDateString()} at{" "}
                {reservation.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/reservations/new">
              <Button size="sm" variant="outline" className="text-xs">
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                New Reservation
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Primary Guest & Booking Metadata (1 Col) */}
          <div className="space-y-6">
            {/* Primary Guest Card */}
            <Card className="shadow-xs">
              <CardHeader className="p-4 border-b bg-muted/20">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Primary Guest
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Full Name</span>
                  <span className="font-semibold text-sm">{guestFullName}</span>
                </div>

                {reservation.customer.phone && (
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Phone</span>
                    <span>{reservation.customer.phone}</span>
                  </div>
                )}

                {reservation.customer.email && (
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Email</span>
                    <span>{reservation.customer.email}</span>
                  </div>
                )}

                {reservation.customer.nationality && (
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Nationality</span>
                    <span>{reservation.customer.nationality}</span>
                  </div>
                )}

                {reservation.customer.idProofNumber && (
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      ID Proof ({reservation.customer.idProofType || "Document"})
                    </span>
                    <span className="font-mono">{reservation.customer.idProofNumber}</span>
                  </div>
                )}

                {reservation.customer.address && (
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Address</span>
                    <span>{reservation.customer.address}</span>
                  </div>
                )}

                {reservation.customer.remarks && (
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Guest Notes</span>
                    <span className="italic">{reservation.customer.remarks}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reception Staff & Audit Card */}
            <Card className="shadow-xs">
              <CardHeader className="p-4 border-b bg-muted/20">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Reception Desk Record
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booked By:</span>
                  <span className="font-medium">{reservation.creator.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role:</span>
                  <Badge variant="outline" className="text-[10px]">
                    {reservation.creator.role.name}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Staff Email:</span>
                  <span className="text-muted-foreground">{reservation.creator.email}</span>
                </div>
              </CardContent>
            </Card>

            {/* Special Requests */}
            {reservation.specialRequests && (
              <Card className="shadow-xs">
                <CardHeader className="p-4 border-b bg-muted/20">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Special Requests
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-xs italic text-muted-foreground">
                  &quot;{reservation.specialRequests}&quot;
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Room Allocations & Monetary Snapshots (2 Cols) */}
          <div className="md:col-span-2 space-y-6">
            <Card className="shadow-xs">
              <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Bed className="h-4 w-4 text-primary" />
                    Physical Room Allocations ({reservation.rooms.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Assigned physical rooms with independent stay dates and snapshotted rates.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {totalNights} Night{totalNights === 1 ? "" : "s"} Total
                </Badge>
              </CardHeader>

              <CardContent className="p-0">
                <div className="divide-y">
                  {reservation.rooms.map((allocation) => {
                    const arrStr = allocation.arrivalDate.toISOString().split("T")[0];
                    const depStr = allocation.departureDate.toISOString().split("T")[0];
                    const nights = getNights(allocation.arrivalDate, allocation.departureDate);
                    const nightlyRate = parseFloat(allocation.bookedNightlyRate.toString());
                    const roomSubtotal = nights * nightlyRate;

                    return (
                      <AllocationActionRow
                        key={allocation.id}
                        allocation={{
                          id: allocation.id,
                          roomId: allocation.roomId,
                          roomNo: allocation.room.roomNo,
                          roomStatus: allocation.room.status,
                          categoryName: allocation.roomCategory.name,
                          displayName: allocation.room.displayName,
                          buildingName: allocation.room.building.name,
                          floorNo: allocation.room.floor.floorNo,
                          arrivalDate: arrStr,
                          departureDate: depStr,
                          nights,
                          adults: allocation.adults,
                          children: allocation.children,
                          bookedNightlyRate: allocation.bookedNightlyRate.toString(),
                          roomSubtotal,
                          status: allocation.status,
                          checkedInAt: allocation.checkedInAt
                            ? allocation.checkedInAt.toISOString()
                            : null,
                          checkedOutAt: allocation.checkedOutAt
                            ? allocation.checkedOutAt.toISOString()
                            : null,
                        }}
                        customer={{
                          id: reservation.customer.id,
                          firstName: reservation.customer.firstName,
                          lastName: reservation.customer.lastName,
                          idProofType: reservation.customer.idProofType,
                          idProofNumber: reservation.customer.idProofNumber,
                        }}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Booking Cost Summary Card */}
            <Card className="shadow-xs bg-muted/10">
              <CardHeader className="p-4 border-b">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>Financial Breakdown</span>
                  <span className="text-xs font-normal text-muted-foreground font-mono">
                    PostgreSQL Fixed-Precision Decimal(10, 2)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Allocated Rooms:</span>
                  <span className="font-medium text-foreground">{reservation.rooms.length}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Cumulative Nights:</span>
                  <span className="font-medium text-foreground">{totalNights}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t text-foreground">
                  <span>Estimated Total Booking Value:</span>
                  <span className="text-primary font-mono text-lg">
                    ${totalBookingValue.toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">
                  * Snapshotted at booking time. Invoicing and payment recording occur in subsequent operations.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
