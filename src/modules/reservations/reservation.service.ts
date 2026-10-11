import crypto from "crypto";
import { Prisma, RoomStatus, AllocationStatus, ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CheckAvailabilityInput,
  CreateReservationInput,
  ReservationFilterOptions,
  AvailableRoomResult,
} from "./reservation.types";
import { normalizeDate } from "./reservation.validation";

export class ReservationConflictError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = "ReservationConflictError";
  }
}

export class ReservationService {
  /**
   * Generates a collision-resistant human-readable reservation number:
   * Format: RES-YYYYMMDD-XXXX (e.g. RES-20261011-8F2B)
   */
  private static generateReservationNumber(): string {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
    return `RES-${y}${m}${d}-${suffix}`;
  }

  /**
   * Searches for available physical rooms for the given date range [arrivalDate, departureDate).
   * Excludes rooms that are:
   * 1. Under MAINTENANCE or OUT_OF_SERVICE.
   * 2. Already allocated in CONFIRMED or CHECKED_IN status during overlapping dates.
   *    (existing.arrival < requested.departure AND existing.departure > requested.arrival)
   */
  static async checkAvailability(
    input: CheckAvailabilityInput
  ): Promise<AvailableRoomResult[]> {
    const arrivalDate = normalizeDate(input.arrivalDate);
    const departureDate = normalizeDate(input.departureDate);

    if (departureDate.getTime() <= arrivalDate.getTime()) {
      throw new Error("Departure date must be after arrival date");
    }

    // 1. Find physical rooms that currently have overlapping active allocations
    const overlappingAllocations = await prisma.reservationRoom.findMany({
      where: {
        status: { in: [AllocationStatus.CONFIRMED, AllocationStatus.CHECKED_IN] },
        arrivalDate: { lt: departureDate },
        departureDate: { gt: arrivalDate },
      },
      select: {
        roomId: true,
      },
    });

    const bookedRoomIds = new Set(overlappingAllocations.map((a) => a.roomId));

    // 2. Query available physical rooms that are NOT in bookedRoomIds and operational status permits booking
    const where: Prisma.RoomWhereInput = {
      // Exclude maintenance and out of service rooms
      status: {
        notIn: [RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE],
      },
      // Exclude rooms with overlapping bookings
      id: {
        notIn: Array.from(bookedRoomIds),
      },
    };

    if (input.propertyId) {
      where.propertyId = input.propertyId;
    }

    if (input.roomCategoryId) {
      where.roomCategoryId = input.roomCategoryId;
    }

    if (input.minCapacity) {
      where.capacity = {
        gte: input.minCapacity,
      };
    }

    const rooms = await prisma.room.findMany({
      where,
      include: {
        building: { select: { id: true, name: true } },
        floor: { select: { id: true, floorNo: true, name: true } },
        category: {
          include: {
            amenities: {
              include: {
                amenity: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ building: { name: "asc" } }, { roomNo: "asc" }],
    });

    return rooms.map((room) => ({
      id: room.id,
      roomNo: room.roomNo,
      displayName: room.displayName,
      capacity: room.capacity,
      status: room.status,
      building: room.building,
      floor: room.floor,
      category: room.category,
      effectiveRate: room.priceOverride ?? room.category.basePrice,
    }));
  }

  /**
   * Concurrency-safe atomic reservation creation.
   * Acquires row-level locks on sorted room IDs inside a PostgreSQL transaction,
   * re-validates availability, snapshots agreed nightly rates, and creates
   * Reservation + ReservationRoom records atomically with an audit log entry.
   */
  static async createReservation(
    input: CreateReservationInput,
    creatorUserId: string
  ) {
    if (!input.allocations || input.allocations.length === 0) {
      throw new Error("At least one room allocation is required");
    }

    // Normalize dates on all allocations
    const normalizedAllocations = input.allocations.map((alloc) => {
      const arr = normalizeDate(alloc.arrivalDate);
      const dep = normalizeDate(alloc.departureDate);
      if (dep.getTime() <= arr.getTime()) {
        throw new Error(
          `Departure date must be after arrival date for room allocation ${alloc.roomId}`
        );
      }
      return {
        ...alloc,
        arrivalDate: arr,
        departureDate: dep,
      };
    });

    // Check for internal overlaps if same room is requested multiple times in this reservation
    for (let i = 0; i < normalizedAllocations.length; i++) {
      for (let j = i + 1; j < normalizedAllocations.length; j++) {
        const a = normalizedAllocations[i];
        const b = normalizedAllocations[j];
        if (a.roomId === b.roomId) {
          if (
            a.arrivalDate.getTime() < b.departureDate.getTime() &&
            a.departureDate.getTime() > b.arrivalDate.getTime()
          ) {
            throw new Error(
              `Room ${a.roomId} cannot be allocated multiple times for overlapping dates in the same reservation`
            );
          }
        }
      }
    }

    // Collect and sort room IDs alphabetically to prevent deadlocks across concurrent bookings
    const sortedRoomIds = Array.from(
      new Set(normalizedAllocations.map((a) => a.roomId))
    ).sort();

    try {
      return await prisma.$transaction(
        async (tx) => {
          // 1. Resolve or create customer
          let customerId = input.customerId;
          if (!customerId && input.newCustomer) {
            const customer = await tx.customer.create({
              data: {
                firstName: input.newCustomer.firstName.trim(),
                lastName: input.newCustomer.lastName?.trim() || null,
                phone: input.newCustomer.phone?.trim() || null,
                email: input.newCustomer.email?.trim() || null,
                nationality: input.newCustomer.nationality?.trim() || null,
                address: input.newCustomer.address?.trim() || null,
                idProofType: input.newCustomer.idProofType?.trim() || null,
                idProofNumber: input.newCustomer.idProofNumber?.trim() || null,
                remarks: input.newCustomer.remarks?.trim() || null,
              },
            });
            customerId = customer.id;
          } else if (customerId) {
            const customer = await tx.customer.findUnique({
              where: { id: customerId },
            });
            if (!customer) {
              throw new Error("Customer not found");
            }
          } else {
            throw new Error(
              "Either an existing customerId or newCustomer details must be provided"
            );
          }

          // 2. Acquire row-level locks on requested rooms in deterministic order
          // This serializes concurrent booking transactions touching the same room(s)
          await tx.$queryRaw`SELECT "id" FROM "rooms" WHERE "id" = ANY(${sortedRoomIds}::text[]) FOR UPDATE`;

          // 3. Load rooms and verify physical operational status
          const rooms = await tx.room.findMany({
            where: { id: { in: sortedRoomIds } },
            include: { category: true },
          });

          if (rooms.length !== sortedRoomIds.length) {
            throw new Error("One or more selected rooms do not exist");
          }

          const roomMap = new Map(rooms.map((r) => [r.id, r]));

          for (const room of rooms) {
            if (
              room.status === RoomStatus.MAINTENANCE ||
              room.status === RoomStatus.OUT_OF_SERVICE
            ) {
              throw new Error(
                `Room ${room.roomNo} is currently under ${room.status.replace("_", " ")} and cannot be booked`
              );
            }
          }

          // 4. Check for overlapping active allocations in the database for each allocation
          const overlapOrConditions = normalizedAllocations.map((alloc) => ({
            roomId: alloc.roomId,
            arrivalDate: { lt: alloc.departureDate },
            departureDate: { gt: alloc.arrivalDate },
          }));

          const conflicts = await tx.reservationRoom.findMany({
            where: {
              status: { in: [AllocationStatus.CONFIRMED, AllocationStatus.CHECKED_IN] },
              OR: overlapOrConditions,
            },
            include: {
              room: { select: { roomNo: true } },
            },
          });

          if (conflicts.length > 0) {
            const conflictRoomNos = Array.from(
              new Set(conflicts.map((c) => c.room.roomNo))
            ).join(", ");
            throw new ReservationConflictError(
              `Room(s) ${conflictRoomNos} are already booked for overlapping dates`
            );
          }

          // 5. Generate unique reservation number
          let reservationNo = this.generateReservationNumber();
          let exists = await tx.reservation.findUnique({
            where: { reservationNo },
          });
          while (exists) {
            reservationNo = this.generateReservationNumber();
            exists = await tx.reservation.findUnique({
              where: { reservationNo },
            });
          }

          // 6. Create Reservation and ReservationRoom allocations with snapshotted nightly rates
          const createdReservation = await tx.reservation.create({
            data: {
              reservationNo,
              customerId: customerId!,
              status: ReservationStatus.CONFIRMED,
              createdBy: creatorUserId,
              specialRequests: input.specialRequests?.trim() || null,
              rooms: {
                create: normalizedAllocations.map((alloc) => {
                  const room = roomMap.get(alloc.roomId)!;
                  // Rate snapshot logic:
                  // Use input rate if explicitly provided; otherwise room price override or category base price
                  const rateDecimal =
                    alloc.bookedNightlyRate !== undefined &&
                    alloc.bookedNightlyRate !== null
                      ? new Prisma.Decimal(alloc.bookedNightlyRate.toString())
                      : room.priceOverride ?? room.category.basePrice;

                  return {
                    roomId: alloc.roomId,
                    roomCategoryId: room.roomCategoryId,
                    arrivalDate: alloc.arrivalDate,
                    departureDate: alloc.departureDate,
                    bookedNightlyRate: rateDecimal,
                    adults: alloc.adults ?? 1,
                    children: alloc.children ?? 0,
                    status: AllocationStatus.CONFIRMED,
                  };
                }),
              },
            },
            include: {
              customer: true,
              creator: {
                select: { id: true, name: true, email: true, role: true },
              },
              rooms: {
                include: {
                  room: {
                    include: {
                      building: true,
                      floor: true,
                    },
                  },
                  roomCategory: true,
                },
              },
            },
          });

          // 7. Record Audit Log
          await tx.auditLog.create({
            data: {
              userId: creatorUserId,
              entityType: "Reservation",
              entityId: createdReservation.id,
              action: "RESERVATION_CREATED",
              newData: {
                reservationNo: createdReservation.reservationNo,
                customerId: createdReservation.customerId,
                roomCount: createdReservation.rooms.length,
                roomNumbers: createdReservation.rooms.map((r) => r.room.roomNo),
              },
            },
          });

          return createdReservation;
        },
        {
          timeout: 15000,
        }
      );
    } catch (error: unknown) {
      // Catch PostgreSQL Exclusion Constraint violation (code 23P01)
      const err = error as { code?: string; message?: string } | undefined;
      if (
        err?.code === "23P01" ||
        err?.message?.includes("no_overlapping_active_allocations")
      ) {
        throw new ReservationConflictError(
          "A concurrent booking was made for one of the requested rooms with overlapping dates. Please choose another room or date."
        );
      }
      throw error;
    }
  }

  /**
   * Retrieves paginated list of reservations with primary customer, room allocations, and creator.
   */
  static async getReservations(options: ReservationFilterOptions = {}) {
    const { search, status, page = 1, limit = 20 } = options;
    const skip = (Math.max(1, page) - 1) * limit;

    const where: Prisma.ReservationWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search && search.trim() !== "") {
      const q = search.trim();
      where.OR = [
        { reservationNo: { contains: q, mode: "insensitive" } },
        { customer: { firstName: { contains: q, mode: "insensitive" } } },
        { customer: { lastName: { contains: q, mode: "insensitive" } } },
        { customer: { phone: { contains: q, mode: "insensitive" } } },
        { customer: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          customer: true,
          creator: {
            select: { id: true, name: true, email: true, role: true },
          },
          rooms: {
            include: {
              room: {
                select: {
                  id: true,
                  roomNo: true,
                  displayName: true,
                  building: { select: { name: true } },
                  floor: { select: { floorNo: true, name: true } },
                },
              },
              roomCategory: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      prisma.reservation.count({ where }),
    ]);

    return {
      reservations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves single reservation by ID with full allocations, customer, and creator.
   */
  static async getReservationById(id: string) {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        customer: true,
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
        rooms: {
          include: {
            room: {
              include: {
                building: true,
                floor: true,
              },
            },
            roomCategory: true,
          },
          orderBy: { arrivalDate: "asc" },
        },
      },
    });

    if (!reservation) {
      throw new Error("Reservation not found");
    }

    return reservation;
  }
}
