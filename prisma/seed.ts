import {
  PrismaClient,
  RoleName,
  RoomStatus,
  InvoiceStatus,
  InvoiceItemType,
  ReceiptStatus,
  ReservationStatus,
  AllocationStatus,
  PaymentStatus,
  AccountType,
  ExpenseStatus,
  IncomeStatus,
  TransferStatus,
  Prisma,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding byteInn database...");

  // 0. Seed initialization
  console.log("Ensuring byteInn Grand Hotel demo fixtures...");

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

  // Ensure default financial account for the property
  let propertyAccount = await prisma.financialAccount.findFirst({
    where: { propertyId: property.id, isDefault: true },
  });
  if (!propertyAccount) {
    propertyAccount = await prisma.financialAccount.create({
      data: {
        propertyId: property.id,
        accountName: "Main Operating Drawer",
        accountType: "CASH",
        openingBalance: 10000,
        isDefault: true,
        isActive: true,
      },
    });
  }

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
        status: ReceiptStatus.RECORDED,
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
        status: ReceiptStatus.RECORDED,
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
        status: ReceiptStatus.RECORDED,
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
        status: ReceiptStatus.RECORDED,
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

    const propertyAccount = await prisma.financialAccount.findFirst({
      where: { propertyId: resv.propertyId },
    });

    const existingInvoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: demo.invoiceNumber },
      include: { receipts: true, items: true },
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
          receipts: {
            create: {
              accountId: propertyAccount!.id,
              amount: demo.payment.amount,
              paymentMethodCode: demo.payment.paymentMethod,
              referenceNumber: demo.payment.referenceNumber,
              status: ReceiptStatus.RECORDED,
              paidAt: demo.payment.paidAt,
              createdBy: demo.payment.createdBy,
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
      if (existingInvoice.receipts.length > 0) {
        await prisma.receipt.update({
          where: { id: existingInvoice.receipts[0].id },
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

  // --------------------------------------------------------------------------
  // 13. Realistic Multi-Month Financial & Operational Data (Stage 4 Expansion)
  // --------------------------------------------------------------------------
  if (isProduction && !process.env.FORCE_EXPANDED_SEED) {
    console.log("Production environment detected: Skipping Stage 4 demo transaction expansion.");
  } else {
    console.log("\n13. Seeding Multi-Month Financial Accounts, Direct Incomes, Expenses, and Transfers...");

    // 13.1 Ensure Financial Accounts
    const mainDrawer = await prisma.financialAccount.upsert({
      where: { propertyId_accountName: { propertyId: property.id, accountName: "Main Operating Drawer" } },
      update: { isDefault: true, isActive: true, openingBalance: new Prisma.Decimal("100000.00") },
      create: {
        propertyId: property.id,
        accountName: "Main Operating Drawer",
        accountType: AccountType.CASH,
        openingBalance: new Prisma.Decimal("100000.00"),
        openingBalanceDate: new Date("2026-08-01"),
        isDefault: true,
        isActive: true,
      },
    });

    const pettyCash = await prisma.financialAccount.upsert({
      where: { propertyId_accountName: { propertyId: property.id, accountName: "Front Desk Petty Cash" } },
      update: { isActive: true },
      create: {
        propertyId: property.id,
        accountName: "Front Desk Petty Cash",
        accountType: AccountType.CASH,
        openingBalance: new Prisma.Decimal("10000.00"),
        openingBalanceDate: new Date("2026-08-01"),
        isDefault: false,
        isActive: true,
      },
    });

    const hdfcBank = await prisma.financialAccount.upsert({
      where: { propertyId_accountName: { propertyId: property.id, accountName: "HDFC Bank Operating" } },
      update: { isActive: true },
      create: {
        propertyId: property.id,
        accountName: "HDFC Bank Operating",
        accountType: AccountType.BANK,
        openingBalance: new Prisma.Decimal("450000.00"),
        openingBalanceDate: new Date("2026-08-01"),
        isDefault: false,
        isActive: true,
      },
    });

    const sbiBank = await prisma.financialAccount.upsert({
      where: { propertyId_accountName: { propertyId: property.id, accountName: "SBI Current Account" } },
      update: { isActive: true },
      create: {
        propertyId: property.id,
        accountName: "SBI Current Account",
        accountType: AccountType.BANK,
        openingBalance: new Prisma.Decimal("200000.00"),
        openingBalanceDate: new Date("2026-08-01"),
        isDefault: false,
        isActive: true,
      },
    });

    console.log(`Financial accounts ensured: ${mainDrawer.accountName}, ${pettyCash.accountName}, ${hdfcBank.accountName}, ${sbiBank.accountName}`);

    // 13.2 Payment Methods
    const paymentMethodDefs = [
      { code: "CASH", name: "Cash Currency", defaultAccountId: mainDrawer.id },
      { code: "UPI", name: "Unified Payments Interface (UPI)", defaultAccountId: hdfcBank.id },
      { code: "CARD", name: "Credit / Debit Card Terminal", defaultAccountId: hdfcBank.id },
      { code: "BANK_TRANSFER", name: "Bank Transfer (NEFT/RTGS)", defaultAccountId: sbiBank.id },
    ];

    for (const pm of paymentMethodDefs) {
      await prisma.paymentMethod.upsert({
        where: { propertyId_code: { propertyId: property.id, code: pm.code } },
        update: { name: pm.name, defaultAccountId: pm.defaultAccountId, isActive: true },
        create: {
          propertyId: property.id,
          code: pm.code,
          name: pm.name,
          defaultAccountId: pm.defaultAccountId,
          isActive: true,
        },
      });
    }

    // 13.3 Standard Heads of Income
    const incomeHeadDefs = [
      { code: "BANQUET", name: "Banquet & Event Space Hire", description: "Conference halls, banquets, and celebration venues" },
      { code: "LAUNDRY", name: "Guest Laundry & Dry Cleaning", description: "Direct guest dry cleaning and pressing services" },
      { code: "CAB", name: "Airport Taxi & City Transfers", description: "Chauffeured guest transport and airport shuttles" },
      { code: "MISC", name: "Business Centre & Facilities", description: "Printing, secretarial services, and boardrooms" },
      { code: "SALVAGE", name: "Scrap & Linen Salvage", description: "Linen salvage, kitchen recycling, and discarded assets" },
    ];

    const incomeHeadMap = new Map<string, string>();
    for (const ih of incomeHeadDefs) {
      const head = await prisma.incomeHead.upsert({
        where: { propertyId_code: { propertyId: property.id, code: ih.code } },
        update: { name: ih.name, description: ih.description, isActive: true },
        create: {
          propertyId: property.id,
          code: ih.code,
          name: ih.name,
          description: ih.description,
          isActive: true,
        },
      });
      incomeHeadMap.set(ih.code, head.id);
    }

    // 13.4 Standard Heads of Expense
    const expenseHeadDefs = [
      { code: "HK_SUPPLIES", name: "Housekeeping & Linen Supplies", description: "Cleaning chemicals, bedsheets, and toiletries" },
      { code: "FNB_GROCERY", name: "F&B & Breakfast Groceries", description: "Dairy, provisions, beverages, and bakery" },
      { code: "UTIL_ELEC", name: "Electricity & Power Utility", description: "State electricity board utility bills and power diesel" },
      { code: "UTIL_WATER", name: "Water & Sanitation Utility", description: "Municipal water supply and tanker deliveries" },
      { code: "MAINTENANCE", name: "Property Repairs & HVAC Maintenance", description: "AC servicing, plumbing, and structural upkeep" },
      { code: "STAFF_WELFARE", name: "Staff Welfare & Uniforms", description: "Staff meals, uniforms, and medical provisions" },
      { code: "IT_SOFTWARE", name: "Software & IT Subscriptions", description: "Cloud PMS, Wi-Fi lease line, and IT support" },
    ];

    const expenseHeadMap = new Map<string, string>();
    for (const eh of expenseHeadDefs) {
      const head = await prisma.expenseHead.upsert({
        where: { propertyId_code: { propertyId: property.id, code: eh.code } },
        update: { name: eh.name, description: eh.description, isActive: true },
        create: {
          propertyId: property.id,
          code: eh.code,
          name: eh.name,
          description: eh.description,
          isActive: true,
        },
      });
      expenseHeadMap.set(eh.code, head.id);
    }

    // 13.5 Seed Direct Income Records (Aug - Nov 2026)
    const directIncomeFixtures = [
      // August 2026
      { ref: "INC-2026-08-01", title: "Corporate Seminar Space Rental", headCode: "BANQUET", amount: "35000.00", dateStr: "2026-08-10", status: IncomeStatus.RECEIVED, method: "UPI", accountId: hdfcBank.id },
      { ref: "INC-2026-08-02", title: "Bulk Dry Cleaning Service - Tech Mahindra", headCode: "LAUNDRY", amount: "8400.00", dateStr: "2026-08-14", status: IncomeStatus.RECEIVED, method: "CASH", accountId: mainDrawer.id },
      { ref: "INC-2026-08-03", title: "Airport VIP Transfer (Innova Crysta)", headCode: "CAB", amount: "3200.00", dateStr: "2026-08-18", status: IncomeStatus.RECEIVED, method: "CARD", accountId: hdfcBank.id },
      { ref: "INC-2026-08-04", title: "Boardroom Meeting Day Pass", headCode: "MISC", amount: "6500.00", dateStr: "2026-08-22", status: IncomeStatus.RECEIVED, method: "UPI", accountId: hdfcBank.id },
      { ref: "INC-2026-08-05", title: "Discarded Copper Wiring & Scrap Salvage", headCode: "SALVAGE", amount: "12500.00", dateStr: "2026-08-26", status: IncomeStatus.RECEIVED, method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "INC-2026-08-06", title: "Cocktail Reception Venue Booking", headCode: "BANQUET", amount: "45000.00", dateStr: "2026-08-28", status: IncomeStatus.VOID, voidReason: "Organizer cancelled 48h prior due to rain; deposit forfeited under separate folio", method: "UPI", accountId: hdfcBank.id },
      { ref: "INC-2026-08-07", title: "Express Uniform Pressing - Airline Crew", headCode: "LAUNDRY", amount: "5600.00", dateStr: "2026-08-30", status: IncomeStatus.RECEIVED, method: "CASH", accountId: mainDrawer.id },

      // September 2026
      { ref: "INC-2026-09-01", title: "Annual General Meeting Hall Hire", headCode: "BANQUET", amount: "60000.00", dateStr: "2026-09-04", status: IncomeStatus.RECEIVED, method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "INC-2026-09-02", title: "Airport Shuttle Transfers - 4 Trips", headCode: "CAB", amount: "7800.00", dateStr: "2026-09-08", status: IncomeStatus.RECEIVED, method: "UPI", accountId: hdfcBank.id },
      { ref: "INC-2026-09-03", title: "Old Banquet Chairs & Metal Scrap", headCode: "SALVAGE", amount: "9200.00", dateStr: "2026-09-12", status: IncomeStatus.RECEIVED, method: "CASH", accountId: mainDrawer.id },
      { ref: "INC-2026-09-04", title: "Guest Express Laundry Delegation", headCode: "LAUNDRY", amount: "4200.00", dateStr: "2026-09-15", status: IncomeStatus.RECEIVED, method: "CARD", accountId: hdfcBank.id },
      { ref: "INC-2026-09-05", title: "Product Launch Event Hall Advance", headCode: "BANQUET", amount: "50000.00", dateStr: "2026-09-19", status: IncomeStatus.RECEIVED, method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "INC-2026-09-06", title: "Conference Audio-Visual Tech Equipment", headCode: "MISC", amount: "8500.00", dateStr: "2026-09-22", status: IncomeStatus.VOID, voidReason: "Duplicate billing entry corrected by duty manager", method: "CASH", accountId: mainDrawer.id },
      { ref: "INC-2026-09-07", title: "Full Day Cab Hire - Guest Mr. Iyer", headCode: "CAB", amount: "4500.00", dateStr: "2026-09-26", status: IncomeStatus.RECEIVED, method: "CASH", accountId: mainDrawer.id },
      { ref: "INC-2026-09-08", title: "Quarterly Kitchen Oil Recycling Collection", headCode: "SALVAGE", amount: "7400.00", dateStr: "2026-09-29", status: IncomeStatus.RECEIVED, method: "UPI", accountId: hdfcBank.id },

      // October 2026
      { ref: "INC-2026-10-01", title: "Wedding Sangeet Hall Hire - Advance", headCode: "BANQUET", amount: "75000.00", dateStr: "2026-10-03", status: IncomeStatus.RECEIVED, method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "INC-2026-10-02", title: "Guest Laundry & Dry Cleaning Package", headCode: "LAUNDRY", amount: "6800.00", dateStr: "2026-10-07", status: IncomeStatus.RECEIVED, method: "CARD", accountId: hdfcBank.id },
      { ref: "INC-2026-10-03", title: "Airport Pickup Shuttle Service", headCode: "CAB", amount: "3600.00", dateStr: "2026-10-10", status: IncomeStatus.RECEIVED, method: "UPI", accountId: hdfcBank.id },
      { ref: "INC-2026-10-04", title: "Boardroom Day Rental - VC Pitch Day", headCode: "MISC", amount: "12000.00", dateStr: "2026-10-14", status: IncomeStatus.RECEIVED, method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "INC-2026-10-05", title: "Discarded Mattresses & Wood Scrap", headCode: "SALVAGE", amount: "8900.00", dateStr: "2026-10-18", status: IncomeStatus.RECEIVED, method: "CASH", accountId: mainDrawer.id },
      { ref: "INC-2026-10-06", title: "Fashion Exhibition Space Hire", headCode: "BANQUET", amount: "40000.00", dateStr: "2026-10-22", status: IncomeStatus.PENDING, method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "INC-2026-10-07", title: "Emergency Airport Drop - Early Flight", headCode: "CAB", amount: "2800.00", dateStr: "2026-10-25", status: IncomeStatus.RECEIVED, method: "CASH", accountId: mainDrawer.id },
      { ref: "INC-2026-10-08", title: "Guest Laundry Rush Order", headCode: "LAUNDRY", amount: "3900.00", dateStr: "2026-10-28", status: IncomeStatus.RECEIVED, method: "UPI", accountId: hdfcBank.id },
      { ref: "INC-2026-10-09", title: "Conference Projector Rental", headCode: "MISC", amount: "4500.00", dateStr: "2026-10-30", status: IncomeStatus.VOID, voidReason: "In-house AV failed; vendor waived charges and client was not billed", method: "CASH", accountId: mainDrawer.id },

      // November 2026
      { ref: "INC-2026-11-01", title: "Diwali Corporate Gala Hall Hire", headCode: "BANQUET", amount: "85000.00", dateStr: "2026-11-02", status: IncomeStatus.RECEIVED, method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "INC-2026-11-02", title: "Group Airport Shuttle - 6 Trips", headCode: "CAB", amount: "10500.00", dateStr: "2026-11-05", status: IncomeStatus.RECEIVED, method: "UPI", accountId: hdfcBank.id },
      { ref: "INC-2026-11-03", title: "Linen Dry Cleaning Service - Wedding Group", headCode: "LAUNDRY", amount: "9400.00", dateStr: "2026-11-08", status: IncomeStatus.RECEIVED, method: "CARD", accountId: hdfcBank.id },
      { ref: "INC-2026-11-04", title: "Executive Boardroom Rental", headCode: "MISC", amount: "14000.00", dateStr: "2026-11-10", status: IncomeStatus.RECEIVED, method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "INC-2026-11-05", title: "Doctor Association Conference Hall", headCode: "BANQUET", amount: "55000.00", dateStr: "2026-11-12", status: IncomeStatus.PENDING, method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "INC-2026-11-06", title: "Airport Drop Shuttle (Kia Carnival)", headCode: "CAB", amount: "4000.00", dateStr: "2026-11-14", status: IncomeStatus.RECEIVED, method: "UPI", accountId: hdfcBank.id },
    ];

    for (const inc of directIncomeFixtures) {
      const headId = incomeHeadMap.get(inc.headCode);
      if (!headId) continue;

      let income = await prisma.income.findFirst({
        where: { propertyId: property.id, description: inc.ref },
      });

      if (!income) {
        income = await prisma.income.create({
          data: {
            propertyId: property.id,
            incomeHeadId: headId,
            title: inc.title,
            description: inc.ref,
            expectedAmount: new Prisma.Decimal(inc.amount),
            incomeDate: new Date(inc.dateStr),
            status: inc.status,
            createdBy: adminUser.id,
            voidReason: inc.voidReason || null,
            voidedAt: inc.status === IncomeStatus.VOID ? new Date(`${inc.dateStr}T14:30:00Z`) : null,
            voidedBy: inc.status === IncomeStatus.VOID ? adminUser.id : null,
          },
        });

        // If RECEIVED, create corresponding Receipt
        if (inc.status === IncomeStatus.RECEIVED) {
          await prisma.receipt.create({
            data: {
              propertyId: property.id,
              incomeId: income.id,
              accountId: inc.accountId,
              paymentMethodCode: inc.method,
              amount: new Prisma.Decimal(inc.amount),
              referenceNumber: `REC-${inc.ref}`,
              idempotencyKey: `IDEMP-INC-${inc.ref}`,
              status: ReceiptStatus.RECORDED,
              paidAt: new Date(`${inc.dateStr}T10:00:00Z`),
              createdBy: adminUser.id,
            },
          });
        }
      }
    }
    console.log(`Direct Incomes ensured: ${directIncomeFixtures.length} items`);

    // 13.6 Seed Operating Expenses (Aug - Nov 2026)
    const operatingExpenseFixtures = [
      // August 2026
      { ref: "EXP-2026-08-01", title: "Housekeeping Chemicals & Cleaning Solvents", headCode: "HK_SUPPLIES", vendor: "CleanPro Industrial Chemicals", amount: "18500.00", dateStr: "2026-08-05", status: ExpenseStatus.PAID, paidAmount: "18500.00", method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-08-02", title: "Monthly Dairy, Butter & Cheese Supplies", headCode: "FNB_GROCERY", vendor: "Nandini Milk Products Co.", amount: "32400.00", dateStr: "2026-08-08", status: ExpenseStatus.PAID, paidAmount: "32400.00", method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-08-03", title: "BESCOM Grid Electricity Tariff - July", headCode: "UTIL_ELEC", vendor: "BESCOM Power Utility Ltd", amount: "64800.00", dateStr: "2026-08-12", status: ExpenseStatus.PAID, paidAmount: "64800.00", method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "EXP-2026-08-04", title: "Municipal Potable Water Tankers (12 Loads)", headCode: "UTIL_WATER", vendor: "Kaveri Water Supply Logistics", amount: "14400.00", dateStr: "2026-08-15", status: ExpenseStatus.PAID, paidAmount: "14400.00", method: "CASH", accountId: mainDrawer.id },
      { ref: "EXP-2026-08-05", title: "Chiller Plant Preventative Maintenance & Filters", headCode: "MAINTENANCE", vendor: "Voltas Air Conditioning Services", amount: "28000.00", dateStr: "2026-08-19", status: ExpenseStatus.PAID, paidAmount: "28000.00", method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-08-06", title: "Staff Uniforms Tailoring & Laundry Allowance", headCode: "STAFF_WELFARE", vendor: "Metro Stitch & Uniform Corp", amount: "12500.00", dateStr: "2026-08-22", status: ExpenseStatus.PAID, paidAmount: "12500.00", method: "CASH", accountId: pettyCash.id },
      { ref: "EXP-2026-08-07", title: "CloudPMS Subscription & Server Hosting", headCode: "IT_SOFTWARE", vendor: "byteInn Cloud Technologies Inc", amount: "15000.00", dateStr: "2026-08-25", status: ExpenseStatus.PAID, paidAmount: "15000.00", method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "EXP-2026-08-08", title: "Emergency Elevator Gearbox Repair", headCode: "MAINTENANCE", vendor: "Otis Elevator India Ltd", amount: "45000.00", dateStr: "2026-08-28", status: ExpenseStatus.VOID, voidReason: "Vendor invoiced wrong rate variance; reissued under new PO 8842", method: "BANK_TRANSFER", accountId: hdfcBank.id },

      // September 2026
      { ref: "EXP-2026-09-01", title: "Linen Restocking (Towels & Bedding Sets)", headCode: "HK_SUPPLIES", vendor: "Bombay Dyeing Commercial Textiles", amount: "38000.00", dateStr: "2026-09-04", status: ExpenseStatus.PAID, paidAmount: "38000.00", method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-09-02", title: "Monthly Bakery & Breakfast Provisions", headCode: "FNB_GROCERY", vendor: "Golden Harvest Grain Suppliers", amount: "27500.00", dateStr: "2026-09-07", status: ExpenseStatus.PAID, paidAmount: "27500.00", method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-09-03", title: "BESCOM Grid Electricity Tariff - August", headCode: "UTIL_ELEC", vendor: "BESCOM Power Utility Ltd", amount: "72100.00", dateStr: "2026-09-11", status: ExpenseStatus.PAID, paidAmount: "72100.00", method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "EXP-2026-09-04", title: "Water Supply & Water Softener Salt Pellets", headCode: "UTIL_WATER", vendor: "Kaveri Water Supply Logistics", amount: "16200.00", dateStr: "2026-09-15", status: ExpenseStatus.PAID, paidAmount: "16200.00", method: "CASH", accountId: mainDrawer.id },
      { ref: "EXP-2026-09-05", title: "Diesel for DG Backup Generators (1000L)", headCode: "UTIL_ELEC", vendor: "Indian Oil Commercial Depot", amount: "48000.00", dateStr: "2026-09-18", status: ExpenseStatus.PAID, paidAmount: "48000.00", method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-09-06", title: "Staff Annual Health Checkup & Medical Kits", headCode: "STAFF_WELFARE", vendor: "Apollo Healthcare Diagnostic Centre", amount: "18000.00", dateStr: "2026-09-22", status: ExpenseStatus.PAID, paidAmount: "18000.00", method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "EXP-2026-09-07", title: "Fibre Internet Lease Line & Wi-Fi Access Points", headCode: "IT_SOFTWARE", vendor: "Airtel Business Enterprise", amount: "14200.00", dateStr: "2026-09-26", status: ExpenseStatus.PAID, paidAmount: "14200.00", method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-09-08", title: "Bathroom Plumbing Overhaul - Floor 3", headCode: "MAINTENANCE", vendor: "Sri Balaji Plumbing Works", amount: "22000.00", dateStr: "2026-09-29", status: ExpenseStatus.PARTIALLY_PAID, paidAmount: "12000.00", method: "CASH", accountId: mainDrawer.id },

      // October 2026
      { ref: "EXP-2026-10-01", title: "Housekeeping Toiletries, Soaps & Dental Kits", headCode: "HK_SUPPLIES", vendor: "GuestAmenities Direct Ltd", amount: "24600.00", dateStr: "2026-10-04", status: ExpenseStatus.PAID, paidAmount: "24600.00", method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-10-02", title: "F&B Fresh Meats, Poultry & Seafood Restock", headCode: "FNB_GROCERY", vendor: "Bangalore Cold Chain Logistics", amount: "36800.00", dateStr: "2026-10-08", status: ExpenseStatus.PAID, paidAmount: "36800.00", method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-10-03", title: "BESCOM Grid Electricity Tariff - September", headCode: "UTIL_ELEC", vendor: "BESCOM Power Utility Ltd", amount: "69400.00", dateStr: "2026-10-12", status: ExpenseStatus.PAID, paidAmount: "69400.00", method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "EXP-2026-10-04", title: "Swimming Pool Cleaning & Water Testing", headCode: "MAINTENANCE", vendor: "AquaClear Water Solutions", amount: "9800.00", dateStr: "2026-10-16", status: ExpenseStatus.PAID, paidAmount: "9800.00", method: "CASH", accountId: pettyCash.id },
      { ref: "EXP-2026-10-05", title: "Fire Safety Equipment Bi-Annual Inspection", headCode: "MAINTENANCE", vendor: "Ceasefire Industries Safety Corp", amount: "16500.00", dateStr: "2026-10-20", status: ExpenseStatus.PAID, paidAmount: "16500.00", method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-10-06", title: "Staff Diwali Sweets & Festive Hampers", headCode: "STAFF_WELFARE", vendor: "Anand Sweets & Savouries", amount: "28500.00", dateStr: "2026-10-24", status: ExpenseStatus.PAID, paidAmount: "28500.00", method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-10-07", title: "Front-Desk Thermal Receipt Paper & Stationery", headCode: "HK_SUPPLIES", vendor: "Vanguard Office Stationery", amount: "5400.00", dateStr: "2026-10-27", status: ExpenseStatus.PAID, paidAmount: "5400.00", method: "CASH", accountId: pettyCash.id },
      { ref: "EXP-2026-10-08", title: "Marble Floor Crystallization & Polishing", headCode: "MAINTENANCE", vendor: "ShineStone Polishing Experts", amount: "32000.00", dateStr: "2026-10-30", status: ExpenseStatus.PARTIALLY_PAID, paidAmount: "16000.00", method: "BANK_TRANSFER", accountId: sbiBank.id },

      // November 2026
      { ref: "EXP-2026-11-01", title: "F&B Imported Gourmet Ingredients & Cheeses", headCode: "FNB_GROCERY", vendor: "European Gourmet Foods Ltd", amount: "44000.00", dateStr: "2026-11-03", status: ExpenseStatus.PAID, paidAmount: "44000.00", method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-11-02", title: "BESCOM Grid Electricity Tariff - October", headCode: "UTIL_ELEC", vendor: "BESCOM Power Utility Ltd", amount: "78200.00", dateStr: "2026-11-06", status: ExpenseStatus.PAID, paidAmount: "78200.00", method: "BANK_TRANSFER", accountId: sbiBank.id },
      { ref: "EXP-2026-11-03", title: "Water Supply & Tanker Deliveries", headCode: "UTIL_WATER", vendor: "Kaveri Water Supply Logistics", amount: "15800.00", dateStr: "2026-11-08", status: ExpenseStatus.PAID, paidAmount: "15800.00", method: "CASH", accountId: mainDrawer.id },
      { ref: "EXP-2026-11-04", title: "Deep Kitchen Extraction Duct Degreasing", headCode: "MAINTENANCE", vendor: "AirVent Specialist Cleaning Services", amount: "21000.00", dateStr: "2026-11-10", status: ExpenseStatus.PAID, paidAmount: "21000.00", method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-11-05", title: "Monthly Housekeeping Cleaning Chemical Refill", headCode: "HK_SUPPLIES", vendor: "CleanPro Industrial Chemicals", amount: "19200.00", dateStr: "2026-11-12", status: ExpenseStatus.PENDING, method: "BANK_TRANSFER", accountId: hdfcBank.id },
      { ref: "EXP-2026-11-06", title: "Staff Cafeteria Monthly Provisions", headCode: "STAFF_WELFARE", vendor: "South Kitchen Grain Mart", amount: "22500.00", dateStr: "2026-11-14", status: ExpenseStatus.PENDING, method: "BANK_TRANSFER", accountId: sbiBank.id },
    ];

    for (const exp of operatingExpenseFixtures) {
      const headId = expenseHeadMap.get(exp.headCode);
      if (!headId) continue;

      let expense = await prisma.expense.findFirst({
        where: { propertyId: property.id, referenceNumber: exp.ref },
      });

      if (!expense) {
        expense = await prisma.expense.create({
          data: {
            propertyId: property.id,
            expenseHeadId: headId,
            title: exp.title,
            description: exp.title,
            vendorName: exp.vendor,
            referenceNumber: exp.ref,
            amount: new Prisma.Decimal(exp.amount),
            expenseDate: new Date(exp.dateStr),
            status: exp.status,
            createdBy: adminUser.id,
            voidReason: exp.voidReason || null,
            voidedAt: exp.status === ExpenseStatus.VOID ? new Date(`${exp.dateStr}T16:00:00Z`) : null,
            voidedBy: exp.status === ExpenseStatus.VOID ? adminUser.id : null,
          },
        });

        // If PAID or PARTIALLY_PAID, record Payment
        if (exp.paidAmount && (exp.status === ExpenseStatus.PAID || exp.status === ExpenseStatus.PARTIALLY_PAID)) {
          await prisma.payment.create({
            data: {
              propertyId: property.id,
              expenseId: expense.id,
              accountId: exp.accountId,
              paymentMethodCode: exp.method,
              amount: new Prisma.Decimal(exp.paidAmount),
              referenceNumber: `PAY-${exp.ref}`,
              idempotencyKey: `IDEMP-PAY-${exp.ref}`,
              status: PaymentStatus.RECORDED,
              paidAt: new Date(`${exp.dateStr}T11:00:00Z`),
              createdBy: adminUser.id,
            },
          });
        }
      }
    }
    console.log(`Operating Expenses ensured: ${operatingExpenseFixtures.length} items`);

    // 13.7 Seed Account Transfers (Aug - Nov 2026)
    const transferFixtures = [
      // Weekly cash deposits: Main Operating Drawer -> HDFC Bank Operating
      { ref: "TRF-2026-08-01", fromId: mainDrawer.id, toId: hdfcBank.id, amount: "5000.00", dateStr: "2026-08-09", description: "Weekly cash drawer deposit to HDFC Bank" },
      { ref: "TRF-2026-08-02", fromId: mainDrawer.id, toId: hdfcBank.id, amount: "6000.00", dateStr: "2026-08-16", description: "Weekly cash drawer deposit to HDFC Bank" },
      { ref: "TRF-2026-08-03", fromId: mainDrawer.id, toId: hdfcBank.id, amount: "5500.00", dateStr: "2026-08-23", description: "Weekly cash drawer deposit to HDFC Bank" },
      { ref: "TRF-2026-08-04", fromId: mainDrawer.id, toId: hdfcBank.id, amount: "6500.00", dateStr: "2026-08-30", description: "Weekly cash drawer deposit to HDFC Bank" },
      { ref: "TRF-2026-09-01", fromId: mainDrawer.id, toId: hdfcBank.id, amount: "6000.00", dateStr: "2026-09-06", description: "Weekly cash drawer deposit to HDFC Bank" },
      { ref: "TRF-2026-09-02", fromId: mainDrawer.id, toId: hdfcBank.id, amount: "7000.00", dateStr: "2026-09-13", description: "Weekly cash drawer deposit to HDFC Bank" },
      { ref: "TRF-2026-09-03", fromId: mainDrawer.id, toId: hdfcBank.id, amount: "7500.00", dateStr: "2026-09-20", description: "Weekly cash drawer deposit to HDFC Bank" },
      { ref: "TRF-2026-10-01", fromId: mainDrawer.id, toId: hdfcBank.id, amount: "8000.00", dateStr: "2026-10-04", description: "Weekly cash drawer deposit to HDFC Bank" },
      { ref: "TRF-2026-10-02", fromId: mainDrawer.id, toId: hdfcBank.id, amount: "8500.00", dateStr: "2026-10-18", description: "Weekly cash drawer deposit to HDFC Bank" },
      { ref: "TRF-2026-11-01", fromId: mainDrawer.id, toId: hdfcBank.id, amount: "8000.00", dateStr: "2026-11-08", description: "Weekly cash drawer deposit to HDFC Bank" },

      // Monthly Petty Cash Replenishments: HDFC Bank -> Front Desk Petty Cash
      { ref: "TRF-2026-08-PC", fromId: hdfcBank.id, toId: pettyCash.id, amount: "6000.00", dateStr: "2026-08-15", description: "Petty cash monthly replenishment from HDFC Bank" },
      { ref: "TRF-2026-09-PC", fromId: hdfcBank.id, toId: pettyCash.id, amount: "6500.00", dateStr: "2026-09-15", description: "Petty cash monthly replenishment from HDFC Bank" },
      { ref: "TRF-2026-10-PC", fromId: hdfcBank.id, toId: pettyCash.id, amount: "7500.00", dateStr: "2026-10-15", description: "Petty cash festive month replenishment" },
      { ref: "TRF-2026-11-PC", fromId: hdfcBank.id, toId: pettyCash.id, amount: "6000.00", dateStr: "2026-11-10", description: "Petty cash monthly replenishment from HDFC Bank" },

      // Inter-bank Treasury Transfers: HDFC Bank -> SBI Current Account
      { ref: "TRF-2026-08-IB", fromId: hdfcBank.id, toId: sbiBank.id, amount: "40000.00", dateStr: "2026-08-20", description: "Treasury balance transfer for statutory utilities account" },
      { ref: "TRF-2026-09-IB", fromId: hdfcBank.id, toId: sbiBank.id, amount: "40000.00", dateStr: "2026-09-20", description: "Treasury balance transfer for electricity obligations" },
      { ref: "TRF-2026-10-IB", fromId: hdfcBank.id, toId: sbiBank.id, amount: "40000.00", dateStr: "2026-10-20", description: "Treasury balance transfer for vendor payouts" },
    ];

    for (const trf of transferFixtures) {
      const existing = await prisma.accountTransfer.findFirst({
        where: { propertyId: property.id, referenceNumber: trf.ref },
      });

      if (!existing) {
        await prisma.accountTransfer.create({
          data: {
            propertyId: property.id,
            fromAccountId: trf.fromId,
            toAccountId: trf.toId,
            amount: new Prisma.Decimal(trf.amount),
            transferDate: new Date(trf.dateStr),
            description: trf.description,
            referenceNumber: trf.ref,
            status: TransferStatus.COMPLETED,
            createdBy: adminUser.id,
          },
        });
      } else {
        await prisma.accountTransfer.update({
          where: { id: existing.id },
          data: {
            amount: new Prisma.Decimal(trf.amount),
            description: trf.description,
            transferDate: new Date(trf.dateStr),
          },
        });
      }
    }
    console.log(`Account Transfers ensured: ${transferFixtures.length} transactions`);

    // 13.8 Seed Additional Historical Multi-Item Folio Reservations & Receipts
    const roomsList = await prisma.room.findMany({
      where: { building: { propertyId: property.id } },
      include: { category: true },
      take: 8,
    });

    const historicalGuests = [
      { firstName: "Vikram", lastName: "Aditya", phone: "+91 98450 11001", email: "vikram.aditya@example.com", city: "Hyderabad" },
      { firstName: "Priya", lastName: "Nambiar", phone: "+91 98450 11002", email: "priya.nambiar@example.com", city: "Kochi" },
      { firstName: "Siddharth", lastName: "Mehta", phone: "+91 98450 11003", email: "siddharth.mehta@example.com", city: "Mumbai" },
      { firstName: "Kavita", lastName: "Krishnan", phone: "+91 98450 11004", email: "kavita.krishnan@example.com", city: "Chennai" },
      { firstName: "Arun", lastName: "Deshmukh", phone: "+91 98450 11005", email: "arun.deshmukh@example.com", city: "Pune" },
    ];

    const guestMap = new Map<string, string>();
    for (const g of historicalGuests) {
      let cust = await prisma.customer.findFirst({
        where: { phone: g.phone },
      });
      if (!cust) {
        cust = await prisma.customer.create({
          data: {
            firstName: g.firstName,
            lastName: g.lastName,
            phone: g.phone,
            email: g.email,
            address: g.city,
            registeredPropertyId: property.id,
          },
        });
      }
      guestMap.set(g.phone, cust.id);
    }

    if (roomsList.length > 0) {
      const historicalBookings = [
        {
          resNo: "RES-2026-AUG-101",
          invNo: "INV-2026-AUG-101",
          phone: "+91 98450 11001",
          room: roomsList[0],
          arrival: "2026-08-12",
          departure: "2026-08-15",
          nights: 3,
          rate: "3500.00",
          fb: "1800.00",
          laundry: "650.00",
          status: ReservationStatus.COMPLETED,
          invStatus: InvoiceStatus.PAID,
          paymentMethod: "UPI",
          account: hdfcBank,
        },
        {
          resNo: "RES-2026-SEP-201",
          invNo: "INV-2026-SEP-201",
          phone: "+91 98450 11002",
          room: roomsList[1],
          arrival: "2026-09-10",
          departure: "2026-09-13",
          nights: 3,
          rate: "4200.00",
          fb: "2400.00",
          laundry: "800.00",
          status: ReservationStatus.COMPLETED,
          invStatus: InvoiceStatus.PAID,
          paymentMethod: "CARD",
          account: hdfcBank,
        },
        {
          resNo: "RES-2026-OCT-301",
          invNo: "INV-2026-OCT-301",
          phone: "+91 98450 11003",
          room: roomsList[2],
          arrival: "2026-10-05",
          departure: "2026-10-08",
          nights: 3,
          rate: "3800.00",
          fb: "1500.00",
          laundry: "500.00",
          status: ReservationStatus.COMPLETED,
          invStatus: InvoiceStatus.PARTIALLY_PAID, // Receivables test case!
          paymentMethod: "UPI",
          partialAmount: "8000.00", // Grand total is 13400, leaving 5400 balance due
          account: hdfcBank,
        },
        {
          resNo: "RES-2026-OCT-302",
          invNo: "INV-2026-OCT-302",
          phone: "+91 98450 11004",
          room: roomsList[3],
          arrival: "2026-10-18",
          departure: "2026-10-21",
          nights: 3,
          rate: "4500.00",
          fb: "2200.00",
          laundry: "900.00",
          status: ReservationStatus.COMPLETED,
          invStatus: InvoiceStatus.PAID,
          paymentMethod: "BANK_TRANSFER",
          account: sbiBank,
          hasVoidedReceipt: true, // Audit trail & void reversal test case!
        },
        {
          resNo: "RES-2026-NOV-401",
          invNo: "INV-2026-NOV-401",
          phone: "+91 98450 11005",
          room: roomsList[4],
          arrival: "2026-11-08",
          departure: "2026-11-11",
          nights: 3,
          rate: "4000.00",
          fb: "1600.00",
          laundry: "700.00",
          status: ReservationStatus.COMPLETED,
          invStatus: InvoiceStatus.PARTIALLY_PAID, // Departed receivable!
          paymentMethod: "CASH",
          partialAmount: "8000.00", // Grand total is 14300, leaving 6300 balance due
          account: mainDrawer,
        },
      ];

      for (const hb of historicalBookings) {
        const custId = guestMap.get(hb.phone);
        if (!custId) continue;

        let resv = await prisma.reservation.findUnique({
          where: { reservationNo: hb.resNo },
        });

        if (!resv) {
          resv = await prisma.reservation.create({
            data: {
              propertyId: property.id,
              customerId: custId,
              reservationNo: hb.resNo,
              status: hb.status,
              createdBy: receptionistUser.id,
              createdAt: new Date(`${hb.arrival}T08:00:00Z`),
            },
          });

          await prisma.reservationRoom.create({
            data: {
              reservationId: resv.id,
              roomId: hb.room.id,
              roomCategoryId: hb.room.roomCategoryId,
              arrivalDate: new Date(`${hb.arrival}T00:00:00.000Z`),
              departureDate: new Date(`${hb.departure}T00:00:00.000Z`),
              bookedNightlyRate: new Prisma.Decimal(hb.rate),
              status: AllocationStatus.CHECKED_OUT,
              checkedInAt: new Date(`${hb.arrival}T13:00:00Z`),
              checkedOutAt: new Date(`${hb.departure}T11:00:00Z`),
            },
          });
        }

        const existingInv = await prisma.invoice.findUnique({
          where: { invoiceNumber: hb.invNo },
        });

        if (!existingInv) {
          const roomTotal = new Prisma.Decimal(hb.rate).mul(hb.nights);
          const fbTotal = new Prisma.Decimal(hb.fb);
          const laundryTotal = new Prisma.Decimal(hb.laundry);
          const grandTotal = roomTotal.add(fbTotal).add(laundryTotal);

          const inv = await prisma.invoice.create({
            data: {
              reservationId: resv.id,
              propertyId: property.id,
              invoiceNumber: hb.invNo,
              subtotal: grandTotal,
              discountTotal: new Prisma.Decimal("0.00"),
              taxTotal: new Prisma.Decimal("0.00"),
              grandTotal,
              status: hb.invStatus,
              issuedAt: new Date(`${hb.departure}T10:30:00Z`),
              items: {
                create: [
                  {
                    description: `Room Charge - ${hb.room.roomNo} (${hb.nights} Nights)`,
                    quantity: hb.nights,
                    unitPrice: new Prisma.Decimal(hb.rate),
                    lineTotal: roomTotal,
                    itemType: InvoiceItemType.ROOM_CHARGE,
                  },
                  {
                    description: "Breakfast Buffet & Dining Charges",
                    quantity: 1,
                    unitPrice: fbTotal,
                    lineTotal: fbTotal,
                    itemType: InvoiceItemType.EXTRA_CHARGE,
                  },
                  {
                    description: "Guest Express Laundry Services",
                    quantity: 1,
                    unitPrice: laundryTotal,
                    lineTotal: laundryTotal,
                    itemType: InvoiceItemType.EXTRA_CHARGE,
                  },
                ],
              },
            },
          });

          // Voided receipt scenario for audit trail
          if (hb.hasVoidedReceipt) {
            await prisma.receipt.create({
              data: {
                propertyId: property.id,
                invoiceId: inv.id,
                accountId: hb.account.id,
                paymentMethodCode: hb.paymentMethod,
                amount: grandTotal,
                referenceNumber: `REC-ERR-${hb.invNo}`,
                idempotencyKey: `IDEMP-ERR-${hb.invNo}`,
                status: ReceiptStatus.VOIDED,
                paidAt: new Date(`${hb.departure}T10:45:00Z`),
                voidReason: "Payment recorded against wrong customer folio; reversed by receptionist",
                voidedAt: new Date(`${hb.departure}T10:50:00Z`),
                voidedBy: adminUser.id,
                createdBy: receptionistUser.id,
              },
            });
          }

          // Legitimate receipt
          const paidAmount = hb.partialAmount ? new Prisma.Decimal(hb.partialAmount) : grandTotal;
          await prisma.receipt.create({
            data: {
              propertyId: property.id,
              invoiceId: inv.id,
              accountId: hb.account.id,
              paymentMethodCode: hb.paymentMethod,
              amount: paidAmount,
              referenceNumber: `REC-${hb.invNo}`,
              idempotencyKey: `IDEMP-REC-${hb.invNo}`,
              status: ReceiptStatus.RECORDED,
              paidAt: new Date(`${hb.departure}T10:55:00Z`),
              createdBy: receptionistUser.id,
            },
          });
        }
      }
      console.log(`Historical folio reservations ensured: ${historicalBookings.length} bookings`);
    }
  }

  // Final summary verification & derived account balances report
  const totalRooms = await prisma.room.count();
  const totalCategories = await prisma.roomCategory.count();
  const totalInvoices = await prisma.invoice.count();
  const totalIncomes = await prisma.income.count();
  const totalExpenses = await prisma.expense.count();
  const totalPayments = await prisma.payment.count();
  const totalTransfers = await prisma.accountTransfer.count();
  const receipts = await prisma.receipt.findMany({ where: { status: ReceiptStatus.RECORDED } });
  const totalCollected = receipts.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

  console.log(`\n================================================================================`);
  console.log(`📊 FINAL DEV DATABASE ENTITY COUNTS:`);
  console.log(`================================================================================`);
  console.log(`Rooms:             ${totalRooms}`);
  console.log(`Categories:        ${totalCategories}`);
  console.log(`Invoices:          ${totalInvoices}`);
  console.log(`Receipts Recorded: ${receipts.length} (Total Collected: ₹${totalCollected.toLocaleString()})`);
  console.log(`Direct Incomes:    ${totalIncomes}`);
  console.log(`Expenses:          ${totalExpenses}`);
  console.log(`Outgoing Payments: ${totalPayments}`);
  console.log(`Account Transfers: ${totalTransfers}`);

  console.log(`\n================================================================================`);
  console.log(`💰 DERIVED FINANCIAL ACCOUNT BALANCES:`);
  console.log(`================================================================================`);
  const accounts = await prisma.financialAccount.findMany({
    where: { propertyId: property.id },
    orderBy: { accountName: "asc" },
  });

  for (const acc of accounts) {
    const recSum = await prisma.receipt.aggregate({
      where: { propertyId: property.id, accountId: acc.id, status: ReceiptStatus.RECORDED },
      _sum: { amount: true },
    });
    const paySum = await prisma.payment.aggregate({
      where: { propertyId: property.id, accountId: acc.id, status: PaymentStatus.RECORDED },
      _sum: { amount: true },
    });
    const trfIn = await prisma.accountTransfer.aggregate({
      where: { propertyId: property.id, toAccountId: acc.id, status: TransferStatus.COMPLETED },
      _sum: { amount: true },
    });
    const trfOut = await prisma.accountTransfer.aggregate({
      where: { propertyId: property.id, fromAccountId: acc.id, status: TransferStatus.COMPLETED },
      _sum: { amount: true },
    });

    const open = new Prisma.Decimal(acc.openingBalance);
    const inRec = recSum._sum.amount || new Prisma.Decimal(0);
    const inTrf = trfIn._sum.amount || new Prisma.Decimal(0);
    const outPay = paySum._sum.amount || new Prisma.Decimal(0);
    const outTrf = trfOut._sum.amount || new Prisma.Decimal(0);

    const derivedBalance = open.add(inRec).add(inTrf).sub(outPay).sub(outTrf);

    console.log(`\n• [${acc.accountName}] (${acc.accountType}):`);
    console.log(`    Opening Balance:      ₹${open.toFixed(2)}`);
    console.log(`    Receipt Inflows (+):  ₹${inRec.toFixed(2)}`);
    console.log(`    Transfers In (+):     ₹${inTrf.toFixed(2)}`);
    console.log(`    Payments Out (-):     ₹${outPay.toFixed(2)}`);
    console.log(`    Transfers Out (-):    ₹${outTrf.toFixed(2)}`);
    console.log(`    ---------------------------------------------`);
    console.log(`    => Derived Balance:   ₹${derivedBalance.toFixed(2)}`);
  }
  console.log(`================================================================================\n`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
