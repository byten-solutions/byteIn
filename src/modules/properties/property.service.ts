import { prisma } from "@/lib/prisma";
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
  CreateBuildingInput,
  CreateFloorInput,
} from "./property.types";

export class PropertyService {
  static async createProperty(data: CreatePropertyInput) {
    return prisma.property.create({
      data: {
        name: data.name,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || null,
        phone: data.phone || null,
        email: data.email || null,
        status: data.status || "ACTIVE",
      },
    });
  }

  static async getProperties() {
    return prisma.property.findMany({
      include: {
        buildings: {
          include: {
            floors: {
              orderBy: { floorNo: "asc" },
            },
          },
        },
        _count: {
          select: { rooms: true, roomCategories: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  static async getPropertyById(id: string) {
    return prisma.property.findUnique({
      where: { id },
      include: {
        buildings: {
          include: {
            floors: {
              orderBy: { floorNo: "asc" },
            },
          },
        },
        roomCategories: true,
        _count: {
          select: { rooms: true },
        },
      },
    });
  }

  static async updateProperty(id: string, data: UpdatePropertyInput) {
    const existing = await prisma.property.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Property not found");
    }

    return prisma.property.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  }

  static async createBuilding(input: CreateBuildingInput) {
    const property = await prisma.property.findUnique({
      where: { id: input.propertyId },
    });
    if (!property) {
      throw new Error("Property not found");
    }

    return prisma.building.create({
      data: {
        propertyId: input.propertyId,
        name: input.name,
        description: input.description || null,
      },
    });
  }

  static async getBuildings(propertyId: string) {
    return prisma.building.findMany({
      where: { propertyId },
      include: {
        floors: {
          orderBy: { floorNo: "asc" },
        },
        _count: {
          select: { rooms: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  static async createFloor(input: CreateFloorInput) {
    const building = await prisma.building.findUnique({
      where: { id: input.buildingId },
    });
    if (!building) {
      throw new Error("Building not found");
    }

    return prisma.floor.create({
      data: {
        buildingId: input.buildingId,
        floorNo: input.floorNo,
        name: input.name || null,
      },
    });
  }

  static async getFloors(buildingId: string) {
    return prisma.floor.findMany({
      where: { buildingId },
      include: {
        _count: {
          select: { rooms: true },
        },
      },
      orderBy: { floorNo: "asc" },
    });
  }
}
