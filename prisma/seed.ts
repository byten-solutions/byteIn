import {
  PrismaClient,
  RoleName,
  RoomStatus,
  InvoiceStatus,
  InvoiceItemType,
  PaymentStatus,
  ReservationStatus,
  AllocationStatus,
  Prisma,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding byteInn database...");

  // 0. Clean up leaked test data (e.g. temporary properties or test fixtures)
  const leakedProperties = await prisma.property.findMany({
    where: {
      name: { not: "byteInn Grand Hotel" },
    },
    include: {
      buildings: true,
      rooms: true,
    },
  });

  for (const lp of leakedProperties) {
    console.log(`Cleaning leaked test property: "${lp.name}" (${lp.id})...`);
    // Delete dependent records for this leaked property
    await prisma.payment.deleteMany({
      where: { invoice: { reservation: { rooms: { some: { room: { propertyId: lp.id } } } } } },
    });
    await prisma.invoiceItem.deleteMany({
      where: { invoice: { reservation: { rooms: { some: { room: { propertyId: lp.id } } } } } },
    });
    await prisma.invoice.deleteMany({
      where: { reservation: { rooms: { some: { room: { propertyId: lp.id } } } } },
    });
    await prisma.reservationRoom.deleteMany({
      where: { room: { propertyId: lp.id } },
    });
    await prisma.room.deleteMany({
      where: { propertyId: lp.id },
    });
    await prisma.roomCategoryAmenity.deleteMany({
      where: { roomCategory: { propertyId: lp.id } },
    });
    await prisma.roomCategory.deleteMany({
      where: { propertyId: lp.id },
    });
    await prisma.floor.deleteMany({
      where: { building: { propertyId: lp.id } },
    });
    await prisma.building.deleteMany({
      where: { propertyId: lp.id },
    });
    await prisma.property.delete({
      where: { id: lp.id },
    });
  }

  // Also clean any leaked buildings under any property (such as "Main Tower")
  const leakedBuildings = await prisma.building.findMany({
    where: {
      name: { notIn: ["Main Wing", "West Wing"] },
    },
  });
  for (const lb of leakedBuildings) {
    console.log(`Cleaning leaked building: "${lb.name}" (${lb.id})...`);
    await prisma.room.deleteMany({ where: { buildingId: lb.id } });
    await prisma.floor.deleteMany({ where: { buildingId: lb.id } });
    await prisma.building.delete({ where: { id: lb.id } });
  }

  // Clean non-canonical reservations and customers left over from temporary test seeds
  const CANONICAL_RESERVATION_NOS = [
    "RES-20261011-B139",
    "RES-20261011-6472",
    "RES-20261011-5FDC",
    "RES-20261011-D228",
    "RES-20261011-253D",
  ];
  const CANONICAL_INVOICE_NUMBERS = [
    "INV-20261011-B139",
    "INV-20261011-6472",
    "INV-20261011-5FDC",
    "INV-20261011-D228",
  ];
  await prisma.payment.deleteMany({
    where: { invoice: { invoiceNumber: { notIn: CANONICAL_INVOICE_NUMBERS } } },
  });
  await prisma.invoiceItem.deleteMany({
    where: { invoice: { invoiceNumber: { notIn: CANONICAL_INVOICE_NUMBERS } } },
  });
  await prisma.invoice.deleteMany({
    where: { invoiceNumber: { notIn: CANONICAL_INVOICE_NUMBERS } },
  });
  await prisma.reservationRoom.deleteMany({
    where: { reservation: { reservationNo: { notIn: CANONICAL_RESERVATION_NOS } } },
  });
  await prisma.reservation.deleteMany({
    where: { reservationNo: { notIn: CANONICAL_RESERVATION_NOS } },
  });
  await prisma.customer.deleteMany({
    where: {
      phone: { notIn: ["+91 98765 43210", "+91 98765 43211", "+91 98765 43212", "+91 98765 43213"] },
    },
  });

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

  // 2. Seed Initial Users (idempotent: re-running seed does NOT reset password or re-force mustChangePassword)
  const isProduction = process.env.NODE_ENV === "production";
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  const seedReceptionistPassword = process.env.SEED_RECEPTIONIST_PASSWORD;

  if (isProduction && (!seedAdminPassword || !seedReceptionistPassword)) {
    throw new Error(
      "Production seed aborted: SEED_ADMIN_PASSWORD and SEED_RECEPTIONIST_PASSWORD environment variables are mandatory in production. Insecure default passwords are prohibited."
    );
  }

  const salt = await bcrypt.genSalt(10);
  const adminPassword = seedAdminPassword || "Admin@123456";
  const receptionistPassword = seedReceptionistPassword || "Reception@123456";

  const adminPasswordHash = await bcrypt.hash(adminPassword, salt);
  const receptionistPasswordHash = await bcrypt.hash(receptionistPassword, salt);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@byteinn.local" },
    update: { mustChangePassword: false }, // keep dev admin unlocked
    create: {
      name: "System Administrator",
      email: "admin@byteinn.local",
      passwordHash: adminPasswordHash,
      roleId: adminRole.id,
      status: "ACTIVE",
      mustChangePassword: false,
    },
  });

  const receptionistUser = await prisma.user.upsert({
    where: { email: "reception@byteinn.local" },
    update: { mustChangePassword: false },
    create: {
      name: "Front Desk Staff",
      email: "reception@byteinn.local",
      passwordHash: receptionistPasswordHash,
      roleId: receptionistRole.id,
      status: "ACTIVE",
      mustChangePassword: false,
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
        address: "MG Road, Near Central Residency",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        phone: "+91 98765 43210",
        email: "contact@byteinn.local",
        status: "ACTIVE",
      },
    });
  }
  console.log(`Property ensured: ${property.name} (${property.id})`);

  // 4. Seed Buildings (Main Wing & West Wing)
  let mainWing = await prisma.building.findFirst({
    where: { propertyId: property.id, name: "Main Wing" },
  });
  if (!mainWing) {
    mainWing = await prisma.building.create({
      data: {
        propertyId: property.id,
        name: "Main Wing",
        description: "Primary hotel wing with guest rooms and amenities",
      },
    });
  }

  let westWing = await prisma.building.findFirst({
    where: { name: "West Wing" },
  });
  if (!westWing) {
    westWing = await prisma.building.create({
      data: {
        propertyId: property.id,
        name: "West Wing",
        description: "West Wing suites and extended stay rooms",
      },
    });
  }
  console.log(`Buildings ensured: ${mainWing.name}, ${westWing.name}`);

  // 5. Seed Floors
  let floor1Main = await prisma.floor.findFirst({
    where: { buildingId: mainWing.id, floorNo: 1 },
  });
  if (!floor1Main) {
    floor1Main = await prisma.floor.create({
      data: {
        buildingId: mainWing.id,
        floorNo: 1,
        name: "First Floor",
      },
    });
  }

  let floor2Main = await prisma.floor.findFirst({
    where: { buildingId: mainWing.id, floorNo: 2 },
  });
  if (!floor2Main) {
    floor2Main = await prisma.floor.create({
      data: {
        buildingId: mainWing.id,
        floorNo: 2,
        name: "Second Floor",
      },
    });
  }

  let floor1West = await prisma.floor.findFirst({
    where: { buildingId: westWing.id, floorNo: 1 },
  });
  if (!floor1West) {
    floor1West = await prisma.floor.create({
      data: {
        buildingId: westWing.id,
        floorNo: 1,
        name: "Floor 1",
      },
    });
  }
  console.log(`Floors ensured: Main Wing (F1, F2), West Wing (F1)`);

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

  // Clean non-canonical amenities
  const extraAmenities = await prisma.amenity.findMany({
    where: {
      name: { notIn: amenityNames.map((a) => a.name) },
    },
  });
  for (const ea of extraAmenities) {
    await prisma.roomCategoryAmenity.deleteMany({ where: { amenityId: ea.id } });
    await prisma.amenity.delete({ where: { id: ea.id } });
  }

  console.log(`Amenities ensured (${amenityMap.size})`);

  // 7. Seed Room Categories (5 core categories)
  const categoryConfigs = [
    {
      name: "Standard Single",
      description: "Cozy single room ideal for solo travelers",
      basePrice: new Prisma.Decimal("75.00"),
      maxOccupancy: 1,
      amenities: ["Wi-Fi", "Air Conditioning", "Flat Screen TV"],
    },
    {
      name: "Deluxe Suite",
      description: "Comfortable suite with private balcony and desk",
      basePrice: new Prisma.Decimal("100.00"),
      maxOccupancy: 3,
      amenities: ["Wi-Fi", "Air Conditioning", "Flat Screen TV", "Safe Deposit Box"],
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
    {
      name: "Presidential Suite",
      description: "Premier luxury suite featuring spacious lounge and panoramic views",
      basePrice: new Prisma.Decimal("1000.00"),
      maxOccupancy: 6,
      amenities: ["Wi-Fi", "Air Conditioning", "Flat Screen TV", "Mini Bar", "Safe Deposit Box"],
    },
  ];

  const categoryMap = new Map<string, string>();
  for (const cfg of categoryConfigs) {
    let cat = await prisma.roomCategory.findFirst({
      where: { name: cfg.name },
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
    } else {
      cat = await prisma.roomCategory.update({
        where: { id: cat.id },
        data: {
          description: cfg.description,
          basePrice: cfg.basePrice,
          maxOccupancy: cfg.maxOccupancy,
        },
      });
    }

    for (const amenName of cfg.amenities) {
      const amenId = amenityMap.get(amenName);
      if (amenId) {
        await prisma.roomCategoryAmenity.upsert({
          where: {
            roomCategoryId_amenityId: {
              roomCategoryId: cat.id,
              amenityId: amenId,
            },
          },
          update: {},
          create: {
            roomCategoryId: cat.id,
            amenityId: amenId,
          },
        });
      }
    }
    categoryMap.set(cfg.name, cat.id);
  }

  // Clean any extraneous room categories
  const extraCategories = await prisma.roomCategory.findMany({
    where: {
      name: { notIn: categoryConfigs.map((c) => c.name) },
    },
  });
  for (const ec of extraCategories) {
    const roomsCount = await prisma.room.count({ where: { roomCategoryId: ec.id } });
    if (roomsCount === 0) {
      await prisma.roomCategoryAmenity.deleteMany({ where: { roomCategoryId: ec.id } });
      await prisma.roomCategory.delete({ where: { id: ec.id } });
    }
  }

  console.log(`Room categories ensured (${categoryMap.size})`);

  // 8. Seed Rooms (Original 10 rooms across Main Wing & West Wing)
  const sampleRooms = [
    // Main Wing (6 rooms)
    {
      buildingId: mainWing.id,
      floorId: floor1Main.id,
      roomNo: "101",
      displayName: "Room 101 — Ground Floor Courtyard Heritage Standard Single with Garden Fountain View",
      categoryName: "Standard Single",
      capacity: 1,
      status: RoomStatus.VACANT_CLEAN,
      priceOverride: null,
      notes: "Facing courtyard",
    },
    {
      buildingId: mainWing.id,
      floorId: floor1Main.id,
      roomNo: "102",
      displayName: "Room 102 — Ground Floor Courtyard Heritage Standard Single with Teak Writing Desk",
      categoryName: "Standard Single",
      capacity: 1,
      status: RoomStatus.VACANT_DIRTY,
      priceOverride: null,
      notes: "Requires standard turnover",
    },
    {
      buildingId: mainWing.id,
      floorId: floor1Main.id,
      roomNo: "103",
      displayName: "Room 103 — Ground Floor Lakeview Deluxe Double Suite with Private Balcony and Workspace",
      categoryName: "Deluxe Double",
      capacity: 2,
      status: RoomStatus.VACANT_DIRTY,
      priceOverride: null,
      notes: null,
    },
    {
      buildingId: mainWing.id,
      floorId: floor2Main.id,
      roomNo: "201",
      displayName: "Room 201 — Second Floor High-Ceiling Deluxe Double Suite with Private Veranda",
      categoryName: "Deluxe Double",
      capacity: 2,
      status: RoomStatus.MAINTENANCE,
      priceOverride: null,
      notes: "AC maintenance check in progress",
    },
    {
      buildingId: mainWing.id,
      floorId: floor2Main.id,
      roomNo: "202",
      displayName: "Room 202 — Executive Panoramic Suite with Private Lounge and Dedicated Meeting Alcove",
      categoryName: "Executive Suite",
      capacity: 4,
      status: RoomStatus.VACANT_DIRTY,
      priceOverride: new Prisma.Decimal("200.00"),
      notes: "Corporate rate override applied",
    },
    {
      buildingId: mainWing.id,
      floorId: floor2Main.id,
      roomNo: "203",
      displayName: "Room 203 — The Grand Maharaja Diplomatic Presidential Enclave with Panoramic Terrace",
      categoryName: "Executive Suite",
      capacity: 4,
      status: RoomStatus.OUT_OF_SERVICE,
      priceOverride: null,
      notes: "Annual deep renovation",
    },
    // West Wing (4 rooms)
    {
      buildingId: westWing.id,
      floorId: floor1West.id,
      roomNo: "101",
      displayName: "Room 101 — West Wing Ground Floor Deluxe Suite with Garden View & Teak Veranda",
      categoryName: "Deluxe Suite",
      capacity: 2,
      status: RoomStatus.VACANT_DIRTY,
      priceOverride: null,
      notes: null,
    },
    {
      buildingId: westWing.id,
      floorId: floor1West.id,
      roomNo: "102",
      displayName: "Room 102 — West Wing Ground Floor Deluxe Suite with Workstation & Minibar",
      categoryName: "Deluxe Suite",
      capacity: 2,
      status: RoomStatus.VACANT_CLEAN,
      priceOverride: new Prisma.Decimal("125.00"),
      notes: null,
    },
    {
      buildingId: westWing.id,
      floorId: floor1West.id,
      roomNo: "103",
      displayName: "Room 103 — West Wing Ground Floor Deluxe Suite with Quiet Garden Orientation",
      categoryName: "Deluxe Suite",
      capacity: 2,
      status: RoomStatus.MAINTENANCE,
      priceOverride: null,
      notes: null,
    },
    {
      buildingId: westWing.id,
      floorId: floor1West.id,
      roomNo: "104",
      displayName: "Room 104 — West Wing Premier Presidential Suite with High Ceilings and Private Terrace",
      categoryName: "Deluxe Suite",
      capacity: 2,
      status: RoomStatus.VACANT_DIRTY,
      priceOverride: null,
      notes: null,
    },
  ];

  const roomMap = new Map<string, string>();
  for (const r of sampleRooms) {
    const catId = categoryMap.get(r.categoryName);
    if (!catId) continue;

    const room = await prisma.room.upsert({
      where: {
        buildingId_roomNo: {
          buildingId: r.buildingId,
          roomNo: r.roomNo,
        },
      },
      update: {
        floorId: r.floorId,
        roomCategoryId: catId,
        displayName: r.displayName,
        capacity: r.capacity,
        status: r.status,
        priceOverride: r.priceOverride,
        notes: r.notes,
      },
      create: {
        propertyId: property.id,
        buildingId: r.buildingId,
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
    // key by building name + roomNo
    const bName = r.buildingId === mainWing.id ? "Main Wing" : "West Wing";
    roomMap.set(`${bName}:${r.roomNo}`, room.id);
  }
  console.log(`Sample rooms ensured (${sampleRooms.length})`);

  // 9. Seed Customers (Idempotent with last 4 ID digits)
  const customersData = [
    {
      key: "rinshad",
      firstName: "Mohammed",
      lastName: "Rinshad P",
      email: "rinshadmorayur09@gmail.com",
      phone: "+91 98765 43210",
      idProofType: "Passport",
      idProofNumber: "4321",
    },
    {
      key: "honey",
      firstName: "Honey",
      lastName: "Bee",
      email: "hb@gmail.com",
      phone: "+91 98765 43211",
      idProofType: "National ID",
      idProofNumber: "6472",
    },
    {
      key: "esrd",
      firstName: "esrdtfyguhij",
      lastName: "tgy",
      email: null,
      phone: "+91 98765 43212",
      idProofType: "Passport",
      idProofNumber: "253D",
    },
    {
      key: "jhb",
      firstName: "jhb",
      lastName: "jhbbb",
      email: "xcfgh@cvb.fghj",
      phone: "+91 98765 43213",
      idProofType: "Passport",
      idProofNumber: "D228",
    },
  ];

  const customerMap = new Map<string, string>();
  for (const c of customersData) {
    let cust = c.email
      ? await prisma.customer.findFirst({ where: { email: c.email } })
      : await prisma.customer.findFirst({ where: { phone: c.phone } });

    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          idProofType: c.idProofType,
          idProofNumber: c.idProofNumber,
          registeredPropertyId: property.id,
        },
      });
    } else {
      cust = await prisma.customer.update({
        where: { id: cust.id },
        data: {
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          idProofType: c.idProofType,
          idProofNumber: c.idProofNumber,
        },
      });
    }
    customerMap.set(c.key, cust.id);
  }
  console.log(`Customers ensured (${customerMap.size})`);

  // 10. Seed Reservations & Allocations
  const reservationsData = [
    {
      reservationNo: "RES-20261011-B139",
      customerKey: "rinshad",
      status: ReservationStatus.CONFIRMED,
      allocations: [
        {
          building: "West Wing",
          roomNo: "102",
          categoryName: "Deluxe Suite",
          arrivalDate: new Date("2026-10-11T00:00:00.000Z"),
          departureDate: new Date("2026-10-28T00:00:00.000Z"),
          bookedNightlyRate: new Prisma.Decimal("125.00"),
          status: AllocationStatus.CONFIRMED,
          checkedInAt: null,
          checkedOutAt: null,
        },
        {
          building: "West Wing",
          roomNo: "101",
          categoryName: "Deluxe Suite",
          arrivalDate: new Date("2026-10-11T00:00:00.000Z"),
          departureDate: new Date("2026-10-28T00:00:00.000Z"),
          bookedNightlyRate: new Prisma.Decimal("100.00"),
          status: AllocationStatus.CONFIRMED,
          checkedInAt: null,
          checkedOutAt: null,
        },
      ],
    },
    {
      reservationNo: "RES-20261011-6472",
      customerKey: "honey",
      status: ReservationStatus.COMPLETED,
      allocations: [
        {
          building: "Main Wing",
          roomNo: "103",
          categoryName: "Deluxe Double",
          arrivalDate: new Date("2026-10-11T00:00:00.000Z"),
          departureDate: new Date("2026-10-20T00:00:00.000Z"),
          bookedNightlyRate: new Prisma.Decimal("200.00"),
          status: AllocationStatus.CHECKED_OUT,
          checkedInAt: new Date("2026-10-11T14:15:00.000Z"),
          checkedOutAt: new Date("2026-10-20T10:30:00.000Z"),
        },
      ],
    },
    {
      reservationNo: "RES-20261011-5FDC",
      customerKey: "rinshad",
      status: ReservationStatus.COMPLETED,
      allocations: [
        {
          building: "Main Wing",
          roomNo: "202",
          categoryName: "Executive Suite",
          arrivalDate: new Date("2026-10-11T00:00:00.000Z"),
          departureDate: new Date("2026-10-12T00:00:00.000Z"),
          bookedNightlyRate: new Prisma.Decimal("200.00"),
          status: AllocationStatus.CHECKED_OUT,
          checkedInAt: new Date("2026-10-11T14:00:00.000Z"),
          checkedOutAt: new Date("2026-10-12T10:00:00.000Z"),
        },
        {
          building: "Main Wing",
          roomNo: "103",
          categoryName: "Deluxe Double",
          arrivalDate: new Date("2026-10-11T00:00:00.000Z"),
          departureDate: new Date("2026-10-12T00:00:00.000Z"),
          bookedNightlyRate: new Prisma.Decimal("120.00"),
          status: AllocationStatus.CHECKED_OUT,
          checkedInAt: new Date("2026-10-11T14:00:00.000Z"),
          checkedOutAt: new Date("2026-10-12T10:00:00.000Z"),
        },
      ],
    },
    {
      reservationNo: "RES-20261011-D228",
      customerKey: "jhb",
      status: ReservationStatus.COMPLETED,
      allocations: [
        {
          building: "Main Wing",
          roomNo: "101",
          categoryName: "Standard Single",
          arrivalDate: new Date("2026-10-11T00:00:00.000Z"),
          departureDate: new Date("2026-10-12T00:00:00.000Z"),
          bookedNightlyRate: new Prisma.Decimal("100.00"),
          status: AllocationStatus.CHECKED_OUT,
          checkedInAt: new Date("2026-10-11T11:00:00.000Z"),
          checkedOutAt: new Date("2026-10-12T10:30:00.000Z"),
        },
      ],
    },
    {
      reservationNo: "RES-20261011-253D",
      customerKey: "esrd",
      status: ReservationStatus.COMPLETED,
      allocations: [
        {
          building: "West Wing",
          roomNo: "104",
          categoryName: "Deluxe Suite",
          arrivalDate: new Date("2026-10-11T00:00:00.000Z"),
          departureDate: new Date("2026-10-12T00:00:00.000Z"),
          bookedNightlyRate: new Prisma.Decimal("100.00"),
          status: AllocationStatus.CHECKED_OUT,
          checkedInAt: new Date("2026-10-11T12:00:00.000Z"),
          checkedOutAt: new Date("2026-10-12T09:30:00.000Z"),
        },
      ],
    },
  ];

  for (const rData of reservationsData) {
    const custId = customerMap.get(rData.customerKey);
    if (!custId) continue;

    let resv = await prisma.reservation.findUnique({
      where: { reservationNo: rData.reservationNo },
      include: { rooms: true },
    });

    if (!resv) {
      resv = await prisma.reservation.create({
        data: {
          reservationNo: rData.reservationNo,
          customerId: custId,
          propertyId: property.id,
          status: rData.status,
          createdBy: receptionistUser.id,
        },
        include: { rooms: true },
      });
    } else {
      resv = await prisma.reservation.update({
        where: { id: resv.id },
        data: {
          customerId: custId,
          status: rData.status,
        },
        include: { rooms: true },
      });
    }

    // Ensure allocations
    for (const alloc of rData.allocations) {
      const roomId = roomMap.get(`${alloc.building}:${alloc.roomNo}`);
      const catId = categoryMap.get(alloc.categoryName);
      if (!roomId || !catId) continue;

      const existingAlloc = await prisma.reservationRoom.findFirst({
        where: {
          reservationId: resv.id,
          roomId,
          arrivalDate: alloc.arrivalDate,
        },
      });

      if (!existingAlloc) {
        await prisma.reservationRoom.create({
          data: {
            reservationId: resv.id,
            roomId,
            roomCategoryId: catId,
            arrivalDate: alloc.arrivalDate,
            departureDate: alloc.departureDate,
            bookedNightlyRate: alloc.bookedNightlyRate,
            status: alloc.status,
            checkedInAt: alloc.checkedInAt,
            checkedOutAt: alloc.checkedOutAt,
          },
        });
      } else {
        await prisma.reservationRoom.update({
          where: { id: existingAlloc.id },
          data: {
            roomCategoryId: catId,
            departureDate: alloc.departureDate,
            bookedNightlyRate: alloc.bookedNightlyRate,
            status: alloc.status,
            checkedInAt: alloc.checkedInAt,
            checkedOutAt: alloc.checkedOutAt,
          },
        });
      }
    }
  }
  console.log(`Reservations ensured (${reservationsData.length})`);

  // 11. Restore Demo Invoices & Collections for Active Reservations (4 total)
  console.log("Restoring demo invoices & collections for existing reservations...");
  const demoInvoicesData = [
    {
      reservationNo: "RES-20261011-B139",
      invoiceNumber: "INV-20261011-B139",
      subtotal: new Prisma.Decimal("3825.00"),
      grandTotal: new Prisma.Decimal("3825.00"),
      status: InvoiceStatus.PAID,
      issuedAt: new Date("2026-10-11T10:21:21.000Z"),
      items: [
        {
          description: "Room 102 (Deluxe Suite, 17 nights)",
          quantity: new Prisma.Decimal("17.00"),
          unitPrice: new Prisma.Decimal("125.00"),
          lineTotal: new Prisma.Decimal("2125.00"),
          itemType: InvoiceItemType.ROOM_CHARGE,
        },
        {
          description: "Room 101 (Deluxe Suite, 17 nights)",
          quantity: new Prisma.Decimal("17.00"),
          unitPrice: new Prisma.Decimal("100.00"),
          lineTotal: new Prisma.Decimal("1700.00"),
          itemType: InvoiceItemType.ROOM_CHARGE,
        },
      ],
      payment: {
        amount: new Prisma.Decimal("3825.00"),
        paymentMethod: "UPI",
        referenceNumber: "UPI-MRIN-B139",
        status: PaymentStatus.RECORDED,
        paidAt: new Date("2026-10-11T10:25:00.000Z"),
        createdBy: receptionistUser.id,
      },
    },
    {
      reservationNo: "RES-20261011-6472",
      invoiceNumber: "INV-20261011-6472",
      subtotal: new Prisma.Decimal("1800.00"),
      grandTotal: new Prisma.Decimal("1800.00"),
      status: InvoiceStatus.PAID,
      issuedAt: new Date("2026-10-20T10:30:00.000Z"),
      items: [
        {
          description: "Room 103 (Deluxe Double, 9 nights)", // matched to reservation room category Deluxe Double
          quantity: new Prisma.Decimal("9.00"),
          unitPrice: new Prisma.Decimal("200.00"),
          lineTotal: new Prisma.Decimal("1800.00"),
          itemType: InvoiceItemType.ROOM_CHARGE,
        },
      ],
      payment: {
        amount: new Prisma.Decimal("1800.00"),
        paymentMethod: "CARD",
        referenceNumber: "CARD-HB-6472",
        status: PaymentStatus.RECORDED,
        paidAt: new Date("2026-10-20T10:35:00.000Z"), // paidAt after invoice issuedAt
        createdBy: receptionistUser.id,
      },
    },
    {
      reservationNo: "RES-20261011-5FDC",
      invoiceNumber: "INV-20261011-5FDC",
      subtotal: new Prisma.Decimal("500.00"),
      grandTotal: new Prisma.Decimal("500.00"),
      status: InvoiceStatus.PAID,
      issuedAt: new Date("2026-10-11T14:00:00.000Z"),
      items: [
        {
          description: "Room 202 (Executive Suite, 1 night)",
          quantity: new Prisma.Decimal("1.00"),
          unitPrice: new Prisma.Decimal("200.00"),
          lineTotal: new Prisma.Decimal("200.00"),
          itemType: InvoiceItemType.ROOM_CHARGE,
        },
        {
          description: "Room 103 (Deluxe Double, 1 night)",
          quantity: new Prisma.Decimal("1.00"),
          unitPrice: new Prisma.Decimal("120.00"),
          lineTotal: new Prisma.Decimal("120.00"),
          itemType: InvoiceItemType.ROOM_CHARGE,
        },
        {
          description: "Minibar & Dining Charges",
          quantity: new Prisma.Decimal("1.00"),
          unitPrice: new Prisma.Decimal("180.00"),
          lineTotal: new Prisma.Decimal("180.00"),
          itemType: InvoiceItemType.EXTRA_CHARGE,
        },
      ],
      payment: {
        amount: new Prisma.Decimal("500.00"),
        paymentMethod: "CASH",
        referenceNumber: "CASH-MRIN-5FDC",
        status: PaymentStatus.RECORDED,
        paidAt: new Date("2026-10-11T14:05:00.000Z"),
        createdBy: receptionistUser.id,
      },
    },
    {
      reservationNo: "RES-20261011-D228",
      invoiceNumber: "INV-20261011-D228",
      subtotal: new Prisma.Decimal("100.00"),
      grandTotal: new Prisma.Decimal("100.00"),
      status: InvoiceStatus.PAID,
      issuedAt: new Date("2026-10-11T10:31:55.000Z"),
      items: [
        {
          description: "Room 101 (Standard Single, 1 night)",
          quantity: new Prisma.Decimal("1.00"),
          unitPrice: new Prisma.Decimal("100.00"),
          lineTotal: new Prisma.Decimal("100.00"),
          itemType: InvoiceItemType.ROOM_CHARGE,
        },
      ],
      payment: {
        amount: new Prisma.Decimal("100.00"),
        paymentMethod: "CASH",
        referenceNumber: "CASH-JHB-D228",
        status: PaymentStatus.RECORDED,
        paidAt: new Date("2026-10-11T10:35:00.000Z"),
        createdBy: receptionistUser.id,
      },
    },
  ];

  for (const demo of demoInvoicesData) {
    const resv = await prisma.reservation.findUnique({
      where: { reservationNo: demo.reservationNo },
    });
    if (!resv) continue;

    const existingInvoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: demo.invoiceNumber },
      include: { payments: true, items: true },
    });

    if (!existingInvoice) {
      const inv = await prisma.invoice.create({
        data: {
          reservationId: resv.id,
          propertyId: resv.propertyId,
          invoiceNumber: demo.invoiceNumber,
          subtotal: demo.subtotal,
          discountTotal: new Prisma.Decimal("0.00"),
          taxTotal: new Prisma.Decimal("0.00"),
          grandTotal: demo.grandTotal,
          status: demo.status,
          issuedAt: demo.issuedAt,
          items: {
            create: demo.items,
          },
          payments: {
            create: {
              ...demo.payment,
              propertyId: resv.propertyId,
            },
          },
        },
      });
      console.log(`Restored invoice ${inv.invoiceNumber} (₹${inv.grandTotal}) with payment`);
    } else {
      // Update items to guarantee clean descriptions and timestamps
      await prisma.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          issuedAt: demo.issuedAt,
          grandTotal: demo.grandTotal,
          subtotal: demo.subtotal,
          status: demo.status,
        },
      });
      // Ensure item descriptions match (e.g. Deluxe Double for 6472)
      for (const item of demo.items) {
        const match = existingInvoice.items.find((i) => i.description.includes(item.description.slice(0, 8)));
        if (match) {
          await prisma.invoiceItem.update({
            where: { id: match.id },
            data: {
              description: item.description,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            },
          });
        }
      }
      // Ensure payment date
      if (existingInvoice.payments.length > 0) {
        await prisma.payment.update({
          where: { id: existingInvoice.payments[0].id },
          data: {
            paidAt: demo.payment.paidAt,
          },
        });
      }
    }
  }

  // 12. Migrate customer IDs and redact existing audit logs
  const customersWithId = await prisma.customer.findMany({
    where: { idProofNumber: { not: null } },
    select: { id: true, idProofNumber: true },
  });
  let migrated = 0;
  for (const c of customersWithId) {
    if (c.idProofNumber && c.idProofNumber.length > 4) {
      const last4 = c.idProofNumber.slice(-4);
      await prisma.customer.update({
        where: { id: c.id },
        data: { idProofNumber: last4 },
      });
      migrated++;
    }
  }

  const SENSITIVE_KEYS = new Set([
    "idproofnumber",
    "id_proof_number",
    "verifiedidnumber",
    "verified_id_number",
    "idnumber",
    "id_number",
    "governmentid",
    "government_id",
    "password",
    "passwordhash",
    "password_hash",
  ]);

  function sanitize(data: unknown): unknown {
    if (data === null || data === undefined) return data;
    if (typeof data !== "object") return data;
    if (Array.isArray(data)) return data.map(sanitize);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      const norm = k.toLowerCase().replace(/[-_]/g, "");
      if (SENSITIVE_KEYS.has(norm)) continue;
      result[k] = typeof v === "object" && v !== null ? sanitize(v) : v;
    }
    return result;
  }

  const logs = await prisma.auditLog.findMany({
    select: { id: true, oldData: true, newData: true },
  });
  let redacted = 0;
  for (const log of logs) {
    const hasOld = log.oldData !== null && log.oldData !== undefined;
    const hasNew = log.newData !== null && log.newData !== undefined;
    const cleanedOld = hasOld ? sanitize(log.oldData) : null;
    const cleanedNew = hasNew ? sanitize(log.newData) : null;
    const oldChanged = hasOld && JSON.stringify(cleanedOld) !== JSON.stringify(log.oldData);
    const newChanged = hasNew && JSON.stringify(cleanedNew) !== JSON.stringify(log.newData);
    if (oldChanged || newChanged) {
      await prisma.auditLog.update({
        where: { id: log.id },
        data: {
          ...(oldChanged ? { oldData: cleanedOld as Prisma.InputJsonValue } : {}),
          ...(newChanged ? { newData: cleanedNew as Prisma.InputJsonValue } : {}),
        },
      });
      redacted++;
    }
  }

  if (migrated > 0) console.log(`Migrated ${migrated} existing customer IDs to last-4`);
  if (redacted > 0) console.log(`Redacted ${redacted} audit log records`);

  // Final summary verification
  const totalRooms = await prisma.room.count();
  const totalCategories = await prisma.roomCategory.count();
  const totalInvoices = await prisma.invoice.count();
  const payments = await prisma.payment.findMany({ where: { status: PaymentStatus.RECORDED } });
  const totalCollected = payments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

  console.log(`\nFINAL DEV DB COUNTS:`);
  console.log(`rooms=${totalRooms}, categories=${totalCategories}, invoices=${totalInvoices}, total collected=${totalCollected}`);
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
