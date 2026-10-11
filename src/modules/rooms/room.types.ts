import { RoomStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export { RoomStatus };

export interface CreateCategoryInput {
  propertyId?: string | null;
  name: string;
  description?: string | null;
  basePrice: number | string | Decimal;
  maxOccupancy: number;
  amenityIds?: string[];
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  basePrice?: number | string | Decimal;
  maxOccupancy?: number;
  amenityIds?: string[];
}

export interface CreateAmenityInput {
  name: string;
  description?: string | null;
}

export interface CreateRoomInput {
  propertyId: string;
  buildingId: string;
  floorId: string;
  roomCategoryId: string;
  roomNo: string;
  displayName?: string | null;
  capacity: number;
  status?: RoomStatus;
  priceOverride?: number | string | Decimal | null;
  notes?: string | null;
}

export interface UpdateRoomInput {
  propertyId?: string;
  buildingId?: string;
  floorId?: string;
  roomCategoryId?: string;
  roomNo?: string;
  displayName?: string | null;
  capacity?: number;
  priceOverride?: number | string | Decimal | null;
  notes?: string | null;
}

export interface UpdateRoomStatusInput {
  status: RoomStatus;
  notes?: string | null;
}

export interface RoomFilterOptions {
  propertyId?: string;
  buildingId?: string;
  floorId?: string;
  roomCategoryId?: string;
  status?: RoomStatus;
  search?: string;
}
