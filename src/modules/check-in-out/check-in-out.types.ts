import { AllocationStatus, RoomStatus, ReservationStatus } from "@prisma/client";

export { AllocationStatus, RoomStatus, ReservationStatus };

export interface CheckInInput {
  allocationId: string;
  verifiedIdType?: string | null;
  verifiedIdNumber?: string | null;
  notes?: string | null;
}

export interface CheckOutInput {
  allocationId: string;
  notes?: string | null;
}

export interface CheckInResult {
  allocationId: string;
  roomId: string;
  roomNo: string;
  allocationStatus: AllocationStatus;
  roomStatus: RoomStatus;
  checkedInAt: Date;
  reservationId: string;
  reservationStatus: ReservationStatus;
  propertyId?: string;
}

export interface CheckOutResult {
  allocationId: string;
  roomId: string;
  roomNo: string;
  allocationStatus: AllocationStatus;
  roomStatus: RoomStatus;
  checkedOutAt: Date;
  reservationId: string;
  reservationStatus: ReservationStatus;
  propertyId?: string;
}
