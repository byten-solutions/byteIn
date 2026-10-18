import crypto from "crypto";
import { unstable_cache, revalidateTag } from "next/cache";
import {
  Prisma,
  RoomStatus,
  AllocationStatus,
  ReservationStatus,
  InvoiceStatus,
  InvoiceItemType,
  PaymentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BillingService } from "../billing/billing.service";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { sanitizePagination } from "@/lib/pagination";
import { getHotelTodayDateUtc } from "@/lib/date";
import { RoleName } from "@/modules/auth/auth.types";
import {
  normalizeIdProofNumber,
  maskIdProofNumber,
} from "@/modules/customers/customer.service";
import {
  ROOM_CHANGE_RATE_POLICY,
  AUTO_CANCEL_RESERVATION_WHEN_ALL_ALLOCATIONS_CANCELLED,
  NO_SHOW_BILLING_POLICY,
  NO_SHOW_MIN_DATE_POLICY,
  CANCEL_WITH_PAYMENTS_POLICY,
  ADMIN_CANCEL_WITH_PAYMENTS_INVOICE_STATE,
} from "@/config/reservations";
import type {
  CheckAvailabilityInput,
  CreateReservationInput,
  ReservationFilterOptions,
  AvailableRoomResult,
  ExtendStayInput,
  ChangeRoomInput,
} from "./reservation.types";
import { normalizeDate } from "./reservation.validation";

export class ReservationConflictError extends ConflictError {
  constructor(message: string) {
    super(message);
    this.name = "ReservationConflictError";
  }
}

export class ReservationService {
  /**
   * Invalidation helper for reservation counts.
   */
  public static invalidateReservationCache(): void {
    try {
      revalidateTag("reservation-count", "max");
    } catch {
      // Ignore outside Next.js request context (e.g. tests or worker tasks)
    }
  }

