export interface CreatePropertyInput {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string;
}

export interface UpdatePropertyInput {
  name?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string;
}

export interface CreateBuildingInput {
  propertyId: string;
  name: string;
  description?: string | null;
}

export interface CreateFloorInput {
  buildingId: string;
  floorNo: number;
  name?: string | null;
}
