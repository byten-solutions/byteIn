import { PrismaClient, RoleName, RoomStatus, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding byteInn database...");

  // 1. Seed Roles
  const adminRole = await prisma.role.upsert({
    where: { name: RoleName.ADMIN },
    update: {},
    create: {
      name: RoleName.ADMIN,
      description: "Administrator with full system configuration and user management access",
    },
  });

  const receptionistRole = await prisma.role.upsert({
    where: { name: RoleName.RECEPTIONIST },
    update: {},
    create: {
      name: RoleName.RECEPTIONIST,
      description: "Front-desk receptionist for guest check-in, bookings, and payments",
    },
  });

  console.log(`Roles ensured: ${adminRole.name}, ${receptionistRole.name}`);

  // 2. Seed Initial Users
  const salt = await bcrypt.genSalt(10);
  const defaultAdminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123456";
  const defaultReceptionistPassword = process.env.SEED_RECEPTIONIST_PASSWORD || "Reception@123456";

  const adminPasswordHash = await bcrypt.hash(defaultAdminPassword, salt);
  const receptionistPasswordHash = await bcrypt.hash(defaultReceptionistPassword, salt);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@byteinn.local" },
    update: {},
    create: {
      name: "System Administrator",
      email: "admin@byteinn.local",
      passwordHash: adminPasswordHash,
      roleId: adminRole.id,
      status: "ACTIVE",
    },
  });

  const receptionistUser = await prisma.user.upsert({
    where: { email: "reception@byteinn.local" },
    update: {},
    create: {
      name: "Front Desk Staff",
      email: "reception@byteinn.local",
      passwordHash: receptionistPasswordHash,
      roleId: receptionistRole.id,
      status: "ACTIVE",
    },
  });

  console.log(`Seed users ensured:`);
  console.log(`- ${adminUser.email} (Role: ADMIN)`);
  console.log(`- ${receptionistUser.email} (Role: RECEPTIONIST)`);

  // 3. Seed Default Property
  let property = await prisma.property.findFirst({
    where: { name: "byteInn Grand Hotel" },
  });
  if (!property) {
    property = await prisma.property.create({
      data: {
        name: "byteInn Grand Hotel",
        address: "100 Hospitality Way",
        city: "Metropolis",
        state: "NY",
        country: "USA",
        phone: "+1-555-0199",
        email: "contact@byteinn.local",
        status: "ACTIVE",
      },
    });
  }
  console.log(`Property ensured: ${property.name} (${property.id})`);

  // 4. Seed Building
  let building = await prisma.building.findFirst({
    where: { propertyId: property.id, name: "Main Wing" },
  });
  if (!building) {
    building = await prisma.building.create({
      data: {
        propertyId: property.id,
        name: "Main Wing",
        description: "Primary hotel wing with guest rooms and amenities",
      },
    });
  }
  console.log(`Building ensured: ${building.name} (${building.id})`);

  // 5. Seed Floors
  let floor1 = await prisma.floor.findFirst({
    where: { buildingId: building.id, floorNo: 1 },
  });
  if (!floor1) {
    floor1 = await prisma.floor.create({
      data: {
        buildingId: building.id,
        floorNo: 1,
        name: "First Floor",
      },
    });
  }

  let floor2 = await prisma.floor.findFirst({
    where: { buildingId: building.id, floorNo: 2 },
  });
  if (!floor2) {
    floor2 = await prisma.floor.create({
      data: {
        buildingId: building.id,
        floorNo: 2,
        name: "Second Floor",
      },
    });
  }
  console.log(`Floors ensured: Floor 1, Floor 2`);

  // 6. Seed Amenities
  const amenityNames = [
    { name: "Wi-Fi", description: "High-speed wireless internet" },
    { name: "Air Conditioning", description: "Climate-controlled AC unit" },
    { name: "Flat Screen TV", description: "4K smart TV with cable channels" },
    { name: "Mini Bar", description: "Beverages and light refreshments" },
    { name: "Safe Deposit Box", description: "In-room electronic safe" },
  ];

  const amenityMap = new Map<string, string>();
  for (const item of amenityNames) {
    const amenity = await prisma.amenity.upsert({
      where: { name: item.name },
      update: { description: item.description },
      create: item,
    });
    amenityMap.set(item.name, amenity.id);
  }
  console.log(`Amenities ensured (${amenityMap.size})`);

  // 7. Seed Room Categories
  const categoryConfigs = [
    {
      name: "Standard Single",
      description: "Cozy single room ideal for solo travelers",
      basePrice: new Prisma.Decimal("75.00"),
      maxOccupancy: 1,
      amenities: ["Wi-Fi", "Air Conditioning", "Flat Screen TV"],
    },
    {
      name: "Deluxe Double",
      description: "Spacious double bedroom with king bed and workspace",
      basePrice: new Prisma.Decimal("120.00"),
      maxOccupancy: 2,
      amenities: ["Wi-Fi", "Air Conditioning", "Flat Screen TV", "Safe Deposit Box"],
    },
    {
      name: "Executive Suite",
      description: "Luxury suite featuring lounge area and scenic views",
      basePrice: new Prisma.Decimal("220.00"),
      maxOccupancy: 4,
      amenities: ["Wi-Fi", "Air Conditioning", "Flat Screen TV", "Mini Bar", "Safe Deposit Box"],
    },
  ];

  const categoryMap = new Map<string, string>();
  for (const cfg of categoryConfigs) {
    let cat = await prisma.roomCategory.findFirst({
      where: { propertyId: property.id, name: cfg.name },
    });
    if (!cat) {
      cat = await prisma.roomCategory.create({
        data: {
          propertyId: property.id,
          name: cfg.name,
          description: cfg.description,
          basePrice: cfg.basePrice,
          maxOccupancy: cfg.maxOccupancy,
        },
      });

      for (const amenName of cfg.amenities) {
        const amenId = amenityMap.get(amenName);
        if (amenId) {
          await prisma.roomCategoryAmenity.create({
            data: {
              roomCategoryId: cat.id,
              amenityId: amenId,
            },
          });
        }
      }
    }
    categoryMap.set(cfg.name, cat.id);
  }
  console.log(`Room categories ensured (${categoryMap.size})`);

  // 8. Seed Rooms
  const sampleRooms = [
    {
      roomNo: "101",
      displayName: "Room 101 (Standard)",
      floorId: floor1.id,
      categoryName: "Standard Single",
      capacity: 1,
      status: RoomStatus.VACANT_CLEAN,
      priceOverride: null,
      notes: "Facing courtyard",
    },
    {
      roomNo: "102",
      displayName: "Room 102 (Standard)",
      floorId: floor1.id,
      categoryName: "Standard Single",
      capacity: 1,
      status: RoomStatus.VACANT_DIRTY,
      priceOverride: null,
      notes: "Requires standard turnover",
    },
    {
      roomNo: "103",
      displayName: "Room 103 (Deluxe)",
      floorId: floor1.id,
      categoryName: "Deluxe Double",
      capacity: 2,
      status: RoomStatus.VACANT_CLEAN,
      priceOverride: null,
      notes: null,
    },
    {
      roomNo: "201",
      displayName: "Room 201 (Deluxe)",
      floorId: floor2.id,
      categoryName: "Deluxe Double",
      capacity: 2,
      status: RoomStatus.MAINTENANCE,
      priceOverride: null,
      notes: "AC maintenance check in progress",
    },
    {
      roomNo: "202",
      displayName: "Room 202 (Suite)",
      floorId: floor2.id,
      categoryName: "Executive Suite",
      capacity: 4,
      status: RoomStatus.VACANT_CLEAN,
      priceOverride: new Prisma.Decimal("200.00"),
      notes: "Corporate rate override applied",
    },
    {
      roomNo: "203",
      displayName: "Room 203 (Suite)",
      floorId: floor2.id,
      categoryName: "Executive Suite",
      capacity: 4,
      status: RoomStatus.OUT_OF_SERVICE,
      priceOverride: null,
      notes: "Annual deep renovation",
    },
  ];

  for (const r of sampleRooms) {
    const catId = categoryMap.get(r.categoryName);
    if (!catId) continue;

    const existingRoom = await prisma.room.findUnique({
      where: {
        buildingId_roomNo: {
          buildingId: building.id,
          roomNo: r.roomNo,
        },
      },
    });

    if (!existingRoom) {
      await prisma.room.create({
        data: {
          propertyId: property.id,
          buildingId: building.id,
          floorId: r.floorId,
          roomCategoryId: catId,
          roomNo: r.roomNo,
          displayName: r.displayName,
          capacity: r.capacity,
          status: r.status,
          priceOverride: r.priceOverride,
          notes: r.notes,
        },
      });
    }
  }
  console.log(`Sample rooms ensured (${sampleRooms.length})`);
  console.log("Database seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
