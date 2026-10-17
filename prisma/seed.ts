import {
  PrismaClient,
  RoleName,
  RoomStatus,
  InvoiceStatus,
  InvoiceItemType,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
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
    update: { mustChangePassword: true },
    create: {
      name: "System Administrator",
      email: "admin@byteinn.local",
      passwordHash: adminPasswordHash,
      roleId: adminRole.id,
      status: "ACTIVE",
      mustChangePassword: true,
    },
  });

  const receptionistUser = await prisma.user.upsert({
    where: { email: "reception@byteinn.local" },
    update: { mustChangePassword: true },
    create: {
      name: "Front Desk Staff",
      email: "reception@byteinn.local",
      passwordHash: receptionistPasswordHash,
      roleId: receptionistRole.id,
      status: "ACTIVE",
      mustChangePassword: true,
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
  console.log(`Room categories ensured (${categoryMap.size})`);

  // 8. Seed Rooms (Original 10 rooms across Main Wing & West Wing)
  const sampleRooms = [
    // Main Wing (6 rooms)
    {
      buildingId: mainWing.id,
      floorId: floor1Main.id,
      roomNo: "101",
      displayName: "Room 101 (Standard)",
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
      displayName: "Room 102 (Standard)",
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
      displayName: "Room 103 (Deluxe)",
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
      displayName: "Room 201 (Deluxe)",
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
      displayName: "Room 202 (Suite)",
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
      displayName: "Room 203 (Suite)",
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
      displayName: "Room 101 (Deluxe Suite)",
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
      displayName: "Room 102 (Deluxe Suite)",
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
      displayName: "Room 103 (Deluxe Suite)",
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
      displayName: "Room 104 (Deluxe Suite)",
      categoryName: "Deluxe Suite",
      capacity: 2,
      status: RoomStatus.VACANT_DIRTY,
      priceOverride: null,
      notes: null,
    },
  ];

  for (const r of sampleRooms) {
    const catId = categoryMap.get(r.categoryName);
    if (!catId) continue;

    await prisma.room.upsert({
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
  }
  console.log(`Sample rooms ensured (${sampleRooms.length})`);

  // 9. Restore Demo Invoices & Collections for Active Reservations
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
          description: "Room 101 (Standard Single, 17 nights)",
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
      issuedAt: new Date("2026-10-11T14:21:35.000Z"),
      items: [
        {
          description: "Room 103 (Deluxe Suite, 9 nights)",
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
        paidAt: new Date("2026-10-11T14:25:00.000Z"),
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
          description: "Room 103 (Deluxe Suite, 1 night)",
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
      include: { payments: true },
    });

    if (!existingInvoice) {
      const inv = await prisma.invoice.create({
        data: {
          reservationId: resv.id,
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
            create: demo.payment,
          },
        },
      });
      console.log(`Restored invoice ${inv.invoiceNumber} (₹${inv.grandTotal}) with payment`);
    }
  }

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
