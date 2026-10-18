import { Prisma, RoomStatus } from "@prisma/client";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateAmenityInput,
  CreateRoomInput,
  UpdateRoomInput,
  RoomFilterOptions,
} from "./room.types";

export class RoomCategoryService {
  static async createCategory(input: CreateCategoryInput) {
    if (input.propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: input.propertyId },
      });
      if (!property) {
        throw new Error("Property not found");
      }
    }

    const basePriceDecimal = new Prisma.Decimal(input.basePrice.toString());

    return prisma.$transaction(async (tx) => {
      const category = await tx.roomCategory.create({
        data: {
          propertyId: input.propertyId || null,
          name: input.name,
          description: input.description || null,
          basePrice: basePriceDecimal,
          maxOccupancy: input.maxOccupancy,
        },
      });

      if (input.amenityIds && input.amenityIds.length > 0) {
        await tx.roomCategoryAmenity.createMany({
          data: input.amenityIds.map((amenityId) => ({
            roomCategoryId: category.id,
            amenityId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.roomCategory.findUnique({
        where: { id: category.id },
        include: {
          amenities: {
            include: { amenity: true },
          },
          _count: {
            select: { rooms: true },
          },
        },
      });
    });
  }

  static async getCategories(propertyId?: string) {
    return prisma.roomCategory.findMany({
      where: propertyId ? { propertyId } : undefined,
      include: {
        amenities: {
          include: { amenity: true },
        },
        _count: {
          select: { rooms: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  static async getCategoryById(id: string) {
    return prisma.roomCategory.findUnique({
      where: { id },
      include: {
        amenities: {
          include: { amenity: true },
        },
        _count: {
          select: { rooms: true },
        },
      },
    });
  }

  static async updateCategory(id: string, input: UpdateCategoryInput) {
    const existing = await prisma.roomCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Room category not found");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.roomCategory.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.basePrice !== undefined && {
            basePrice: new Prisma.Decimal(input.basePrice.toString()),
          }),
          ...(input.maxOccupancy !== undefined && {
            maxOccupancy: input.maxOccupancy,
          }),
        },
      });

      if (input.amenityIds !== undefined) {
        await tx.roomCategoryAmenity.deleteMany({
          where: { roomCategoryId: id },
        });

        if (input.amenityIds.length > 0) {
          await tx.roomCategoryAmenity.createMany({
            data: input.amenityIds.map((amenityId) => ({
              roomCategoryId: id,
              amenityId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.roomCategory.findUnique({
        where: { id: updated.id },
        include: {
          amenities: {
            include: { amenity: true },
          },
          _count: {
            select: { rooms: true },
          },
        },
      });
    });
  }

  static async deleteCategory(id: string) {
    const existing = await prisma.roomCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { rooms: true } },
      },
    });

    if (!existing) {
      throw new Error("Room category not found");
    }

    if (existing._count.rooms > 0) {
      throw new Error(
        "Cannot delete room category because it is currently assigned to existing rooms."
      );
    }

    return prisma.roomCategory.delete({
      where: { id },
    });
  }
}

export class AmenityService {
  static async createAmenity(input: CreateAmenityInput) {
    return prisma.amenity.upsert({
      where: { name: input.name },
      update: { description: input.description || null },
      create: {
        name: input.name,
        description: input.description || null,
      },
    });
  }

  static async getAmenities() {
    return prisma.amenity.findMany({
      include: {
        _count: { select: { categories: true } },
      },
      orderBy: { name: "asc" },
    });
  }
}

export class RoomService {
  /**
   * Invalidation helper for room status summary.
   */
  public static invalidateRoomsCache(): void {
    try {
      revalidateTag("rooms-summary", "max");
    } catch {
      // Ignore outside Next.js request context (e.g. tests or worker tasks)
    }
  }

  /**
   * Computes table-wide room status counts and property/building/floor facets,
   * cached with tag 'rooms-summary'.
   */
  public static async getRoomsSummary(propertyId?: string): Promise<{
    counts: {
      total: number;
      clean: number;
      dirty: number;
      occupied: number;
      maintenance: number;
      outOfService: number;
    };
    facets: Array<{
      propertyId: string;
      buildingId: string;
      floorId: string;
      count: number;
    }>;
  }> {
    const fetchSummary = async () => {
      const where: Prisma.RoomWhereInput = propertyId ? { propertyId } : {};
      const [statusGroups, buildingFloorGroups] = await Promise.all([
        prisma.room.groupBy({
          where,
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.room.groupBy({
          where,
          by: ["propertyId", "buildingId", "floorId"],
          _count: { _all: true },
        }),
      ]);

      const counts = {
        total: 0,
        clean: 0,
        dirty: 0,
        occupied: 0,
        maintenance: 0,
        outOfService: 0,
      };

      for (const sg of statusGroups) {
        counts.total += sg._count._all;
        if (sg.status === RoomStatus.VACANT_CLEAN) counts.clean = sg._count._all;
        else if (sg.status === RoomStatus.VACANT_DIRTY) counts.dirty = sg._count._all;
        else if (sg.status === RoomStatus.OCCUPIED) counts.occupied = sg._count._all;
        else if (sg.status === RoomStatus.MAINTENANCE) counts.maintenance = sg._count._all;
        else if (sg.status === RoomStatus.OUT_OF_SERVICE) counts.outOfService = sg._count._all;
      }

      const facets = buildingFloorGroups.map((bf) => ({
        propertyId: bf.propertyId,
        buildingId: bf.buildingId,
        floorId: bf.floorId,
        count: bf._count._all,
      }));

      return { counts, facets };
    };

    if (propertyId) {
      return fetchSummary();
    }

    try {
      const cached = unstable_cache(fetchSummary, ["rooms-summary"], {
        tags: ["rooms-summary"],
        revalidate: 60,
      });
      return await cached();
    } catch {
      return fetchSummary();
    }
  }

  static async createRoom(input: CreateRoomInput) {
    // 1. Verify property
    const property = await prisma.property.findUnique({
      where: { id: input.propertyId },
    });
    if (!property) {
      throw new Error("Property not found");
    }

    // 2. Verify building belongs to property
    const building = await prisma.building.findUnique({
      where: { id: input.buildingId },
    });
    if (!building) {
      throw new Error("Building not found");
    }
    if (building.propertyId !== input.propertyId) {
      throw new Error("Building does not belong to the selected property");
    }

    // 3. Verify floor belongs to building
    const floor = await prisma.floor.findUnique({
      where: { id: input.floorId },
    });
    if (!floor) {
      throw new Error("Floor not found");
    }
    if (floor.buildingId !== input.buildingId) {
      throw new Error("Floor does not belong to the selected building");
    }

    // 4. Verify room category
    const category = await prisma.roomCategory.findUnique({
      where: { id: input.roomCategoryId },
    });
    if (!category) {
      throw new Error("Room category not found");
    }
    if (category.propertyId && category.propertyId !== input.propertyId) {
      throw new Error("Room category does not belong to the selected property");
    }

    // 5. Verify room number uniqueness within the building
    const duplicate = await prisma.room.findUnique({
      where: {
        buildingId_roomNo: {
          buildingId: input.buildingId,
          roomNo: input.roomNo,
        },
      },
    });
    if (duplicate) {
      throw new Error(
        `A room with number '${input.roomNo}' already exists in this building`
      );
    }

    const priceOverrideDecimal =
      input.priceOverride !== undefined && input.priceOverride !== null
        ? new Prisma.Decimal(input.priceOverride.toString())
        : null;

    const created = await prisma.room.create({
      data: {
        propertyId: input.propertyId,
        buildingId: input.buildingId,
        floorId: input.floorId,
        roomCategoryId: input.roomCategoryId,
        roomNo: input.roomNo,
        displayName: input.displayName || null,
        capacity: input.capacity,
        status: input.status || RoomStatus.VACANT_CLEAN,
        priceOverride: priceOverrideDecimal,
        notes: input.notes || null,
      },
      include: {
        category: true,
        building: true,
        floor: true,
        property: true,
      },
    });
    this.invalidateRoomsCache();
    return created;
  }

  /**
   * Retrieves paginated rooms with building/floor ordering and total count.
   */
  static async getRoomsPage(filters?: RoomFilterOptions) {
    const page = Math.max(1, filters?.page || 1);
    const limit = Math.max(1, Math.min(100, filters?.limit || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.RoomWhereInput = {};
    if (filters?.propertyId) where.propertyId = filters.propertyId;
    if (filters?.buildingId) where.buildingId = filters.buildingId;
    if (filters?.floorId) where.floorId = filters.floorId;
    if (filters?.roomCategoryId) where.roomCategoryId = filters.roomCategoryId;
    if (filters?.status) where.status = filters.status;

    if (filters?.search && filters.search.trim() !== "") {
      const q = filters.search.trim();
      where.OR = [
        { roomNo: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ];
    }

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        where,
        include: {
          category: {
            include: {
              amenities: { include: { amenity: true } },
            },
          },
          building: true,
          floor: true,
          property: true,
        },
        orderBy: [
          { building: { name: "asc" } },
          { floor: { floorNo: "asc" } },
          { roomNo: "asc" },
        ],
        skip,
        take: limit,
      }),
      prisma.room.count({ where }),
    ]);

    return {
      rooms,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  static async getRooms(filters?: RoomFilterOptions) {
    const where: Prisma.RoomWhereInput = {};

    if (filters?.propertyId) where.propertyId = filters.propertyId;
    if (filters?.buildingId) where.buildingId = filters.buildingId;
    if (filters?.floorId) where.floorId = filters.floorId;
    if (filters?.roomCategoryId) where.roomCategoryId = filters.roomCategoryId;
    if (filters?.status) where.status = filters.status;

    if (filters?.search && filters.search.trim() !== "") {
      const q = filters.search.trim();
      where.OR = [
        { roomNo: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ];
    }

    const page = filters?.page ? Math.max(1, filters.page) : undefined;
    const limit = filters?.limit ? Math.max(1, Math.min(100, filters.limit)) : 50;
    const skip = page && limit ? (page - 1) * limit : undefined;

    return prisma.room.findMany({
      where,
      include: {
        category: {
          include: {
            amenities: { include: { amenity: true } },
          },
        },
        building: true,
        floor: true,
        property: true,
      },
      orderBy: [
        { building: { name: "asc" } },
        { floor: { floorNo: "asc" } },
        { roomNo: "asc" },
      ],
      skip,
      take: limit,
    });
  }

  static async getRoomById(id: string) {
    return prisma.room.findUnique({
      where: { id },
      include: {
        category: {
          include: {
            amenities: { include: { amenity: true } },
          },
        },
        building: true,
        floor: true,
        property: true,
      },
    });
  }

  static async updateRoom(id: string, input: UpdateRoomInput) {
    const existing = await prisma.room.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Room not found");
    }

    const buildingId = input.buildingId || existing.buildingId;
    const roomNo = input.roomNo || existing.roomNo;

    // Check duplicate room number if either buildingId or roomNo changed
    if (buildingId !== existing.buildingId || roomNo !== existing.roomNo) {
      const duplicate = await prisma.room.findUnique({
        where: {
          buildingId_roomNo: {
            buildingId,
            roomNo,
          },
        },
      });
      if (duplicate && duplicate.id !== id) {
        throw new Error(
          `A room with number '${roomNo}' already exists in this building`
        );
      }
    }

    // Validate floor if changed
    if (input.floorId && input.floorId !== existing.floorId) {
      const floor = await prisma.floor.findUnique({ where: { id: input.floorId } });
      if (!floor || floor.buildingId !== buildingId) {
        throw new Error("Floor does not belong to the selected building");
      }
    }

    // Validate category if changed
    if (input.roomCategoryId && input.roomCategoryId !== existing.roomCategoryId) {
      const category = await prisma.roomCategory.findUnique({
        where: { id: input.roomCategoryId },
      });
      if (!category) {
        throw new Error("Room category not found");
      }
    }

    const priceOverrideDecimal =
      input.priceOverride !== undefined
        ? input.priceOverride === null
          ? null
          : new Prisma.Decimal(input.priceOverride.toString())
        : undefined;

    const updated = await prisma.room.update({
      where: { id },
      data: {
        ...(input.propertyId && { propertyId: input.propertyId }),
        ...(input.buildingId && { buildingId: input.buildingId }),
        ...(input.floorId && { floorId: input.floorId }),
        ...(input.roomCategoryId && { roomCategoryId: input.roomCategoryId }),
        ...(input.roomNo && { roomNo: input.roomNo }),
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.capacity !== undefined && { capacity: input.capacity }),
        ...(priceOverrideDecimal !== undefined && {
          priceOverride: priceOverrideDecimal,
        }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
      include: {
        category: true,
        building: true,
        floor: true,
        property: true,
      },
    });
    this.invalidateRoomsCache();
    return updated;
  }

  /**
   * Updates physical operational status of a room according to documented transition rules.
   */
  static async updateRoomStatus(
    id: string,
    newStatus: RoomStatus,
    notes?: string | null,
    actor?: { userId?: string; name?: string }
  ) {
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) {
      throw new Error("Room not found");
    }

    // Invariant: Cannot manually transition an OCCUPIED room without checkout workflow
    if (room.status === RoomStatus.OCCUPIED && newStatus !== RoomStatus.OCCUPIED) {
      throw new Error(
        "Cannot manually change status of an OCCUPIED room. Room must be checked out through the checkout workflow."
      );
    }

    // Invariant: Cannot manually transition a room into OCCUPIED without check-in workflow
    if (newStatus === RoomStatus.OCCUPIED && room.status !== RoomStatus.OCCUPIED) {
      throw new Error(
        "Cannot manually set status to OCCUPIED. Room must be checked in through the guest check-in workflow."
      );
    }

    const oldStatus = room.status;

    const updated = await prisma.room.update({
      where: { id },
      data: {
        status: newStatus,
        ...(notes !== undefined && { notes }),
      },
      include: {
        category: true,
        building: true,
        floor: true,
      },
    });

    // Record audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: actor?.userId || null,
          entityType: "ROOM",
          entityId: room.id,
          action: "ROOM_STATUS_CHANGED",
          oldData: { status: oldStatus, roomNo: room.roomNo },
          newData: {
            status: newStatus,
            notes: notes || null,
            actorName: actor?.name || "STAFF",
          },
        },
      });
    } catch (auditErr) {
      console.error("Failed to record room status audit log:", auditErr);
    }

    this.invalidateRoomsCache();
    return updated;
  }

  static async deleteRoom(id: string) {
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        _count: { select: { reservationRooms: true } },
      },
    });

    if (!room) {
      throw new Error("Room not found");
    }

    if (room._count.reservationRooms > 0) {
      throw new Error(
        "Cannot delete room because it is associated with existing bookings."
      );
    }

    const deleted = await prisma.room.delete({ where: { id } });
    this.invalidateRoomsCache();
    return deleted;
  }
}
