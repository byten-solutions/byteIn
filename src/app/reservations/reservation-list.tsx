"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  PlusCircle,
  Search,
  User,
  Bed,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { ReservationStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface SerializedReservation {
  id: string;
  reservationNo: string;
  status: ReservationStatus;
  specialRequests: string | null;
  createdAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  };
  creator: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  rooms: {
    id: string;
    roomId: string;
    roomNo: string;
    displayName: string | null;
    buildingName: string;
    floorNo: number;
    categoryName: string;
    arrivalDate: string;
    departureDate: string;
    bookedNightlyRate: string;
    adults: number;
    children: number;
    status: string;
  }[];
}

interface ReservationListProps {
  initialReservations: SerializedReservation[];
}

export function ReservationList({ initialReservations }: ReservationListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredReservations = useMemo(() => {
    return initialReservations.filter((res) => {
      // Status filter
      if (statusFilter !== "ALL" && res.status !== statusFilter) {
        return false;
      }

      // Search term filter
      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase();
        const guestFullName = `${res.customer.firstName} ${res.customer.lastName || ""}`.toLowerCase();
        const matchesNo = res.reservationNo.toLowerCase().includes(q);
        const matchesName = guestFullName.includes(q);
        const matchesPhone = res.customer.phone?.toLowerCase().includes(q) ?? false;
        const matchesEmail = res.customer.email?.toLowerCase().includes(q) ?? false;
        const matchesRoom = res.rooms.some((r) => r.roomNo.toLowerCase().includes(q));

        return matchesNo || matchesName || matchesPhone || matchesEmail || matchesRoom;
      }

      return true;
    });
  }, [initialReservations, searchTerm, statusFilter]);

  const getStatusBadge = (status: ReservationStatus) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Confirmed
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStayDatesSummary = (rooms: SerializedReservation["rooms"]) => {
    if (rooms.length === 0) return "No rooms";
    const arrivals = rooms.map((r) => r.arrivalDate).sort();
    const departures = rooms.map((r) => r.departureDate).sort();
    const earliest = arrivals[0];
    const latest = departures[departures.length - 1];

    if (earliest === latest) return earliest;
    return `${earliest} → ${latest}`;
  };

  const getTotalNights = (arrivalStr: string, departureStr: string) => {
    const arr = new Date(arrivalStr);
    const dep = new Date(departureStr);
    return Math.max(1, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Reservations
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Reception desk guest booking registry, room allocations, and stay schedules.
          </p>
        </div>

        <Link href="/reservations/new">
          <Button className="bg-primary hover:bg-primary/90 shadow-sm">
            <PlusCircle className="h-4 w-4 mr-2" />
            New Reservation
          </Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <Card className="shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by reservation #, guest name, phone, or room..."
                className="pl-9 text-xs sm:text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
              {["ALL", "CONFIRMED", "COMPLETED", "CANCELLED"].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  className="text-xs capitalize h-8"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === "ALL" ? "All Statuses" : status.toLowerCase()}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reservations Table */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">
              All Bookings ({filteredReservations.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Showing active and historical reservations created by reception staff.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredReservations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="text-sm font-semibold">No reservations found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchTerm || statusFilter !== "ALL"
                  ? "No bookings match your current search or filter criteria."
                  : "There are currently no bookings registered in the system."}
              </p>
              <div className="mt-4">
                <Link href="/reservations/new">
                  <Button size="sm">
                    <PlusCircle className="h-4 w-4 mr-1.5" />
                    Create First Reservation
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[160px] text-xs font-semibold">Reservation No</TableHead>
                    <TableHead className="text-xs font-semibold">Primary Guest</TableHead>
                    <TableHead className="text-xs font-semibold">Stay Schedule</TableHead>
                    <TableHead className="text-xs font-semibold">Rooms Allocated</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Staff</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations.map((res) => {
                    const guestName = `${res.customer.firstName} ${res.customer.lastName || ""}`.trim();
                    const totalRateSnapshot = res.rooms.reduce(
                      (sum, r) => sum + parseFloat(r.bookedNightlyRate) * getTotalNights(r.arrivalDate, r.departureDate),
                      0
                    );

                    return (
                      <TableRow key={res.id} className="text-xs hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono font-medium">
                          <Link
                            href={`/reservations/${res.id}`}
                            className="text-primary hover:underline font-semibold"
                          >
                            {res.reservationNo}
                          </Link>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(res.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {guestName}
                          </div>
                          {(res.customer.phone || res.customer.email) && (
                            <div className="text-[11px] text-muted-foreground">
                              {res.customer.phone || res.customer.email}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="font-medium">
                            {getStayDatesSummary(res.rooms)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {res.rooms.length > 0 &&
                              `${getTotalNights(res.rooms[0].arrivalDate, res.rooms[0].departureDate)} night(s)`}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-wrap gap-1 items-center">
                            {res.rooms.map((rm) => (
                              <Badge key={rm.id} variant="outline" className="text-[11px] font-mono py-0">
                                <Bed className="h-3 w-3 mr-1" />
                                {rm.roomNo} ({rm.categoryName})
                              </Badge>
                            ))}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Est. ${totalRateSnapshot.toFixed(2)}
                          </div>
                        </TableCell>

                        <TableCell>
                          {getStatusBadge(res.status)}
                        </TableCell>

                        <TableCell>
                          <span className="text-xs font-medium">{res.creator.name}</span>
                          <span className="text-[10px] text-muted-foreground block">
                            {res.creator.role}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <Link href={`/reservations/${res.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                              View
                              <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
