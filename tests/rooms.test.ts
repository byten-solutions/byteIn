import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { RoomStatus, RoleName } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  RoomCategoryService,
  AmenityService,
  RoomService,
} from "../src/modules/rooms/room.service";
import {
  createCategorySchema,
  createRoomSchema,
  updateRoomStatusSchema,
} from "../src/modules/rooms/room.validation";
import { enforceRole, AuthError } from "../src/lib/auth-guard";

describe("Phase 2: Room Categories & Physical Rooms Tests", () => {
  let testPropertyId: string;
  let testBuildingId: string;
  let testFloorId: string;
  let testAmenityId: string;
  let testCategoryId: string;
  let testRoomId: string;

  before(async () => {
    // 1. Setup Property, Building, and Floor
    const property = await prisma.property.create({
      data: {
        name: "Rooms Test Resort",
        city: "Testville",
        status: "ACTIVE",
      },
    });
    testPropertyId = property.id;

    const building = await prisma.building.create({
      data: {
        propertyId: property.id,
        name: "Test Tower",
      },
    });
    testBuildingId = building.id;

    const floor = await prisma.floor.create({
      data: {
        buildingId: building.id,
        floorNo: 1,
        name: "Floor 1",
      },
    });
    testFloorId = floor.id;

    // 2. Setup Amenity
    const amenity = await AmenityService.createAmenity({
      name: "High-Speed Wi-Fi (Test)",
      description: "Fiber internet",
    });
    testAmenityId = amenity.id;
  });

  after(async () => {
    // Cleanup in reverse dependency order
    if (testPropertyId) {
      await prisma.auditLog.deleteMany({ where: { entityType: "ROOM" } });
      await prisma.room.deleteMany({ where: { propertyId: testPropertyId } });
      await prisma.roomCategoryAmenity.deleteMany({
        where: { roomCategory: { propertyId: testPropertyId } },
      });
      await prisma.roomCategory.deleteMany({ where: { propertyId: testPropertyId } });
      await prisma.floor.deleteMany({
        where: { building: { propertyId: testPropertyId } },
      });
      await prisma.building.deleteMany({ where: { propertyId: testPropertyId } });
      await prisma.property.deleteMany({ where: { id: testPropertyId } });
    }
    if (testAmenityId) {
      await prisma.amenity.deleteMany({ where: { id: testAmenityId } });
    }
  });

  describe("1. Room Category Validations & CRUD", () => {
    it("should accept valid category schema input", () => {
      const valid = createCategorySchema.safeParse({
        name: "Premium King",
        basePrice: 150.5,
        maxOccupancy: 2,
        amenityIds: [testAmenityId],
      });
      assert.equal(valid.success, true);
    });

    it("should reject negative base price or zero occupancy", () => {
      const invalidPrice = createCategorySchema.safeParse({
        name: "Bad Price",
        basePrice: -50,
        maxOccupancy: 2,
      });
      assert.equal(invalidPrice.success, false);

      const invalidOccupancy = createCategorySchema.safeParse({
        name: "Bad Occupancy",
        basePrice: 100,
        maxOccupancy: 0,
      });
      assert.equal(invalidOccupancy.success, false);
    });

    it("should create room category with base price Decimal and amenities", async () => {
      const category = await RoomCategoryService.createCategory({
        propertyId: testPropertyId,
        name: "Premium King Suite",
        description: "Luxury suite",
        basePrice: "180.00",
        maxOccupancy: 3,
        amenityIds: [testAmenityId],
      });

      assert.ok(category);
      assert.equal(category.name, "Premium King Suite");
      assert.equal(category.basePrice.toString(), "180");
      assert.equal(category.maxOccupancy, 3);
      assert.equal(category.amenities.length, 1);
      assert.equal(category.amenities[0].amenity.name, "High-Speed Wi-Fi (Test)");
      testCategoryId = category.id;
    });

    it("should update room category base price and occupancy", async () => {
      const updated = await RoomCategoryService.updateCategory(testCategoryId, {
        basePrice: "195.50",
        maxOccupancy: 4,
      });

      assert.ok(updated);
      assert.equal(updated.basePrice.toString(), "195.5");
      assert.equal(updated.maxOccupancy, 4);
    });
  });

  describe("2. Physical Room Creation & Constraint Enforcement", () => {
    it("should validate room schema constraints", () => {
      const valid = createRoomSchema.safeParse({
        propertyId: testPropertyId,
        buildingId: testBuildingId,
        floorId: testFloorId,
        roomCategoryId: testCategoryId,
        roomNo: "301",
        capacity: 2,
        priceOverride: "175.00",
      });
      assert.equal(valid.success, true);
    });

    it("should create a physical room linked to category and building", async () => {
      const room = await RoomService.createRoom({
        propertyId: testPropertyId,
        buildingId: testBuildingId,
        floorId: testFloorId,
        roomCategoryId: testCategoryId,
        roomNo: "301",
        displayName: "Corner King Suite",
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
        priceOverride: "175.00",
        notes: "Panoramic city view",
      });

      assert.ok(room.id);
      assert.equal(room.roomNo, "301");
      assert.equal(room.status, RoomStatus.VACANT_CLEAN);
      assert.equal(room.priceOverride?.toString(), "175");
      assert.equal(room.category.name, "Premium King Suite");
      testRoomId = room.id;
    });

    it("should enforce room number uniqueness within the same building", async () => {
      await assert.rejects(
        async () => {
          await RoomService.createRoom({
            propertyId: testPropertyId,
            buildingId: testBuildingId,
            floorId: testFloorId,
            roomCategoryId: testCategoryId,
            roomNo: "301", // Duplicate room number in same building
            capacity: 2,
          });
        },
        {
          name: "Error",
          message: "A room with number '301' already exists in this building",
        }
      );
    });

    it("should reject room creation when building does not belong to property", async () => {
      // Create separate property
      const otherProperty = await prisma.property.create({
        data: { name: "Other Property" },
      });

      await assert.rejects(
        async () => {
          await RoomService.createRoom({
            propertyId: otherProperty.id, // Mismatched property
            buildingId: testBuildingId,
            floorId: testFloorId,
            roomCategoryId: testCategoryId,
            roomNo: "302",
            capacity: 2,
          });
        },
        {
          name: "Error",
          message: "Building does not belong to the selected property",
        }
      );

      await prisma.property.delete({ where: { id: otherProperty.id } });
    });

    it("should prevent deleting a room category that has assigned rooms", async () => {
      await assert.rejects(
        async () => {
          await RoomCategoryService.deleteCategory(testCategoryId);
        },
        {
          name: "Error",
          message:
            "Cannot delete room category because it is currently assigned to existing rooms.",
        }
      );
    });
  });

  describe("3. Operational Status Transitions", () => {
    it("should validate room status update schema correctly", () => {
      const valid = updateRoomStatusSchema.safeParse({
        status: RoomStatus.VACANT_CLEAN,
        notes: "Inspection complete",
      });
      assert.equal(valid.success, true);

      const invalid = updateRoomStatusSchema.safeParse({
        status: "NONEXISTENT_STATUS",
      });
      assert.equal(invalid.success, false);
    });

    it("should transition VACANT_CLEAN to VACANT_DIRTY and log audit", async () => {
      const updated = await RoomService.updateRoomStatus(
        testRoomId,
        RoomStatus.VACANT_DIRTY,
        "Daily housekeeping turnover needed",
        { name: "Staff Reception" }
      );

      assert.equal(updated.status, RoomStatus.VACANT_DIRTY);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityType: "ROOM",
          entityId: testRoomId,
          action: "ROOM_STATUS_CHANGED",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(audit !== null);
      const newData = audit.newData as Record<string, unknown>;
      assert.equal(newData.status, RoomStatus.VACANT_DIRTY);
    });

    it("should transition VACANT_DIRTY to VACANT_CLEAN after inspection", async () => {
      const updated = await RoomService.updateRoomStatus(
        testRoomId,
        RoomStatus.VACANT_CLEAN,
        "Room inspected and ready"
      );
      assert.equal(updated.status, RoomStatus.VACANT_CLEAN);
    });

    it("should transition VACANT_CLEAN to MAINTENANCE", async () => {
      const updated = await RoomService.updateRoomStatus(
        testRoomId,
        RoomStatus.MAINTENANCE,
        "Plumbing valve replacement"
      );
      assert.equal(updated.status, RoomStatus.MAINTENANCE);
    });

    it("should reject manual status transition directly to OCCUPIED", async () => {
      await assert.rejects(
        async () => {
          await RoomService.updateRoomStatus(testRoomId, RoomStatus.OCCUPIED);
        },
        {
          name: "Error",
          message:
            "Cannot manually set status to OCCUPIED. Room must be checked in through the guest check-in workflow.",
        }
      );
    });

    it("should reject manual status transition out of OCCUPIED without checkout", async () => {
      // Force room into OCCUPIED directly via DB to test invariant
      await prisma.room.update({
        where: { id: testRoomId },
        data: { status: RoomStatus.OCCUPIED },
      });

      await assert.rejects(
        async () => {
          await RoomService.updateRoomStatus(testRoomId, RoomStatus.VACANT_CLEAN);
        },
        {
          name: "Error",
          message:
            "Cannot manually change status of an OCCUPIED room. Room must be checked out through the checkout workflow.",
        }
      );

      // Reset back to VACANT_CLEAN via DB
      await prisma.room.update({
        where: { id: testRoomId },
        data: { status: RoomStatus.VACANT_CLEAN },
      });
    });
  });

  describe("4. Role Authorization & Access Control", () => {
    const receptionistSession = {
      sub: "rec-1",
      email: "reception@byteinn.local",
      name: "Receptionist",
      role: RoleName.RECEPTIONIST,
    };

    const adminSession = {
      sub: "adm-1",
      email: "admin@byteinn.local",
      name: "Admin",
      role: RoleName.ADMIN,
    };

    it("should permit receptionist to view rooms and update operational status", () => {
      const permitted = enforceRole(receptionistSession, [
        RoleName.ADMIN,
        RoleName.RECEPTIONIST,
      ]);
      assert.equal(permitted.role, RoleName.RECEPTIONIST);
    });

    it("should restrict receptionist from performing ADMIN-only catalog setup", () => {
      assert.throws(
        () => enforceRole(receptionistSession, [RoleName.ADMIN]),
        (err: unknown) =>
          err instanceof AuthError &&
          err.statusCode === 403 &&
          err.message.includes("Access denied")
      );
    });

    it("should permit admin for catalog setup and operational updates", () => {
      assert.equal(enforceRole(adminSession, [RoleName.ADMIN]), adminSession);
      assert.equal(
        enforceRole(adminSession, [RoleName.ADMIN, RoleName.RECEPTIONIST]),
        adminSession
      );
    });

    it("should throw AuthError(401) when session is unauthenticated", () => {
      assert.throws(
        () => enforceRole(null, [RoleName.ADMIN, RoleName.RECEPTIONIST]),
        (err: unknown) => err instanceof AuthError && err.statusCode === 401
      );
    });
  });
});
