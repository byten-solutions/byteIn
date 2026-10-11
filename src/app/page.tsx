import Link from "next/link";
import { Bed, Tag, ShieldCheck, ArrowRight, CheckCircle2, Clock, Wrench, Calendar, PlusCircle } from "lucide-react";
import { RoomStatus, ReservationStatus } from "@prisma/client";
import { getSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function Page() {
  const session = await getSession();

  let counts = {
    total: 0,
    clean: 0,
    dirty: 0,
    occupied: 0,
    maintenance: 0,
    reservations: 0,
    confirmedReservations: 0,
  };
  let categoryCount = 0;

  if (session) {
    const [total, clean, dirty, occupied, maintenance, categories, totalRes, confirmedRes] = await Promise.all([
      prisma.room.count(),
      prisma.room.count({ where: { status: RoomStatus.VACANT_CLEAN } }),
      prisma.room.count({ where: { status: RoomStatus.VACANT_DIRTY } }),
      prisma.room.count({ where: { status: RoomStatus.OCCUPIED } }),
      prisma.room.count({ where: { status: RoomStatus.MAINTENANCE } }),
      prisma.roomCategory.count(),
      prisma.reservation.count(),
      prisma.reservation.count({ where: { status: ReservationStatus.CONFIRMED } }),
    ]);

    counts = {
      total,
      clean,
      dirty,
      occupied,
      maintenance,
      reservations: totalRes,
      confirmedReservations: confirmedRes,
    };
    categoryCount = categories;
  }

  return (
    <AppShell
      session={session}
      stats={session ? { cleanRooms: counts.clean, dirtyRooms: counts.dirty } : undefined}
    >
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {session ? (
          <div className="space-y-8">
            {/* Welcome banner */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Welcome back, {session.name}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Reception Desk Operations • Authorized as{" "}
                  <strong className="text-foreground">{session.role}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link href="/reservations/new">
                  <Button size="sm" className="bg-primary hover:bg-primary/90">
                    <PlusCircle className="h-4 w-4 mr-1.5" />
                    New Reservation
                  </Button>
                </Link>
                <Link href="/reservations">
                  <Button variant="outline" size="sm">
                    <Calendar className="h-4 w-4 mr-1.5" />
                    Reservations
                  </Button>
                </Link>
                <Link href="/rooms">
                  <Button variant="outline" size="sm">
                    <Bed className="h-4 w-4 mr-1.5" />
                    Rooms
                  </Button>
                </Link>
              </div>
            </div>

            {/* Quick KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="shadow-xs">
                <CardHeader className="p-4 pb-1">
                  <CardDescription className="text-xs flex items-center justify-between">
                    Total Rooms
                    <Bed className="h-4 w-4 text-muted-foreground" />
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold font-mono">
                    {counts.total}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <span className="text-[11px] text-muted-foreground">
                    In physical inventory
                  </span>
                </CardContent>
              </Card>

              <Card className="shadow-xs border-emerald-500/20 bg-emerald-500/5">
                <CardHeader className="p-4 pb-1">
                  <CardDescription className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                    Vacant Clean
                    <CheckCircle2 className="h-4 w-4" />
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    {counts.clean}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <span className="text-[11px] text-muted-foreground">
                    Ready for guests
                  </span>
                </CardContent>
              </Card>

              <Card className="shadow-xs border-amber-500/20 bg-amber-500/5">
                <CardHeader className="p-4 pb-1">
                  <CardDescription className="text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
                    Vacant Dirty
                    <Clock className="h-4 w-4" />
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">
                    {counts.dirty}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <span className="text-[11px] text-muted-foreground">
                    Needs turnover
                  </span>
                </CardContent>
              </Card>

              <Card className="shadow-xs border-purple-500/20 bg-purple-500/5">
                <CardHeader className="p-4 pb-1">
                  <CardDescription className="text-xs text-purple-700 dark:text-purple-400 flex items-center justify-between">
                    Maintenance
                    <Wrench className="h-4 w-4" />
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-400">
                    {counts.maintenance}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <span className="text-[11px] text-muted-foreground">
                    Out for repair
                  </span>
                </CardContent>
              </Card>
            </div>

            {/* Quick Access Modules */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:border-foreground/20 transition-colors shadow-xs">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Reservations & Booking
                    </CardTitle>
                    <Badge variant="outline">{counts.confirmedReservations} active</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Multi-room bookings, live availability search, and rate snapshots.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Book reservations for guests across one or more physical rooms with independent stay dates and conflict-safe availability guarantees.
                  </p>
                  <div className="flex items-center gap-3">
                    <Link href="/reservations" className="inline-flex items-center text-xs font-semibold text-primary hover:underline">
                      View Bookings
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                    <span className="text-muted-foreground text-xs">•</span>
                    <Link href="/reservations/new" className="inline-flex items-center text-xs font-semibold text-primary hover:underline">
                      New Booking
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:border-foreground/20 transition-colors shadow-xs">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Bed className="h-5 w-5 text-primary" />
                      Room Inventory & Status
                    </CardTitle>
                    <Badge variant="outline">{counts.total} rooms</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Live room condition board for reception desk and housekeeping operations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    View room cards with live physical conditions (Clean, Dirty, Maintenance, Out of Service). Update operational statuses directly with one click.
                  </p>
                  <Link href="/rooms" className="inline-flex items-center text-xs font-semibold text-primary hover:underline">
                    Open Room Status Board
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </CardContent>
              </Card>

              <Card className="hover:border-foreground/20 transition-colors shadow-xs">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Tag className="h-5 w-5 text-primary" />
                      Categories & Setup
                    </CardTitle>
                    <Badge variant="outline">{categoryCount} categories</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Room catalog configuration, snapshotted base pricing, and amenities.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Define room categories with fixed-precision base nightly rates (`Decimal 10, 2`), maximum guest occupancy, and attached amenities.
                  </p>
                  <Link href="/categories" className="inline-flex items-center text-xs font-semibold text-primary hover:underline">
                    Configure Categories
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Card className="w-full max-w-md shadow-md text-center p-6">
              <CardHeader className="space-y-2">
                <ShieldCheck className="mx-auto h-12 w-12 text-primary/80" />
                <CardTitle className="text-xl font-bold tracking-tight">
                  byteInn Reception PMS
                </CardTitle>
                <CardDescription className="text-xs">
                  Internal property management system for reception desk staff.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <p className="text-xs text-muted-foreground">
                  Please authenticate with your staff account to access room allocations, operational status boards, and system catalog.
                </p>
                <Link href="/login" className="block w-full">
                  <Button className="w-full">Sign in to byteInn</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