  /**
   * Cached count for unfiltered reservation list queries.
   */
  public static async getUnfilteredReservationCount(): Promise<number> {
    const fetchCount = () => prisma.reservation.count();
    try {
      const cached = unstable_cache(fetchCount, ["reservation-unfiltered-count"], {
        tags: ["reservation-count"],
        revalidate: 60,
      });
      return await cached();
    } catch {
      return fetchCount();
    }
  }

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
    creatorUserId: string,
    options?: { autoCreateInvoice?: boolean }
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
      const result = await prisma.$transaction(
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
                idProofNumber: normalizeIdProofNumber(input.newCustomer.idProofNumber),
                remarks: input.newCustomer.remarks?.trim() || null,
              },
            });
            customerId = customer.id;
          } else if (customerId) {
            const customer = await tx.customer.findUnique({
              where: { id: customerId },
            });
            if (!customer) {
              throw new NotFoundError("Customer not found");
            }
          } else {
            throw new BadRequestError(
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
            throw new NotFoundError("One or more selected rooms do not exist");
          }

          const roomMap = new Map(rooms.map((r) => [r.id, r]));

          for (const room of rooms) {
            if (
              room.status === RoomStatus.MAINTENANCE ||
              room.status === RoomStatus.OUT_OF_SERVICE
            ) {
              throw new BadRequestError(
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

          // Validate rate overrides against base price
          for (const alloc of normalizedAllocations) {
            const room = roomMap.get(alloc.roomId)!;
            if (alloc.bookedNightlyRate !== undefined && alloc.bookedNightlyRate !== null) {
              const rateDecimal = new Prisma.Decimal(alloc.bookedNightlyRate.toString());
              if (rateDecimal.lessThan(room.category.basePrice)) {
                if (!alloc.rateOverrideReason || alloc.rateOverrideReason.trim().length < 3) {
                  throw new BadRequestError(
                    `Room ${room.roomNo} nightly rate of ${rateDecimal.toFixed(2)} is below category base price of ${new Prisma.Decimal(room.category.basePrice).toFixed(2)}. A rateOverrideReason of at least 3 characters is required.`
                  );
                }
              }
            }
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

          // Record audit log for any below-base-price rate overrides
          for (const alloc of normalizedAllocations) {
            const room = roomMap.get(alloc.roomId)!;
            if (alloc.bookedNightlyRate !== undefined && alloc.bookedNightlyRate !== null) {
              const rateDecimal = new Prisma.Decimal(alloc.bookedNightlyRate.toString());
              if (rateDecimal.lessThan(room.category.basePrice)) {
                await tx.auditLog.create({
                  data: {
                    userId: creatorUserId,
                    entityType: "Reservation",
                    entityId: createdReservation.id,
                    action: "RATE_OVERRIDE",
                    newData: {
                      reservationNo: createdReservation.reservationNo,
                      roomNo: room.roomNo,
                      categoryName: room.category.name,
                      basePrice: room.category.basePrice.toString(),
                      overrideRate: rateDecimal.toString(),
                      reason: alloc.rateOverrideReason!.trim(),
                    },
                  },
                });
              }
            }
          }

          // 8. Auto-provision initial itemized invoice if requested
          const shouldCreateInvoice =
            input.autoCreateInvoice ?? options?.autoCreateInvoice ?? false;
          if (shouldCreateInvoice) {
            let invoiceNumber = BillingService.generateInvoiceNumber();
            let invExists = await tx.invoice.findUnique({
              where: { invoiceNumber },
            });
            while (invExists) {
              invoiceNumber = BillingService.generateInvoiceNumber();
              invExists = await tx.invoice.findUnique({
                where: { invoiceNumber },
              });
            }

            let subtotal = new Prisma.Decimal(0);
            const itemsToCreate: Array<{
              reservationRoomId: string;
              description: string;
              quantity: Prisma.Decimal;
              unitPrice: Prisma.Decimal;
              lineTotal: Prisma.Decimal;
              itemType: InvoiceItemType;
            }> = [];

            for (const alloc of createdReservation.rooms) {
              const diffMs = alloc.departureDate.getTime() - alloc.arrivalDate.getTime();
              const nights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
              const unitPrice = new Prisma.Decimal(alloc.bookedNightlyRate.toString());
              const lineTotal = unitPrice.mul(nights);
              subtotal = subtotal.add(lineTotal);

              const arrStr = alloc.arrivalDate.toISOString().split("T")[0];
              const depStr = alloc.departureDate.toISOString().split("T")[0];
              const desc = `Room ${alloc.room.roomNo} (${alloc.roomCategory.name}) — ${nights} night${nights === 1 ? "" : "s"} (${arrStr} to ${depStr})`;

              itemsToCreate.push({
                reservationRoomId: alloc.id,
                description: desc,
                quantity: new Prisma.Decimal(nights),
                unitPrice,
                lineTotal,
                itemType: InvoiceItemType.ROOM_CHARGE,
              });
            }

            const grandTotal = subtotal;

            const invoice = await tx.invoice.create({
              data: {
                reservationId: createdReservation.id,
                invoiceNumber,
                subtotal,
                discountTotal: new Prisma.Decimal(0),
                taxTotal: new Prisma.Decimal(0),
                grandTotal,
                status: InvoiceStatus.DRAFT,
                items: {
                  create: itemsToCreate,
                },
              },
            });

            await tx.auditLog.create({
              data: {
                userId: creatorUserId,
                entityType: "Invoice",
                entityId: invoice.id,
                action: "INVOICE_CREATED",
                newData: {
                  invoiceNumber: invoice.invoiceNumber,
                  reservationId: createdReservation.id,
                  grandTotal: invoice.grandTotal.toString(),
                  status: invoice.status,
                  itemCount: itemsToCreate.length,
                  source: "AUTO_RESERVATION_CREATION",
                },
              },
            });
          }

          return createdReservation;
        },
        {
          timeout: 15000,
        }
      );
      this.invalidateReservationCache();
      BillingService.invalidateBillingCache();
      return result;
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
    const { search, status } = options;
    const { page, limit, skip } = sanitizePagination(options.page, options.limit, 20);

    const where: Prisma.ReservationWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search && search.trim() !== "") {
      const q = search.trim();
      if (q.length >= 3) {
        // Use trigram index on customers first to avoid cross-table join filter
        const matchingCustomers = await prisma.customer.findMany({
          where: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true },
          take: 500,
        });

        const customerIds = matchingCustomers.map((c) => c.id);

        where.OR = [
          { reservationNo: { contains: q, mode: "insensitive" } },
          ...(customerIds.length > 0 ? [{ customerId: { in: customerIds } }] : []),
        ];
      }
    }

    const hasFilter = Boolean(status || (search && search.trim() !== ""));

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
      hasFilter ? prisma.reservation.count({ where }) : this.getUnfilteredReservationCount(),
    ]);

    return {
      reservations: reservations.map((r) => ({
        ...r,
        customer: r.customer
          ? {
              ...r.customer,
              idProofNumber: maskIdProofNumber(r.customer.idProofNumber),
            }
          : r.customer,
      })),
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
      throw new NotFoundError("Reservation not found");
    }

    return {
      ...reservation,
      customer: reservation.customer
        ? {
            ...reservation.customer,
            idProofNumber: maskIdProofNumber(reservation.customer.idProofNumber),
          }
        : reservation.customer,
    };
  }

  /**
   * Cancels an entire reservation and all its non-terminal (CONFIRMED) allocations.
   * Rejects if reservation has active checked-in allocations.
   */
  static async cancelReservation(
    id: string,
    userId: string,
    reason?: string,
    userRole?: string
  ) {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        rooms: true,
        invoices: {
          include: {
            payments: { where: { status: PaymentStatus.RECORDED } },
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundError("Reservation not found");
    }

    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new BadRequestError("Reservation is already cancelled");
    }

    const hasCheckedIn = reservation.rooms.some(
      (r) => r.status === AllocationStatus.CHECKED_IN
    );
    if (hasCheckedIn) {
      throw new BadRequestError(
        "Cannot cancel reservation with active checked-in guests. Complete check-out first."
      );
    }

    // Policy check: Cancelling with recorded payments requires void/refund or ADMIN
    const recordedPaymentsCount = (reservation.invoices || []).reduce(
      (sum, inv) => sum + (inv.payments?.length || 0),
      0
    );

    if (
      recordedPaymentsCount > 0 &&
      CANCEL_WITH_PAYMENTS_POLICY === "REQUIRE_VOID_OR_ADMIN"
    ) {
      let role = userRole;
      if (!role) {
        const caller = await prisma.user.findUnique({
          where: { id: userId },
          include: { role: true },
        });
        role = caller?.role.name;
      }
      if (role !== RoleName.ADMIN) {
        throw new BadRequestError(
          "Cannot cancel reservation with recorded payments. Please void or refund the payments first, or request an Administrator."
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Cancel all CONFIRMED allocations
      await tx.reservationRoom.updateMany({
        where: {
          reservationId: id,
          status: AllocationStatus.CONFIRMED,
        },
        data: {
          status: AllocationStatus.CANCELLED,
        },
      });

      // 2. Void invoices if no recorded payments exist
      if (recordedPaymentsCount === 0) {
        await tx.invoice.updateMany({
          where: {
            reservationId: id,
            status: { not: InvoiceStatus.VOID },
          },
          data: {
            status: InvoiceStatus.VOID,
          },
        });
      } else if (
        ADMIN_CANCEL_WITH_PAYMENTS_INVOICE_STATE === "VOID_INVOICE_AND_PAYMENTS"
      ) {
        await tx.invoice.updateMany({
          where: {
            reservationId: id,
            status: { not: InvoiceStatus.VOID },
          },
          data: {
            status: InvoiceStatus.VOID,
          },
        });
        const invIds = (reservation.invoices || []).map((i) => i.id);
        await tx.payment.updateMany({
          where: {
            invoiceId: { in: invIds },
            status: PaymentStatus.RECORDED,
          },
          data: {
            status: PaymentStatus.VOIDED,
          },
        });
      }
      // If RETAIN_AS_CREDIT_BALANCE (default): invoice and payments remain intact as customer credit.

      // 3. Update reservation status
      const updatedRes = await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.CANCELLED,
        },
        include: {
          rooms: true,
          customer: true,
        },
      });

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          userId,
          entityType: "Reservation",
          entityId: id,
          action: "RESERVATION_CANCELLED",
          oldData: { status: reservation.status },
          newData: {
            status: ReservationStatus.CANCELLED,
            reason: reason || null,
            hadRecordedPayments: recordedPaymentsCount > 0,
          },
        },
      });

      return updatedRes;
    });
    this.invalidateReservationCache();
    BillingService.invalidateBillingCache();
    return result;
  }

  /**
   * Cancels a single room allocation.
   * If all allocations on the reservation become cancelled/no-show, the parent reservation is marked CANCELLED.
   */
  static async cancelAllocation(
    allocationId: string,
    userId: string,
    reason?: string
  ) {
    const allocation = await prisma.reservationRoom.findUnique({
      where: { id: allocationId },
      include: { reservation: { include: { rooms: true } } },
    });

    if (!allocation) {
      throw new NotFoundError("Room allocation not found");
    }

    if (allocation.status === AllocationStatus.CANCELLED) {
      throw new BadRequestError("Room allocation is already cancelled");
    }

    if (allocation.status === AllocationStatus.CHECKED_IN) {
      throw new BadRequestError(
        "Cannot cancel an active checked-in allocation. Complete check-out instead."
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Cancel allocation
      const updatedAlloc = await tx.reservationRoom.update({
        where: { id: allocationId },
        data: {
          status: AllocationStatus.CANCELLED,
        },
      });

      // 2. Audit log
      await tx.auditLog.create({
        data: {
          userId,
          entityType: "ReservationRoom",
          entityId: allocationId,
          action: "ALLOCATION_CANCELLED",
          oldData: { status: allocation.status },
          newData: { status: AllocationStatus.CANCELLED, reason: reason || null },
        },
      });

      // 3. Check if all sibling allocations are now non-active
      if (AUTO_CANCEL_RESERVATION_WHEN_ALL_ALLOCATIONS_CANCELLED) {
        const siblings = await tx.reservationRoom.findMany({
          where: { reservationId: allocation.reservationId },
        });
        const allCancelledOrNoShow = siblings.every(
          (r) =>
            r.status === AllocationStatus.CANCELLED ||
            r.status === AllocationStatus.NO_SHOW
        );
        if (allCancelledOrNoShow) {
          await tx.reservation.update({
            where: { id: allocation.reservationId },
            data: { status: ReservationStatus.CANCELLED },
          });
        }
      }

      return updatedAlloc;
    });
    this.invalidateReservationCache();
    BillingService.invalidateBillingCache();
    return result;
  }

  /**
   * Marks a CONFIRMED allocation as NO_SHOW.
   * Immediately releases the physical room from Postgres exclusion constraint.
   */
  static async markNoShow(
    allocationId: string,
    userId: string,
    notes?: string
  ) {
    const allocation = await prisma.reservationRoom.findUnique({
      where: { id: allocationId },
      include: { reservation: true },
    });

    if (!allocation) {
      throw new NotFoundError("Room allocation not found");
    }

    if (allocation.status !== AllocationStatus.CONFIRMED) {
      throw new BadRequestError(
        `Only CONFIRMED allocations can be marked as NO_SHOW. Current status: ${allocation.status}`
      );
    }

    // Date policy check: NO_SHOW only allowed on/after arrival date
    const hotelToday = getHotelTodayDateUtc();
    if (hotelToday.getTime() < allocation.arrivalDate.getTime()) {
      if (NO_SHOW_MIN_DATE_POLICY === "ON_OR_AFTER_ARRIVAL") {
        throw new BadRequestError(
          `Cannot mark allocation as NO_SHOW prior to its scheduled arrival date (${allocation.arrivalDate.toISOString().split("T")[0]}). Cancel the reservation instead.`
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Transition to NO_SHOW
      const updatedAlloc = await tx.reservationRoom.update({
        where: { id: allocationId },
        data: {
          status: AllocationStatus.NO_SHOW,
        },
      });

      // 2. Billing policy for NO_SHOW (default = RETAIN_FIRST_NIGHT)
      if (NO_SHOW_BILLING_POLICY === "RETAIN_FIRST_NIGHT") {
        const activeInvoice = await tx.invoice.findFirst({
          where: {
            reservationId: allocation.reservationId,
            status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
          },
          include: {
            payments: { where: { status: PaymentStatus.RECORDED } },
            items: true,
          },
        });

        if (activeInvoice) {
          const totalNights = Math.max(
            1,
            Math.round(
              (allocation.departureDate.getTime() - allocation.arrivalDate.getTime()) /
                (24 * 60 * 60 * 1000)
            )
          );

          if (totalNights > 1) {
            const unusedNights = totalNights - 1;
            const bookedRate = new Prisma.Decimal(allocation.bookedNightlyRate);
            const nominalReduction = bookedRate.mul(unusedNights);

            if (activeInvoice.status === InvoiceStatus.DRAFT) {
              const roomItem = activeInvoice.items.find(
                (i) => i.reservationRoomId === allocationId && i.itemType === InvoiceItemType.ROOM_CHARGE
              );
              if (roomItem) {
                await tx.invoiceItem.update({
                  where: { id: roomItem.id },
                  data: {
                    quantity: new Prisma.Decimal(1),
                    lineTotal: bookedRate,
                  },
                });
              }
            } else {
              await tx.invoiceItem.create({
                data: {
                  invoiceId: activeInvoice.id,
                  reservationRoomId: allocation.id,
                  description: `No-Show Adjustment: Room charge reduction (${unusedNights} night(s) waived per 1st night retention policy)`,
                  quantity: new Prisma.Decimal(1),
                  unitPrice: nominalReduction.negated(),
                  lineTotal: nominalReduction.negated(),
                  itemType: InvoiceItemType.ADJUSTMENT,
                },
              });
            }

            const updatedItems = await tx.invoiceItem.findMany({
              where: { invoiceId: activeInvoice.id },
            });
            const newSubtotal = updatedItems.reduce(
              (sum, item) => sum.add(item.lineTotal),
              new Prisma.Decimal(0)
            );
            const newGrandTotal = Prisma.Decimal.max(
              new Prisma.Decimal(0),
              newSubtotal.sub(activeInvoice.discountTotal).add(activeInvoice.taxTotal)
            );

            const totalPaid = activeInvoice.payments.reduce(
              (sum, p) => sum.add(p.amount),
              new Prisma.Decimal(0)
            );

            let newStatus = activeInvoice.status;
            if (activeInvoice.status !== InvoiceStatus.DRAFT) {
              if (totalPaid.greaterThanOrEqualTo(newGrandTotal)) {
                newStatus = InvoiceStatus.PAID;
              } else if (totalPaid.greaterThan(0)) {
                newStatus = InvoiceStatus.PARTIALLY_PAID;
              } else {
                newStatus = InvoiceStatus.ISSUED;
              }
            }

            await tx.invoice.update({
              where: { id: activeInvoice.id },
              data: {
                subtotal: newSubtotal,
                grandTotal: newGrandTotal,
                status: newStatus,
              },
            });
          }
        }
      }

      // 3. Audit log
      await tx.auditLog.create({
        data: {
          userId,
          entityType: "ReservationRoom",
          entityId: allocationId,
          action: "ALLOCATION_NO_SHOW",
          oldData: { status: allocation.status },
          newData: { status: AllocationStatus.NO_SHOW, notes: notes || null },
        },
      });

      // 3. Reconcile parent reservation status
      if (AUTO_CANCEL_RESERVATION_WHEN_ALL_ALLOCATIONS_CANCELLED) {
        const siblings = await tx.reservationRoom.findMany({
          where: { reservationId: allocation.reservationId },
        });
        const allCancelledOrNoShow = siblings.every(
          (r) =>
            r.status === AllocationStatus.CANCELLED ||
            r.status === AllocationStatus.NO_SHOW
        );
        if (allCancelledOrNoShow) {
          await tx.reservation.update({
            where: { id: allocation.reservationId },
            data: { status: ReservationStatus.CANCELLED },
          });
        }
      }

      return updatedAlloc;
    });
    BillingService.invalidateBillingCache();
    return result;
  }

  /**
   * Extends the departure date of an allocation.
   * Checks physical room availability and enforces concurrency locking against collisions.
   */
  static async extendStay(
    allocationId: string,
    input: ExtendStayInput,
    userId: string
  ) {
    const allocation = await prisma.reservationRoom.findUnique({
      where: { id: allocationId },
    });

    if (!allocation) {
      throw new NotFoundError("Room allocation not found");
    }

    if (
      allocation.status !== AllocationStatus.CHECKED_IN &&
      allocation.status !== AllocationStatus.CONFIRMED
    ) {
      throw new BadRequestError(
        `Only CHECKED_IN or CONFIRMED allocations can be extended. Current status: ${allocation.status}`
      );
    }

    const newDep = normalizeDate(input.newDepartureDate);
    if (newDep.getTime() <= allocation.departureDate.getTime()) {
      throw new BadRequestError("New departure date must be strictly after the current departure date");
    }

    const result = await prisma.$transaction(async (tx) => {
      // Check physical room availability between [currentDepartureDate, newDepartureDate)
      const conflictingAllocations = await tx.reservationRoom.findMany({
        where: {
          roomId: allocation.roomId,
          id: { not: allocationId },
          status: { in: [AllocationStatus.CONFIRMED, AllocationStatus.CHECKED_IN] },
          arrivalDate: { lt: newDep },
          departureDate: { gt: allocation.departureDate },
        },
      });

      if (conflictingAllocations.length > 0) {
        throw new ReservationConflictError(
          "Physical room is not available for the requested extension dates due to another scheduled booking"
        );
      }

      const updatedAlloc = await tx.reservationRoom.update({
        where: { id: allocationId },
        data: {
          departureDate: newDep,
        },
      });

      // Reconcile active invoice: extend stay must add extra nights to invoice
      const activeInvoice = await tx.invoice.findFirst({
        where: {
          reservationId: allocation.reservationId,
          status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID] },
        },
        include: {
          payments: { where: { status: PaymentStatus.RECORDED } },
          items: true,
        },
      });

      if (activeInvoice) {
        const extraNights = Math.max(
          1,
          Math.round((newDep.getTime() - allocation.departureDate.getTime()) / (24 * 60 * 60 * 1000))
        );
        const unitPrice = new Prisma.Decimal(allocation.bookedNightlyRate);
        const lineTotal = unitPrice.mul(extraNights);

        const arrStr = allocation.departureDate.toISOString().split("T")[0];
        const depStr = newDep.toISOString().split("T")[0];
        const desc = `Stay Extension: ${extraNights} extra night(s) (${arrStr} to ${depStr})`;

        await tx.invoiceItem.create({
          data: {
            invoiceId: activeInvoice.id,
            reservationRoomId: allocation.id,
            description: desc,
            quantity: new Prisma.Decimal(extraNights),
            unitPrice,
            lineTotal,
            itemType: InvoiceItemType.ROOM_CHARGE,
          },
        });

        const allItems = await tx.invoiceItem.findMany({
          where: { invoiceId: activeInvoice.id },
        });
        const newSubtotal = allItems.reduce(
          (sum, item) => sum.add(item.lineTotal),
          new Prisma.Decimal(0)
        );
        const newGrandTotal = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          newSubtotal.sub(activeInvoice.discountTotal).add(activeInvoice.taxTotal)
        );

        const totalPaid = activeInvoice.payments.reduce(
          (sum, p) => sum.add(p.amount),
          new Prisma.Decimal(0)
        );

        let newStatus = activeInvoice.status;
        if (activeInvoice.status !== InvoiceStatus.DRAFT) {
          if (totalPaid.greaterThanOrEqualTo(newGrandTotal)) {
            newStatus = InvoiceStatus.PAID;
          } else if (totalPaid.greaterThan(0)) {
            newStatus = InvoiceStatus.PARTIALLY_PAID;
          } else {
            newStatus = InvoiceStatus.ISSUED;
          }
        }

        await tx.invoice.update({
          where: { id: activeInvoice.id },
          data: {
            subtotal: newSubtotal,
            grandTotal: newGrandTotal,
            status: newStatus,
          },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          entityType: "ReservationRoom",
          entityId: allocationId,
          action: "STAY_EXTENDED",
          oldData: { departureDate: allocation.departureDate.toISOString() },
          newData: { departureDate: newDep.toISOString(), reason: input.reason || null },
        },
      });

      return updatedAlloc;
    });
    BillingService.invalidateBillingCache();
    return result;
  }

  /**
   * Moves an active allocation to a different physical room.
   * Transitions old room to VACANT_DIRTY and new room to OCCUPIED if checked in.
   */
  static async changeRoom(
    allocationId: string,
    input: ChangeRoomInput,
    userId: string
  ) {
    const allocation = await prisma.reservationRoom.findUnique({
      where: { id: allocationId },
      include: { room: true },
    });

    if (!allocation) {
      throw new NotFoundError("Room allocation not found");
    }

    if (
      allocation.status !== AllocationStatus.CHECKED_IN &&
      allocation.status !== AllocationStatus.CONFIRMED
    ) {
      throw new BadRequestError(
        `Only active allocations can change rooms. Current status: ${allocation.status}`
      );
    }

    if (allocation.roomId === input.newRoomId) {
      throw new BadRequestError("Allocation is already assigned to this room");
    }

    const targetRoom = await prisma.room.findUnique({
      where: { id: input.newRoomId },
      include: { category: true },
    });

    if (!targetRoom) {
      throw new NotFoundError("Target room not found");
    }

    if (
      targetRoom.status === RoomStatus.MAINTENANCE ||
      targetRoom.status === RoomStatus.OUT_OF_SERVICE
    ) {
      throw new ReservationConflictError(
        `Target room is currently in ${targetRoom.status} status and cannot be occupied`
      );
    }

    return await prisma.$transaction(async (tx) => {
      // Determine the date window that must be checked for target room availability
      const checkStart =
        allocation.status === AllocationStatus.CHECKED_IN
          ? getHotelTodayDateUtc()
          : allocation.arrivalDate;
      const checkEnd = allocation.departureDate;

      // Check target room for any overlapping active allocations
      const conflicts = await tx.reservationRoom.findMany({
        where: {
          roomId: input.newRoomId,
          status: { in: [AllocationStatus.CONFIRMED, AllocationStatus.CHECKED_IN] },
          arrivalDate: { lt: checkEnd },
          departureDate: { gt: checkStart },
        },
      });

      if (conflicts.length > 0) {
        throw new ReservationConflictError(
          "Target room is already booked or occupied for the required stay dates"
        );
      }

      // Check physical status of target room if moving a currently checked-in guest
      if (allocation.status === AllocationStatus.CHECKED_IN) {
        const freshTargetRoom = await tx.room.findUnique({
          where: { id: input.newRoomId },
        });
        if (freshTargetRoom && freshTargetRoom.status === RoomStatus.OCCUPIED) {
          throw new ReservationConflictError("Target room is currently occupied");
        }
      }

      // Rate policy
      let bookedRate = allocation.bookedNightlyRate;
      if (ROOM_CHANGE_RATE_POLICY === "APPLY_NEW_RATE") {
        bookedRate = targetRoom.priceOverride || targetRoom.category.basePrice;
      }

      let resultAllocation;

      if (allocation.status === AllocationStatus.CHECKED_IN) {
        const today = getHotelTodayDateUtc();

        // 1. End old allocation today: mark CHECKED_OUT with actualCheckoutDate = today
        await tx.reservationRoom.update({
          where: { id: allocationId },
          data: {
            status: AllocationStatus.CHECKED_OUT,
            actualCheckoutDate: today,
            checkedOutAt: new Date(),
          },
        });

        // 2. Start new allocation in the target room from today to original departureDate
        const newAlloc = await tx.reservationRoom.create({
          data: {
            reservationId: allocation.reservationId,
            roomId: input.newRoomId,
            roomCategoryId: targetRoom.roomCategoryId,
            arrivalDate: today,
            departureDate: allocation.departureDate,
            bookedNightlyRate: bookedRate,
            status: AllocationStatus.CHECKED_IN,
            checkedInAt: new Date(),
          },
          include: {
            room: true,
            roomCategory: true,
          },
        });
        resultAllocation = newAlloc;

        // 3. Physical room status transitions
        await tx.room.update({
          where: { id: allocation.roomId },
          data: { status: RoomStatus.VACANT_DIRTY },
        });

        await tx.room.update({
          where: { id: input.newRoomId },
          data: { status: RoomStatus.OCCUPIED },
        });

        // 4. Audit log
        await tx.auditLog.create({
          data: {
            userId,
            entityType: "ReservationRoom",
            entityId: allocationId,
            action: "ROOM_CHANGED",
            oldData: {
              allocationId,
              roomId: allocation.roomId,
              status: allocation.status,
            },
            newData: {
              newAllocationId: newAlloc.id,
              roomId: input.newRoomId,
              reason: input.reason || null,
            },
          },
        });
      } else {
        // For CONFIRMED allocations: change the room only
        const updatedAlloc = await tx.reservationRoom.update({
          where: { id: allocationId },
          data: {
            roomId: input.newRoomId,
            roomCategoryId: targetRoom.roomCategoryId,
            bookedNightlyRate: bookedRate,
          },
          include: {
            room: true,
            roomCategory: true,
          },
        });
        resultAllocation = updatedAlloc;

        // Audit log
        await tx.auditLog.create({
          data: {
            userId,
            entityType: "ReservationRoom",
            entityId: allocationId,
            action: "ROOM_CHANGED",
            oldData: { roomId: allocation.roomId, status: allocation.status },
            newData: {
              roomId: input.newRoomId,
              reason: input.reason || null,
            },
          },
        });
      }

      return resultAllocation;
    });
  }
}

