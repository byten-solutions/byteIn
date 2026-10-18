import { prisma } from "@/lib/prisma";
import { RoomStatus, ReservationStatus, PaymentStatus } from "@prisma/client";

export interface HotelDashboardStats {
  total: number;
  clean: number;
  dirty: number;
  occupied: number;
  maintenance: number;
  outOfService: number;
  confirmedReservations: number;
}

export interface PlatformPropertyOverview {
  id: string;
  name: string;
  status: string;
  address: string | null;
  city: string | null;
  country: string | null;
  _count: {
    rooms: number;
    users: number;
    buildings: number;
  };
  cleanRooms: number;
  occupiedRooms: number;
}

export interface PlatformDashboardStats {
  properties: PlatformPropertyOverview[];
  totalRooms: number;
  activeHotels: number;
  totalUsers: number;
  totalConfirmedRes: number;
  totalRevenue: number;
}

export class DashboardService {
  /**
   * Retrieves dashboard statistics for a single hotel (or platform-wide if no propertyId).
   */
  static async getHotelStats(propertyId?: string): Promise<HotelDashboardStats> {
    const [roomGroups, confirmedRes] = await Promise.all([
      prisma.room.groupBy({
        by: ["status"],
        where: propertyId ? { propertyId } : undefined,
        _count: { _all: true },
      }),
      prisma.reservation.count({
        where: {
          status: ReservationStatus.CONFIRMED,
          ...(propertyId ? { propertyId } : {}),
        },
      }),
    ]);

    let clean = 0;
    let dirty = 0;
    let occupied = 0;
    let maintenance = 0;
    let outOfService = 0;
    let total = 0;

    for (const group of roomGroups) {
      const c = group._count._all;
      total += c;
      if (group.status === RoomStatus.VACANT_CLEAN) clean = c;
      else if (group.status === RoomStatus.VACANT_DIRTY) dirty = c;
      else if (group.status === RoomStatus.OCCUPIED) occupied = c;
      else if (group.status === RoomStatus.MAINTENANCE) maintenance = c;
      else if (group.status === RoomStatus.OUT_OF_SERVICE) outOfService = c;
    }

    return {
      total,
      clean,
      dirty,
      occupied,
      maintenance,
      outOfService,
      confirmedReservations: confirmedRes,
    };
  }

  /**
   * Retrieves aggregated platform statistics for Super Admin.
   * Avoids loading room records into memory by grouping by (propertyId, status).
   */
  static async getPlatformStats(): Promise<PlatformDashboardStats> {
    const [rawProperties, roomGroups, totalUsers, totalConfirmedRes, totalPayments] = await Promise.all([
      prisma.property.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          address: true,
          city: true,
          country: true,
          _count: {
            select: {
              rooms: true,
              users: true,
              buildings: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.room.groupBy({
        by: ["propertyId", "status"],
        _count: { _all: true },
      }),
      prisma.user.count({
        where: { status: "ACTIVE" },
      }),
      prisma.reservation.count({
        where: { status: ReservationStatus.CONFIRMED },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.RECORDED },
      }),
    ]);

    const propertyRoomCounts = new Map<string, { clean: number; occupied: number }>();
    for (const rg of roomGroups) {
      const existing = propertyRoomCounts.get(rg.propertyId) || { clean: 0, occupied: 0 };
      if (rg.status === RoomStatus.VACANT_CLEAN) {
        existing.clean += rg._count._all;
      } else if (rg.status === RoomStatus.OCCUPIED) {
        existing.occupied += rg._count._all;
      }
      propertyRoomCounts.set(rg.propertyId, existing);
    }

    const properties: PlatformPropertyOverview[] = rawProperties.map((p) => {
      const counts = propertyRoomCounts.get(p.id) || { clean: 0, occupied: 0 };
      return {
        ...p,
        cleanRooms: counts.clean,
        occupiedRooms: counts.occupied,
      };
    });

    const totalRooms = properties.reduce((acc, p) => acc + p._count.rooms, 0);
    const activeHotels = properties.filter((p) => p.status === "ACTIVE").length;
    const totalRevenue = totalPayments._sum.amount ? Number(totalPayments._sum.amount) : 0;

    return {
      properties,
      totalRooms,
      activeHotels,
      totalUsers,
      totalConfirmedRes,
      totalRevenue,
    };
  }
}
