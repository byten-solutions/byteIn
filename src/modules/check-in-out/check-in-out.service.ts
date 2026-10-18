import {
  AllocationStatus,
  RoomStatus,
  ReservationStatus,
  InvoiceStatus,
  InvoiceItemType,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BillingService } from "../billing/billing.service";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { getHotelTodayDateUtc } from "@/lib/date";
import {
  EARLY_CHECKIN_POLICY,
  BACKDATED_CHECKOUT_POLICY,
} from "@/config/reservations";
import { RoleName } from "@/modules/auth/auth.types";
import type {
  CheckInInput,
  CheckOutInput,
  CheckInResult,
  CheckOutResult,
} from "./check-in-out.types";

export class CheckInOutService {
  /**
   * Executes atomic check-in for an individual room allocation.
   * Prerequisites:
   * 1. Allocation must exist in CONFIRMED status.
   * 2. Physical room operational status must be strictly VACANT_CLEAN.
   * Atomic operations:
   * 1. Room status transitions to OCCUPIED.
   * 2. Allocation status transitions to CHECKED_IN with checkedInAt timestamp.
   * 3. Optional guest ID proof verification update.
   * 4. AuditLog recorded with staff attribution.
   */
  static async checkIn(
    input: CheckInInput,
    staffUserId: string,
    propertyId?: string
  ): Promise<CheckInResult> {
    const result = await prisma.$transaction(async (tx) => {
      // 0. Acquire row-level lock on the allocation to serialize concurrent check-in/out requests
      await tx.$queryRaw`SELECT "id" FROM "reservation_rooms" WHERE "id" = ${input.allocationId} FOR UPDATE`;

      // 1. Fetch allocation with associated reservation, customer, and room
      const allocation = await tx.reservationRoom.findUnique({
        where: { id: input.allocationId },
        include: {
          reservation: {
            include: { customer: true },
          },
          room: true,
        },
      });

      if (!allocation) {
        throw new NotFoundError("Room allocation not found");
      }

      if (propertyId && allocation.room.propertyId !== propertyId) {
        throw new NotFoundError("Room allocation not found");
      }

      // 2. Validate reservation state
      if (allocation.reservation.status === ReservationStatus.CANCELLED) {
        throw new BadRequestError("Cannot check in allocation for a cancelled reservation");
      }

      // 3. Validate allocation state
      if (allocation.status === AllocationStatus.CHECKED_IN) {
        throw new ConflictError("Room allocation is already checked in");
      }
      if (allocation.status === AllocationStatus.CHECKED_OUT) {
        throw new BadRequestError("Room allocation has already been checked out");
      }
      if (allocation.status === AllocationStatus.CANCELLED) {
        throw new BadRequestError("Room allocation is cancelled");
      }
      if (allocation.status !== AllocationStatus.CONFIRMED) {
        throw new BadRequestError(
          `Cannot check in allocation in ${allocation.status} status`
        );
      }

      // 3.1 Validate scheduled arrival date against hotel today
      const hotelToday = getHotelTodayDateUtc();
      if (hotelToday.getTime() < allocation.arrivalDate.getTime()) {
        if (EARLY_CHECKIN_POLICY === "BLOCK") {
          throw new BadRequestError(
            `Cannot check in prior to scheduled arrival date (${allocation.arrivalDate.toISOString().split("T")[0]}). Early check-in is restricted by hotel policy.`
          );
        }
        if (EARLY_CHECKIN_POLICY === "ALLOW_WITH_ARRIVAL_UPDATE") {
          // Check target room is free from hotelToday until scheduled arrivalDate
          const conflicts = await tx.reservationRoom.findMany({
            where: {
              roomId: allocation.roomId,
              id: { not: allocation.id },
              status: { in: [AllocationStatus.CONFIRMED, AllocationStatus.CHECKED_IN] },
              arrivalDate: { lt: allocation.arrivalDate },
              departureDate: { gt: hotelToday },
            },
          });
          if (conflicts.length > 0) {
            throw new BadRequestError(
              `Cannot check in early: Room ${allocation.room.roomNo} is booked by another reservation prior to ${allocation.arrivalDate.toISOString().split("T")[0]}.`
            );
          }

          // Bill extra night(s) on active invoice
          const extraNights = Math.round(
            (allocation.arrivalDate.getTime() - hotelToday.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (extraNights > 0) {
            const activeInvoice = await tx.invoice.findFirst({
              where: {
                reservationId: allocation.reservationId,
                status: { not: InvoiceStatus.VOID },
              },
            });
            if (activeInvoice) {
              const extraCharge = allocation.bookedNightlyRate.mul(extraNights);
              await tx.invoiceItem.create({
                data: {
                  invoiceId: activeInvoice.id,
                  reservationRoomId: allocation.id,
                  description: `Early Check-in Extra Charge: Room ${allocation.room.roomNo} (${extraNights} extra night(s) from ${hotelToday.toISOString().split("T")[0]})`,
                  quantity: new Prisma.Decimal(extraNights),
                  unitPrice: allocation.bookedNightlyRate,
                  lineTotal: extraCharge,
                  itemType: InvoiceItemType.ROOM_CHARGE,
                },
              });
              const newSubtotal = activeInvoice.subtotal.add(extraCharge);
              const newGrandTotal = activeInvoice.grandTotal.add(extraCharge);
              await tx.invoice.update({
                where: { id: activeInvoice.id },
                data: {
                  subtotal: newSubtotal,
                  grandTotal: newGrandTotal,
                  status:
                    activeInvoice.status === InvoiceStatus.PAID
                      ? InvoiceStatus.PARTIALLY_PAID
                      : activeInvoice.status,
                },
              });
            }

            // Update arrivalDate to hotelToday
            await tx.reservationRoom.update({
              where: { id: allocation.id },
              data: { arrivalDate: hotelToday },
            });
            allocation.arrivalDate = hotelToday;
          }
        }
      }

      // 4. Validate physical room operational state
      const currentRoomStatus = allocation.room.status;
      if (currentRoomStatus !== RoomStatus.VACANT_CLEAN) {
        if (currentRoomStatus === RoomStatus.VACANT_DIRTY) {
          throw new Error(
            `Cannot check in: Room ${allocation.room.roomNo} is currently VACANT_DIRTY. It must be cleaned and inspected first.`
          );
        }
        if (currentRoomStatus === RoomStatus.OCCUPIED) {
          throw new Error(
            `Cannot check in: Room ${allocation.room.roomNo} is currently OCCUPIED.`
          );
        }
        if (currentRoomStatus === RoomStatus.MAINTENANCE) {
          throw new Error(
            `Cannot check in: Room ${allocation.room.roomNo} is currently under MAINTENANCE.`
          );
        }
        if (currentRoomStatus === RoomStatus.OUT_OF_SERVICE) {
          throw new Error(
            `Cannot check in: Room ${allocation.room.roomNo} is currently OUT_OF_SERVICE.`
          );
        }
        throw new Error(
          `Cannot check in: Room ${allocation.room.roomNo} has invalid status ${currentRoomStatus}`
        );
      }

      const now = new Date();

      // 5. Update physical room to OCCUPIED
      const updatedRoom = await tx.room.update({
        where: { id: allocation.roomId },
        data: {
          status: RoomStatus.OCCUPIED,
        },
      });

      // 6. Update allocation to CHECKED_IN
      const updatedAllocation = await tx.reservationRoom.update({
        where: { id: allocation.id },
        data: {
          status: AllocationStatus.CHECKED_IN,
          checkedInAt: now,
        },
      });

      // 7. Update guest ID verification details if provided (store only last 4)
      if (input.verifiedIdNumber && input.verifiedIdNumber.trim()) {
        const last4 = input.verifiedIdNumber.trim().replace(/^[•\s*]+/, "").slice(-4);
        await tx.customer.update({
          where: { id: allocation.reservation.customerId },
          data: {
            idProofNumber: last4,
            ...(input.verifiedIdType?.trim()
              ? { idProofType: input.verifiedIdType.trim() }
              : {}),
          },
        });
      }

      // 8. Record Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          entityType: "ReservationRoom",
          entityId: allocation.id,
          action: "ROOM_CHECKED_IN",
          oldData: {
            allocationStatus: allocation.status,
            roomStatus: currentRoomStatus,
          },
          newData: {
            allocationStatus: updatedAllocation.status,
            roomStatus: updatedRoom.status,
            checkedInAt: now.toISOString(),
            roomNo: allocation.room.roomNo,
            reservationNo: allocation.reservation.reservationNo,
            notes: input.notes?.trim() || null,
          },
        },
      });

      return {
        allocationId: updatedAllocation.id,
        roomId: updatedRoom.id,
        roomNo: updatedRoom.roomNo,
        allocationStatus: updatedAllocation.status,
        roomStatus: updatedRoom.status,
        checkedInAt: now,
        reservationId: allocation.reservationId,
        reservationStatus: allocation.reservation.status,
      };
    });
    BillingService.invalidateBillingCache();
    return result;
  }

  /**
   * Executes atomic check-out for an individual room allocation.
   * Prerequisites:
   * 1. Allocation must exist in CHECKED_IN status.
   * Atomic operations:
   * 1. Room status transitions to VACANT_DIRTY (strict invariant).
   * 2. Allocation status transitions to CHECKED_OUT with checkedOutAt timestamp.
   * 3. Checks reservation lifecycle: if all allocations are completed, sets Reservation.status = COMPLETED.
   * 4. AuditLog recorded with staff attribution.
   */
  static async checkOut(
    input: CheckOutInput,
    staffUserId: string,
    propertyId?: string
  ): Promise<CheckOutResult> {
    const result = await prisma.$transaction(async (tx) => {
      // 0. Acquire row-level lock on the allocation to serialize concurrent check-out requests
      await tx.$queryRaw`SELECT "id" FROM "reservation_rooms" WHERE "id" = ${input.allocationId} FOR UPDATE`;

      // 1. Fetch allocation with associated reservation (including all sibling allocations) and room
      const allocation = await tx.reservationRoom.findUnique({
        where: { id: input.allocationId },
        include: {
          reservation: {
            include: {
              rooms: true,
            },
          },
          room: true,
        },
      });

      if (!allocation) {
        throw new NotFoundError("Room allocation not found");
      }

      if (propertyId && allocation.room.propertyId !== propertyId) {
        throw new NotFoundError("Room allocation not found");
      }

      // 2. Validate allocation state
      if (allocation.status === AllocationStatus.CONFIRMED) {
        throw new BadRequestError(
          "Cannot check out allocation that has not been checked in"
        );
      }
      if (allocation.status === AllocationStatus.CHECKED_OUT) {
        throw new ConflictError("Room allocation has already been checked out");
      }
      if (allocation.status === AllocationStatus.CANCELLED) {
        throw new BadRequestError("Room allocation is cancelled");
      }
      if (allocation.status !== AllocationStatus.CHECKED_IN) {
        throw new BadRequestError(
          `Cannot check out allocation in ${allocation.status} status`
        );
      }

      const now = new Date();

      // 3. Update physical room to VACANT_DIRTY (strict PMS invariant)
      const updatedRoom = await tx.room.update({
        where: { id: allocation.roomId },
        data: {
          status: RoomStatus.VACANT_DIRTY,
        },
      });

      // 4. Update allocation to CHECKED_OUT with actualCheckoutDate
      const actualDate = getHotelTodayDateUtc();
      if (actualDate.getTime() < allocation.arrivalDate.getTime()) {
        if (BACKDATED_CHECKOUT_POLICY === "ADMIN_ONLY") {
          const caller = await tx.user.findUnique({
            where: { id: staffUserId },
            include: { role: true },
          });
          if (
            caller?.role.name !== RoleName.ADMIN &&
            caller?.role.name !== RoleName.SUPER_ADMIN
          ) {
            throw new BadRequestError(
              `Cannot check out prior to scheduled arrival date (${allocation.arrivalDate.toISOString().split("T")[0]}). Backdated checkout requires Administrator privileges.`
            );
          }
        } else if (BACKDATED_CHECKOUT_POLICY === "DISALLOW") {
          throw new BadRequestError(
            `Cannot check out prior to scheduled arrival date (${allocation.arrivalDate.toISOString().split("T")[0]}).`
          );
        }
      }

      const updatedAllocation = await tx.reservationRoom.update({
        where: { id: allocation.id },
        data: {
          status: AllocationStatus.CHECKED_OUT,
          checkedOutAt: now,
          actualCheckoutDate: actualDate,
        },
      });

      // 4.1 Early checkout invoice adjustment: adds adjustment line, never mutates existing lines, never reduces total below paid
      if (actualDate.getTime() < allocation.departureDate.getTime()) {
        const activeInvoice = await tx.invoice.findFirst({
          where: {
            reservationId: allocation.reservationId,
            status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID] },
          },
          include: {
            payments: { where: { status: PaymentStatus.RECORDED } },
            items: true,
          },
        });

        if (activeInvoice) {
          const departureMs = allocation.departureDate.getTime();
          const actualCheckoutMs = Math.max(allocation.arrivalDate.getTime(), actualDate.getTime());
          const unusedNights = Math.max(
            0,
            Math.round((departureMs - actualCheckoutMs) / (24 * 60 * 60 * 1000))
          );

          if (unusedNights > 0) {
            const bookedRate = new Prisma.Decimal(allocation.bookedNightlyRate);
            const nominalReduction = bookedRate.mul(unusedNights);

            const totalPaid = activeInvoice.payments.reduce(
              (sum, p) => sum.add(p.amount),
              new Prisma.Decimal(0)
            );

            // Invariant: never reduce total below paid
            const maxReduction = Prisma.Decimal.max(
              new Prisma.Decimal(0),
              activeInvoice.grandTotal.sub(totalPaid)
            );

            const effectiveReduction = Prisma.Decimal.min(nominalReduction, maxReduction);

            if (effectiveReduction.greaterThan(0)) {
              await tx.invoiceItem.create({
                data: {
                  invoiceId: activeInvoice.id,
                  reservationRoomId: allocation.id,
                  description: `Early Checkout Adjustment: Room ${allocation.room.roomNo} (${unusedNights} unused night(s) credited)`,
                  quantity: new Prisma.Decimal(1),
                  unitPrice: effectiveReduction.negated(),
                  lineTotal: effectiveReduction.negated(),
                  itemType: InvoiceItemType.ADJUSTMENT,
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
                totalPaid,
                newSubtotal.sub(activeInvoice.discountTotal).add(activeInvoice.taxTotal)
              );

              let newStatus = activeInvoice.status;
              if (totalPaid.greaterThanOrEqualTo(newGrandTotal)) {
                newStatus = InvoiceStatus.PAID;
              } else if (totalPaid.greaterThan(0)) {
                newStatus = InvoiceStatus.PARTIALLY_PAID;
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
      }

      // 5. Check if all room allocations in this reservation have now reached terminal state
      const siblingAllocations = allocation.reservation.rooms;
      const allOthersTerminal = siblingAllocations
        .filter((r) => r.id !== allocation.id)
        .every(
          (r) =>
            r.status === AllocationStatus.CHECKED_OUT ||
            r.status === AllocationStatus.CANCELLED ||
            r.status === AllocationStatus.NO_SHOW
        );

      let reservationStatus = allocation.reservation.status;
      if (allOthersTerminal) {
        await tx.reservation.update({
          where: { id: allocation.reservationId },
          data: {
            status: ReservationStatus.COMPLETED,
          },
        });
        reservationStatus = ReservationStatus.COMPLETED;
      }

      // 6. Record Audit Log
      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          entityType: "ReservationRoom",
          entityId: allocation.id,
          action: "ROOM_CHECKED_OUT",
          oldData: {
            allocationStatus: allocation.status,
            roomStatus: allocation.room.status,
          },
          newData: {
            allocationStatus: updatedAllocation.status,
            roomStatus: updatedRoom.status,
            checkedOutAt: now.toISOString(),
            roomNo: allocation.room.roomNo,
            reservationNo: allocation.reservation.reservationNo,
            reservationCompleted: allOthersTerminal,
            notes: input.notes?.trim() || null,
          },
        },
      });

      return {
        allocationId: updatedAllocation.id,
        roomId: updatedRoom.id,
        roomNo: updatedRoom.roomNo,
        allocationStatus: updatedAllocation.status,
        roomStatus: updatedRoom.status,
        checkedOutAt: now,
        reservationId: allocation.reservationId,
        reservationStatus,
      };
    });
    BillingService.invalidateBillingCache();
    return result;
  }

  /**
   * Retrieves today's arrivals (CONFIRMED allocations scheduled for today) in hotel operating timezone
   */
  static async getDailyArrivals(targetDate?: Date, propertyId?: string) {
    const startOfDay = getHotelTodayDateUtc(targetDate);

    return prisma.reservationRoom.findMany({
      where: {
        arrivalDate: startOfDay,
        status: AllocationStatus.CONFIRMED,
        ...(propertyId ? { room: { propertyId } } : {}),
      },
      include: {
        reservation: {
          include: { customer: true },
        },
        room: {
          include: { building: true, floor: true },
        },
        roomCategory: true,
      },
      orderBy: [{ room: { roomNo: "asc" } }],
    });
  }

  /**
   * Retrieves today's departures (CHECKED_IN allocations scheduled for checkout today) in hotel operating timezone
   */
  static async getDailyDepartures(targetDate?: Date, propertyId?: string) {
    const startOfDay = getHotelTodayDateUtc(targetDate);

    return prisma.reservationRoom.findMany({
      where: {
        departureDate: startOfDay,
        status: AllocationStatus.CHECKED_IN,
        ...(propertyId ? { room: { propertyId } } : {}),
      },
      include: {
        reservation: {
          include: { customer: true },
        },
        room: {
          include: { building: true, floor: true },
        },
        roomCategory: true,
      },
      orderBy: [{ room: { roomNo: "asc" } }],
    });
  }
}

