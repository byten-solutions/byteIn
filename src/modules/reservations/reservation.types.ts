import { ReservationStatus, AllocationStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { CreateCustomerInput } from "../customers/customer.types";

export { ReservationStatus, AllocationStatus };

export interface CheckAvailabilityInput {
  arrivalDate: string | Date;
  departureDate: string | Date;
  propertyId?: string;
  roomCategoryId?: string;
  minCapacity?: number;
}

export interface RoomAllocationInput {
  roomId: string;
  roomCategoryId?: string;
  arrivalDate: string | Date;
  departureDate: string | Date;
  bookedNightlyRate?: number | string | Decimal;
  adults?: number;
  children?: number;
}

export interface CreateReservationInput {
  customerId?: string;
  newCustomer?: CreateCustomerInput;
  specialRequests?: string | null;
  allocations: RoomAllocationInput[];
}

export interface ReservationFilterOptions {
  search?: string;
  status?: ReservationStatus;
  page?: number;
  limit?: number;
}

export interface AvailableRoomResult {
  id: string;
  roomNo: string;
  displayName: string | null;
  capacity: number;
  status: string;
  building: {
    id: string;
    name: string;
  };
  floor: {
    id: string;
    floorNo: number;
    name: string | null;
  };
  category: {
    id: string;
    name: string;
    basePrice: Decimal;
    maxOccupancy: number;
    amenities: {
      amenity: {
        id: string;
        name: string;
      };
    }[];
  };
  effectiveRate: Decimal;
}
