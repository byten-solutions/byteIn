import {
  AllocationStatus,
  RoomStatus,
  ReservationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
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
    staffUserId: string
  ): Promise<CheckInResult> {
    return prisma.$transaction(async (tx) => {
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

      // 7. Update guest ID verification details if provided
      if (input.verifiedIdNumber && input.verifiedIdNumber.trim()) {
        await tx.customer.update({
          where: { id: allocation.reservation.customerId },
          data: {
            idProofNumber: input.verifiedIdNumber.trim(),
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
    staffUserId: string
  ): Promise<CheckOutResult> {
    return prisma.$transaction(async (tx) => {
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

      // 4. Update allocation to CHECKED_OUT
      const updatedAllocation = await tx.reservationRoom.update({
        where: { id: allocation.id },
        data: {
          status: AllocationStatus.CHECKED_OUT,
          checkedOutAt: now,
        },
      });

      // 5. Check if all room allocations in this reservation have now reached terminal state
      const siblingAllocations = allocation.reservation.rooms;
      const allOthersTerminal = siblingAllocations
        .filter((r) => r.id !== allocation.id)
        .every(
          (r) =>
            r.status === AllocationStatus.CHECKED_OUT ||
            r.status === AllocationStatus.CANCELLED
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
  }

  /**
   * Retrieves today's arrivals (CONFIRMED allocations scheduled for today)
   */
  static async getDailyArrivals(targetDate: Date = new Date()) {
    const startOfDay = new Date(
      Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate()
      )
    );

    return prisma.reservationRoom.findMany({
      where: {
        arrivalDate: startOfDay,
        status: AllocationStatus.CONFIRMED,
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
   * Retrieves today's departures (CHECKED_IN allocations scheduled for checkout today)
   */
  static async getDailyDepartures(targetDate: Date = new Date()) {
    const startOfDay = new Date(
      Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate()
      )
    );

    return prisma.reservationRoom.findMany({
      where: {
        departureDate: startOfDay,
        status: AllocationStatus.CHECKED_IN,
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
