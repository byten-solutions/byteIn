import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { PropertyService } from "../src/modules/properties/property.service";
import {
  createPropertySchema,
  createBuildingSchema,
  createFloorSchema,
} from "../src/modules/properties/property.validation";

describe("Phase 2: Property, Building & Floor Tests", () => {
  let testPropertyId: string;
  let testBuildingId: string;

  after(async () => {
    // Clean up test records
    if (testPropertyId) {
      await prisma.floor.deleteMany({ where: { building: { propertyId: testPropertyId } } });
      await prisma.building.deleteMany({ where: { propertyId: testPropertyId } });
      await prisma.property.deleteMany({ where: { id: testPropertyId } });
    }
  });

  describe("1. Property Validation & CRUD", () => {
    it("should accept valid property, building, and floor schemas", () => {
      const validProp = createPropertySchema.safeParse({
        name: "Seaside Resort",
        city: "Miami",
        state: "FL",
        country: "USA",
      });
      assert.equal(validProp.success, true);

      const validBldg = createBuildingSchema.safeParse({
        name: "East Wing",
        description: "New extension",
      });
      assert.equal(validBldg.success, true);

      const validFloor = createFloorSchema.safeParse({
        floorNo: 3,
        name: "Floor 3",
      });
      assert.equal(validFloor.success, true);
    });

    it("should reject property with empty name", () => {
      const invalid = createPropertySchema.safeParse({
        name: "",
      });
      assert.equal(invalid.success, false);
    });

    it("should create, list, and fetch a property", async () => {
      const property = await PropertyService.createProperty({
        name: "Test Integration Property",
        city: "Test City",
        phone: "+1-555-1234",
      });

      assert.ok(property.id);
      assert.equal(property.name, "Test Integration Property");
      testPropertyId = property.id;

      const fetched = await PropertyService.getPropertyById(property.id);
      assert.ok(fetched !== null);
      assert.equal(fetched.name, "Test Integration Property");

      const all = await PropertyService.getProperties();
      assert.ok(all.some((p) => p.id === property.id));
    });

    it("should update a property", async () => {
      const updated = await PropertyService.updateProperty(testPropertyId, {
        name: "Updated Integration Property",
        city: "New City",
      });
      assert.equal(updated.name, "Updated Integration Property");
      assert.equal(updated.city, "New City");
    });
  });

  describe("2. Building & Floor Hierarchy", () => {
    it("should create a building linked to a property", async () => {
      const building = await PropertyService.createBuilding({
        propertyId: testPropertyId,
        name: "North Tower",
        description: "Guest room wing",
      });

      assert.ok(building.id);
      assert.equal(building.name, "North Tower");
      assert.equal(building.propertyId, testPropertyId);
      testBuildingId = building.id;

      const buildings = await PropertyService.getBuildings(testPropertyId);
      assert.ok(buildings.some((b) => b.id === building.id));
    });

    it("should reject creating a building under nonexistent property", async () => {
      await assert.rejects(
        async () => {
          await PropertyService.createBuilding({
            propertyId: "nonexistent-property-id",
            name: "Ghost Building",
          });
        },
        {
          name: "Error",
          message: "Property not found",
        }
      );
    });

    it("should create a floor under a building", async () => {
      const floor = await PropertyService.createFloor({
        buildingId: testBuildingId,
        floorNo: 1,
        name: "Lobby Floor",
      });

      assert.ok(floor.id);
      assert.equal(floor.floorNo, 1);
      assert.equal(floor.buildingId, testBuildingId);

      const floors = await PropertyService.getFloors(testBuildingId);
      assert.ok(floors.some((f) => f.id === floor.id));
    });

    it("should reject creating a floor under nonexistent building", async () => {
      await assert.rejects(
        async () => {
          await PropertyService.createFloor({
            buildingId: "nonexistent-building-id",
            floorNo: 99,
          });
        },
        {
          name: "Error",
          message: "Building not found",
        }
      );
    });
  });
});
