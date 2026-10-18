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
import crypto from "node:crypto";

const prisma = new PrismaClient();

// Fast deterministic pseudo-random number generator (Mulberry32)
function createRng(seed: number) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRng(108);

function randomInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

// Generates a 25-character CUID-compatible unique string
let idCounter = 1000000;
function generateId(prefix: string): string {
  idCounter++;
  const hex = crypto.createHash("md5").update(`${prefix}_${idCounter}_${rng()}`).digest("hex");
  return `c${prefix.toLowerCase()}${hex.slice(0, 20)}`;
}

// Chunk helper for batch inserts
async function insertChunks<T>(
  label: string,
  items: T[],
  chunkSize: number,
  insertFn: (chunk: T[]) => Promise<unknown>
) {
  const total = items.length;
  let inserted = 0;
  const start = Date.now();

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await insertFn(chunk);
    inserted += chunk.length;
    process.stdout.write(
      `\r  ⏳ ${label}: ${inserted.toLocaleString()} / ${total.toLocaleString()} rows (${Math.round((inserted / total) * 100)}%)`
    );
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\r  ✓ ${label}: ${total.toLocaleString()} rows inserted in ${duration}s`);
}

// Data pools for realistic generation
const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
  "Shaurya", "Atharva", "Advik", "Pranav", "Kabir", "Ananya", "Diya", "Saanvi", "Myra", "Aadhya",
  "Aarohi", "Anvi", "Pari", "Isha", "Navya", "Riya", "Avani", "Tanvi", "Sia", "Mira",
  "Alexander", "Benjamin", "Charlotte", "Daniel", "Emily", "Felix", "Gabriel", "Hannah", "Isabella", "James",
  "Liam", "Lucas", "Maya", "Noah", "Olivia", "Sophia", "Thomas", "Victoria", "William", "Zoe",
  "Tariq", "Fatima", "Kenji", "Hana", "Chen", "Mei", "Rashid", "Layla", "Vikram", "Priyanka"
];

const LAST_NAMES = [
  "Sharma", "Verma", "Patel", "Reddy", "Nair", "Menon", "Rao", "Iyer", "Mukherjee", "Chatterjee",
  "Bose", "Das", "Banerjee", "Kapoor", "Khan", "Malhotra", "Mehta", "Deshmukh", "Kulkarni", "Joshi",
  "Bhat", "Hegde", "Pillai", "Kurian", "Chawla", "Singhania", "Ambani", "Birla", "Tata", "Godrej",
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Al-Mansoor", "Takahashi", "Watanabe", "Tanaka", "Suzuki", "Wang", "Zhang", "Liu", "Chen", "Yang"
];

const CITIES = [
  { city: "Bengaluru", state: "Karnataka", country: "India" },
  { city: "Mumbai", state: "Maharashtra", country: "India" },
  { city: "New Delhi", state: "Delhi", country: "India" },
  { city: "Hyderabad", state: "Telangana", country: "India" },
  { city: "Chennai", state: "Tamil Nadu", country: "India" },
  { city: "Kolkata", state: "West Bengal", country: "India" },
  { city: "Jaipur", state: "Rajasthan", country: "India" },
  { city: "Panaji", state: "Goa", country: "India" },
  { city: "Kochi", state: "Kerala", country: "India" },
  { city: "Pune", state: "Maharashtra", country: "India" },
  { city: "London", state: "Greater London", country: "United Kingdom" },
  { city: "New York", state: "New York", country: "United States" },
  { city: "San Francisco", state: "California", country: "United States" },
  { city: "Singapore", state: "Singapore", country: "Singapore" },
  { city: "Dubai", state: "Dubai", country: "United Arab Emirates" },
  { city: "Frankfurt", state: "Hesse", country: "Germany" },
  { city: "Tokyo", state: "Kanto", country: "Japan" },
  { city: "Sydney", state: "New South Wales", country: "Australia" },
];

const SPECIAL_REQUESTS = [
  "High floor quiet room away from elevators requested.",
  "Late checkout at 2:00 PM pre-approved for corporate account.",
  "Extra feather-free hypoallergenic pillows and warm blanket.",
  "Early morning airport shuttle transfer requested at 6:00 AM.",
  "Anniversary celebration: complimentary fruit basket & welcome note.",
  "Ground floor accessible accommodation preferred.",
  "Corner suite with panoramic skyline view requested.",
  "Baby cot and electric kettle requested in room.",
  "VIP guest: express private check-in at executive lounge.",
  null, null, null, null, null, null, null, // Most bookings have no special request
];

const EXTRA_SERVICES = [
  { desc: "Airport Luxury Chauffeur Transfer (Mercedes E-Class)", unitPrice: 2800, type: InvoiceItemType.EXTRA_CHARGE },
  { desc: "Fine Dining Restaurant Folio — The Maharaja Pavilion", unitPrice: 3450, type: InvoiceItemType.EXTRA_CHARGE },
  { desc: "Ayurvedic Herbal Rejuvenation Full-Body Spa (90 min)", unitPrice: 4200, type: InvoiceItemType.EXTRA_CHARGE },
  { desc: "Executive Laundry & Dry Cleaning Express Service", unitPrice: 950, type: InvoiceItemType.EXTRA_CHARGE },
  { desc: "In-Room Artisanal High Tea & Canapé Service", unitPrice: 1200, type: InvoiceItemType.EXTRA_CHARGE },
  { desc: "Minibar Gourmet Selection & Premium Refreshments", unitPrice: 1650, type: InvoiceItemType.EXTRA_CHARGE },
];

const SITES_CONFIG = [
  { code: "BLR", name: "The Grand Orchid Heritage Palace & Ayurvedic Wellness Resort", city: "Bengaluru", state: "Karnataka" },
  { code: "BOM", name: "The Regent Bay Panoramic Marina & Executive Suites", city: "Mumbai", state: "Maharashtra" },
  { code: "DEL", name: "The Imperial Diplomatic Enclave & Presidential Residence", city: "New Delhi", state: "Delhi" },
  { code: "GOA", name: "Sunset Palms Coastal Beachfront Villa & Lagoon Enclave", city: "Panaji", state: "Goa" },
  { code: "KER", name: "Kumarakom Emerald Backwaters & Ayurvedic Pavilion", city: "Kottayam", state: "Kerala" },
  { code: "JAI", name: "The Rajputana Royal Fort & Amber Palace Heritage Enclave", city: "Jaipur", state: "Rajasthan" },
  { code: "HYD", name: "The Deccan Heights Tech Park & Sovereign Club Towers", city: "Hyderabad", state: "Telangana" },
  { code: "MAA", name: "Coromandel Coast Marina Pavilion & Convention Regency", city: "Chennai", state: "Tamil Nadu" },
  { code: "CCU", name: "Victoria Colonial Club & Royal Turf Promenade", city: "Kolkata", state: "West Bengal" },
  { code: "SML", name: "The Himalayan Cedar Ridge & Mountain Stargazer Chalets", city: "Shimla", state: "Himachal Pradesh" },
];

const BUILDING_NAMES = [
  "The Royal Heritage Palace Wing",
  "The Lakefront Panoramic Tower",
  "The Garden Villa Pavilion Enclave",
  "The Executive Sovereign Club Block",
  "The Courtyard Fountain Residence",
  "The Stargazer Sky Terrace Wing",
  "The Ambassador Diplomatic Enclave",
  "The Wellness & Rejuvenation Cloister",
  "The Grand Atrium Business Block",
  "The West Promenade Luxury Lodge",
];

async function main() {
  console.log("================================================================================");
  console.log("🏨 byteInn — Enterprise-Scale Multi-Property 1-Year Operational Seed");
  console.log("================================================================================");
  console.log("Dimensions: 10 Sites · 100 Buildings · 700 Floors · 10,500 Rooms · 1 Year History\n");

  const startTime = Date.now();

  // --------------------------------------------------------------------------
  // STEP 1: Fast Table Truncate & Role / User Setup
  // --------------------------------------------------------------------------
  console.log("Phase 1: Resetting database and ensuring administrative governance...");
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      audit_logs,
      payments,
      invoice_items,
      invoices,
      reservation_rooms,
      reservations,
      customers,
      rooms,
      room_category_amenities,
      room_categories,
      amenities,
      floors,
      buildings,
      properties
    CASCADE;
  `);

  const adminRole = await prisma.role.upsert({
    where: { name: RoleName.ADMIN },
    update: {},
    create: {
      name: RoleName.ADMIN,
      description: "Chief Administrator with property configuration and user governance authority",
    },
  });

  const receptionistRole = await prisma.role.upsert({
    where: { name: RoleName.RECEPTIONIST },
    update: {},
    create: {
      name: RoleName.RECEPTIONIST,
      description: "Front-desk operations officer managing guest reservations, room check-in/out, and folio settlements",
    },
  });

  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash("Admin@123456", salt);
  const receptionistPasswordHash = await bcrypt.hash("Reception@123456", salt);

  const _adminUser = await prisma.user.upsert({
    where: { email: "admin@byteinn.local" },
    update: { passwordHash: adminPasswordHash, status: "ACTIVE" },
    create: {
      name: "Suryanarayana Rao (General Manager)",
      email: "admin@byteinn.local",
      passwordHash: adminPasswordHash,
      roleId: adminRole.id,
      status: "ACTIVE",
      mustChangePassword: false,
    },
  });

  const receptionistUser = await prisma.user.upsert({
    where: { email: "reception@byteinn.local" },
    update: { passwordHash: receptionistPasswordHash, status: "ACTIVE" },
    create: {
      name: "Meenakshi Sundaram (Chief Concierge & Front Office Manager)",
      email: "reception@byteinn.local",
      passwordHash: receptionistPasswordHash,
      roleId: receptionistRole.id,
      status: "ACTIVE",
      mustChangePassword: false,
    },
  });

  console.log("  ✓ Governance verified: Admin & Receptionist operational staff accounts active\n");

  // --------------------------------------------------------------------------
  // STEP 2: Sites (Properties), Buildings, Floors & Categories
  // --------------------------------------------------------------------------
  console.log("Phase 2: Generating Sites, Buildings, Floors, and Room Categories...");

  // 1. Amenities
  const amenitiesList = [
    { id: generateId("am"), name: "Gigabit Dual-Band Wi-Fi 6", description: "High-speed enterprise wireless coverage" },
    { id: generateId("am"), name: "Multi-Zone Climate Control", description: "Independent silent air conditioning with HEPA purification" },
    { id: generateId("am"), name: "65-inch 4K OLED Smart TV", description: "Bose soundbar & international streaming entertainment" },
    { id: generateId("am"), name: "Private Balcony / Veranda", description: "Panoramic vistas with outdoor seating" },
    { id: generateId("am"), name: "Espresso & Herbal Tea Bar", description: "Nespresso machine with organic estate single-origins" },
    { id: generateId("am"), name: "Motorized Digital Laptop Safe", description: "Engineered to fit 17-inch laptops" },
    { id: generateId("am"), name: "Freestanding Italian Soaking Tub", description: "Marble bathtub with Grohe rain shower" },
    { id: generateId("am"), name: "Heated Private Plunge Pool", description: "Temperature-controlled infinity pool" },
  ];
  await prisma.amenity.createMany({ data: amenitiesList });

  // 2. Properties (10 Sites)
  interface SeedProperty {
    id: string;
    code: string;
    name: string;
    city: string;
    state: string;
  }
  const properties: SeedProperty[] = SITES_CONFIG.map((s) => ({
    id: generateId("prop"),
    code: s.code,
    name: s.name,
    city: s.city,
    state: s.state,
  }));

  await prisma.property.createMany({
    data: properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: `Campus Drive, Heritage Sector ${randomInt(1, 40)}, Enclave ${randomInt(100, 999)}`,
      city: p.city,
      state: p.state,
      country: "India",
      phone: `+91 ${randomInt(80, 99)} ${randomInt(4000, 4999)} ${randomInt(1000, 9999)}`,
      email: `reservations@${p.code.toLowerCase()}.byteninn.com`,
      status: "ACTIVE",
    })),
  });

  // 3. Buildings (10 per Site = 100 total)
  interface SeedBuilding {
    id: string;
    propertyId: string;
    siteCode: string;
    buildingIndex: number;
    name: string;
  }
  const buildings: SeedBuilding[] = [];
  for (const prop of properties) {
    for (let b = 1; b <= 10; b++) {
      buildings.push({
        id: generateId("bld"),
        propertyId: prop.id,
        siteCode: prop.code,
        buildingIndex: b,
        name: `${prop.city} — ${BUILDING_NAMES[b - 1]!} (${prop.code}-B${b})`,
      });
    }
  }

  await prisma.building.createMany({
    data: buildings.map((b) => ({
      id: b.id,
      propertyId: b.propertyId,
      name: b.name,
      description: `Executive block with premium reception lobby, 24/7 security, dual high-speed elevators, and soundproof double-glazed facades.`,
    })),
  });

  // 4. Floors (7 floors per building = 700 floors)
  interface SeedFloor {
    id: string;
    buildingId: string;
    floorNo: number;
    name: string;
  }
  const floors: SeedFloor[] = [];
  for (const bld of buildings) {
    for (let f = 1; f <= 7; f++) {
      floors.push({
        id: generateId("flr"),
        buildingId: bld.id,
        floorNo: f,
        name: `Floor ${f} — Level ${f} Promenade`,
      });
    }
  }

  await insertChunks("Floors", floors, 2500, async (chunk) => {
    await prisma.floor.createMany({
      data: chunk.map((f) => ({
        id: f.id,
        buildingId: f.buildingId,
        floorNo: f.floorNo,
        name: f.name,
      })),
    });
  });

  // 5. Room Categories (5 categories per site = 50 total)
  interface SeedCategory {
    id: string;
    propertyId: string;
    key: "SINGLE" | "DOUBLE" | "SUITE" | "STUDIO" | "PRESIDENTIAL";
    name: string;
    basePrice: Prisma.Decimal;
    maxOccupancy: number;
  }

  const CATEGORY_TEMPLATES: {
    key: SeedCategory["key"];
    suffix: string;
    basePrice: number;
    maxOccupancy: number;
  }[] = [
    { key: "SINGLE", suffix: "Standard Single Executive Room", basePrice: 3200, maxOccupancy: 1 },
    { key: "DOUBLE", suffix: "Deluxe Double Balcony Suite", basePrice: 5800, maxOccupancy: 2 },
    { key: "STUDIO", suffix: "Luxury Lakeview / Garden Studio", basePrice: 7200, maxOccupancy: 2 },
    { key: "SUITE", suffix: "Executive Club Panoramic Suite", basePrice: 9500, maxOccupancy: 3 },
    { key: "PRESIDENTIAL", suffix: "Royal Sovereign Presidential Enclave", basePrice: 28000, maxOccupancy: 6 },
  ];

  const categories: SeedCategory[] = [];
  const categoryAmenities: { roomCategoryId: string; amenityId: string }[] = [];

  for (const prop of properties) {
    for (const tpl of CATEGORY_TEMPLATES) {
      const catId = generateId("cat");
      categories.push({
        id: catId,
        propertyId: prop.id,
        key: tpl.key,
        name: `${prop.city} ${tpl.suffix}`,
        basePrice: new Prisma.Decimal(tpl.basePrice),
        maxOccupancy: tpl.maxOccupancy,
      });

      // Link 4-6 amenities per category
      for (let i = 0; i < randomInt(4, 7); i++) {
        categoryAmenities.push({
          roomCategoryId: catId,
          amenityId: amenitiesList[i]!.id,
        });
      }
    }
  }

  await prisma.roomCategory.createMany({
    data: categories.map((c) => ({
      id: c.id,
      propertyId: c.propertyId,
      name: c.name,
      description: `Opulent guest sanctuary engineered for tranquil comfort, premium hospitality service, and seamless reception workflow.`,
      basePrice: c.basePrice,
      maxOccupancy: c.maxOccupancy,
    })),
  });

  await prisma.roomCategoryAmenity.createMany({
    data: categoryAmenities,
    skipDuplicates: true,
  });

  console.log(`  ✓ Sites: ${properties.length} | Buildings: ${buildings.length} | Floors: ${floors.length} | Categories: ${categories.length}\n`);

  // --------------------------------------------------------------------------
  // STEP 3: Physical Rooms (105 rooms per building * 100 buildings = 10,500 rooms)
  // --------------------------------------------------------------------------
  console.log("Phase 3: Generating 10,500 Physical Rooms (105 rooms per building across 100 buildings)...");

  interface SeedRoom {
    id: string;
    propertyId: string;
    buildingId: string;
    floorId: string;
    roomCategoryId: string;
    roomNo: string;
    displayName: string | null;
    capacity: number;
    status: RoomStatus;
    priceOverride: Prisma.Decimal | null;
    notes: string | null;
  }

  const allRooms: SeedRoom[] = [];
  const floorsByBuilding = new Map<string, SeedFloor[]>();
  for (const f of floors) {
    if (!floorsByBuilding.has(f.buildingId)) floorsByBuilding.set(f.buildingId, []);
    floorsByBuilding.get(f.buildingId)!.push(f);
  }

  const categoriesByProperty = new Map<string, SeedCategory[]>();
  for (const c of categories) {
    if (!categoriesByProperty.has(c.propertyId)) categoriesByProperty.set(c.propertyId, []);
    categoriesByProperty.get(c.propertyId)!.push(c);
  }

  for (const bld of buildings) {
    const bFloors = floorsByBuilding.get(bld.id) || [];
    const pCats = categoriesByProperty.get(bld.propertyId) || [];
    const catMap = new Map<string, SeedCategory>(pCats.map((c) => [c.key, c]));

    // 7 Floors per building
    for (const flr of bFloors) {
      const fNo = flr.floorNo;
      // 15 Rooms per floor (e.g. 101 to 115) -> 7 * 15 = 105 rooms per building
      for (let r = 1; r <= 15; r++) {
        const roomDigits = r < 10 ? `0${r}` : `${r}`;
        const roomNo = `${fNo}${roomDigits}`;

        // Category distribution:
        // Room 01-02: Single (2 rooms)
        // Room 03-11: Deluxe Double (9 rooms)
        // Room 12-13: Luxury Studio (2 rooms)
        // Room 14: Executive Suite (1 room)
        // Room 15: Suite or Presidential on top floors
        let catKey: SeedCategory["key"] = "DOUBLE";
        let capacity = 2;
        if (r <= 2) {
          catKey = "SINGLE";
          capacity = 1;
        } else if (r >= 3 && r <= 11) {
          catKey = "DOUBLE";
          capacity = 2;
        } else if (r === 12 || r === 13) {
          catKey = "STUDIO";
          capacity = 2;
        } else if (r === 14) {
          catKey = "SUITE";
          capacity = 3;
        } else if (r === 15) {
          catKey = fNo >= 6 ? "PRESIDENTIAL" : "SUITE";
          capacity = fNo >= 6 ? 6 : 4;
        }

        const category = catMap.get(catKey)!;
        const roomId = generateId("rm");

        // Price override on top 10% premium rooms
        const hasOverride = r === 15 || (fNo === 7 && r >= 12);
        const priceOverride = hasOverride
          ? category.basePrice.add(new Prisma.Decimal(randomInt(500, 2000)))
          : null;

        // Custom display name on 5% VIP suites only
        const hasCustomName = (fNo === 7 && r === 15) || (fNo === 1 && r === 1);
        const displayName = hasCustomName
          ? fNo === 7
            ? `The Sovereign Penthouse of ${bld.name.split("—")[1]?.trim() || "Wing"}`
            : `Courtyard Garden Sanctuary ${roomNo}`
          : null;

        const notes = randomChoice([
          "Quiet corner room with garden view; favored by returning executives.",
          "Close to elevator alcove with ramp access.",
          "Full morning sunrise panorama facing eastern grounds.",
          null, null, null, null, null,
        ]);

        allRooms.push({
          id: roomId,
          propertyId: bld.propertyId,
          buildingId: bld.id,
          floorId: flr.id,
          roomCategoryId: category.id,
          roomNo,
          displayName,
          capacity,
          status: RoomStatus.VACANT_CLEAN, // Initial status; will be aligned with active stays in Phase 6
          priceOverride,
          notes,
        });
      }
    }
  }

  await insertChunks("Physical Rooms", allRooms, 2500, async (chunk) => {
    await prisma.room.createMany({
      data: chunk.map((r) => ({
        id: r.id,
        propertyId: r.propertyId,
        buildingId: r.buildingId,
        floorId: r.floorId,
        roomCategoryId: r.roomCategoryId,
        roomNo: r.roomNo,
        displayName: r.displayName,
        capacity: r.capacity,
        status: r.status,
        priceOverride: r.priceOverride,
        notes: r.notes,
      })),
    });
  });

  console.log(`  ✓ 10,500 Physical Rooms created successfully across 100 buildings\n`);

  // --------------------------------------------------------------------------
  // STEP 4: Customer Directory (15,000 Guest Profiles)
  // --------------------------------------------------------------------------
  console.log("Phase 4: Generating 15,000 Unique Guest Profiles with Masked IDs...");

  interface SeedCustomer {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string;
    email: string;
    nationality: string;
    address: string;
    idProofType: string;
    idProofNumber: string;
    remarks: string | null;
  }

  const allCustomers: SeedCustomer[] = [];
  const usedEmails = new Set<string>();

  for (let c = 1; c <= 15000; c++) {
    const fName = randomChoice(FIRST_NAMES);
    const lName = randomChoice(LAST_NAMES);
    const geo = randomChoice(CITIES);
    const phoneNo = `+91 ${randomInt(90, 99)}${randomInt(10, 99)} ${randomInt(10000, 99999)}`;
    
    let email = `${fName.toLowerCase()}.${lName.toLowerCase()}.${c}@byten-guests.local`;
    while (usedEmails.has(email)) {
      email = `${fName.toLowerCase()}.${lName.toLowerCase()}.${c}_${randomInt(100, 999)}@byten-guests.local`;
    }
    usedEmails.add(email);

    const idType = randomChoice(["Passport", "National ID", "Driving License", "Aadhaar"]);
    const idLast4 = String(randomInt(1000, 9999));

    const remarks = randomChoice([
      "VIP repeat guest. Prefers high-floor room with feather-free pillows.",
      "Corporate rate client (Accenture / Infosys corporate partner account).",
      "Late evening arrival; requested express key handover at reception.",
      "Prefers quiet courtyard facing rooms.",
      null, null, null, null, null,
    ]);

    allCustomers.push({
      id: generateId("cust"),
      firstName: fName,
      lastName: lName,
      phone: phoneNo,
      email,
      nationality: geo.country === "India" ? "Indian" : geo.country,
      address: `${geo.city}, ${geo.state}, ${geo.country}`,
      idProofType: idType,
      idProofNumber: idLast4, // Normalized 4 digits
      remarks,
    });
  }

  await insertChunks("Customers", allCustomers, 2500, async (chunk) => {
    await prisma.customer.createMany({
      data: chunk.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        nationality: c.nationality,
        address: c.address,
        idProofType: c.idProofType,
        idProofNumber: c.idProofNumber,
        remarks: c.remarks,
      })),
    });
  });

  console.log(`  ✓ 15,000 Guest Profiles registered\n`);

  // --------------------------------------------------------------------------
  // STEP 5: 1-Year Operational Stay History & Billing Cycles
  // --------------------------------------------------------------------------
  console.log("Phase 5: Generating 1 Full Operational Year of Reservations, Invoices, and Payments...");
  console.log("Timeline: October 18, 2025 – October 18, 2026 (Historical) & Upcoming Stays into Nov 2026\n");

  // Today reference date in local time
  const TODAY = new Date("2026-10-18T12:00:00.000Z");
  const TODAY_MS = TODAY.getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Map rooms by ID for rapid lookup
  const _roomLookup = new Map<string, SeedRoom>(allRooms.map((r) => [r.id, r]));
  const catLookup = new Map<string, SeedCategory>(categories.map((c) => [c.id, c]));

  // Arrays to collect generated transactional entities in chunks
  interface SeedReservation {
    id: string;
    reservationNo: string;
    customerId: string;
    status: ReservationStatus;
    createdBy: string;
    specialRequests: string | null;
    createdAt: Date;
  }

  interface SeedReservationRoom {
    id: string;
    reservationId: string;
    roomId: string;
    roomCategoryId: string;
    arrivalDate: Date;
    departureDate: Date;
    bookedNightlyRate: Prisma.Decimal;
    adults: number;
    children: number;
    status: AllocationStatus;
    checkedInAt: Date | null;
    checkedOutAt: Date | null;
    actualCheckoutDate: Date | null;
    assignedAt: Date;
    createdAt: Date;
  }

  interface SeedInvoice {
    id: string;
    reservationId: string;
    invoiceNumber: string;
    subtotal: Prisma.Decimal;
    discountTotal: Prisma.Decimal;
    taxTotal: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
    status: InvoiceStatus;
    issuedAt: Date;
    createdAt: Date;
  }

  interface SeedInvoiceItem {
    id: string;
    invoiceId: string;
    reservationRoomId: string;
    description: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
    itemType: InvoiceItemType;
    createdAt: Date;
  }

  interface SeedPayment {
    id: string;
    invoiceId: string;
    amount: Prisma.Decimal;
    paymentMethod: string;
    referenceNumber: string;
    status: PaymentStatus;
    paidAt: Date;
    createdBy: string;
    createdAt: Date;
  }

  const allReservations: SeedReservation[] = [];
  const allReservationRooms: SeedReservationRoom[] = [];
  const allInvoices: SeedInvoice[] = [];
  const allInvoiceItems: SeedInvoiceItem[] = [];
  const allPayments: SeedPayment[] = [];

  // Track room occupancy for current day alignment (Phase 6)
  const roomStatusToday = new Map<string, RoomStatus>();

  let reservationSeq = 100000;
  let invoiceSeq = 100000;

  // We generate reservations across a sample of rooms spread across all 100 buildings.
  // Each room gets a chronological sequence of non-overlapping stays across the 365 days.
  // To achieve ~65,000 realistic reservations:
  // We simulate 6-7 stays per room on average across 10,000 rooms.
  console.log("Simulating stay sequences across buildings...");

  // Room batches: iterate over rooms
  const totalRoomsCount = allRooms.length;
  for (let rIdx = 0; rIdx < totalRoomsCount; rIdx++) {
    const room = allRooms[rIdx]!;
    const category = catLookup.get(room.roomCategoryId)!;
    const nightlyRate = room.priceOverride || category.basePrice;

    // Start date for this room: 365 days ago + random stagger (1 to 20 days)
    let currentCursorMs = TODAY_MS - 365 * ONE_DAY_MS + randomInt(1, 20) * ONE_DAY_MS;

    // Generate stays until cursor passes today + 25 days
    while (currentCursorMs < TODAY_MS + 25 * ONE_DAY_MS) {
      const stayNights = randomInt(1, 5); // 1 to 5 nights stay
      const arrivalMs = currentCursorMs;
      const departureMs = arrivalMs + stayNights * ONE_DAY_MS;

      const arrivalDate = new Date(arrivalMs);
      const departureDate = new Date(departureMs);

      // Advance cursor: gap between bookings (3 to 14 days)
      currentCursorMs = departureMs + randomInt(3, 14) * ONE_DAY_MS;

      // Assign a customer
      const customer = randomChoice(allCustomers);
      const resId = generateId("res");
      reservationSeq++;
      const resNo = `RES-2026-${reservationSeq}`;

      const bookingCreatedMs = arrivalMs - randomInt(2, 21) * ONE_DAY_MS;
      const bookingCreatedAt = new Date(bookingCreatedMs);

      // Determine stay status based on arrival/departure relative to TODAY
      let resStatus: ReservationStatus = ReservationStatus.COMPLETED;
      let allocStatus: AllocationStatus = AllocationStatus.CHECKED_OUT;
      let checkedInAt: Date | null = new Date(arrivalMs + 14 * 3600 * 1000); // 2:00 PM
      let checkedOutAt: Date | null = new Date(departureMs + 11 * 3600 * 1000); // 11:00 AM
      let actualCheckoutDate: Date | null = departureDate;

      // Check if this stay is in the future
      if (arrivalMs > TODAY_MS) {
        // Upcoming booking
        resStatus = ReservationStatus.CONFIRMED;
        allocStatus = AllocationStatus.CONFIRMED;
        checkedInAt = null;
        checkedOutAt = null;
        actualCheckoutDate = null;
      } else if (arrivalMs <= TODAY_MS && departureMs > TODAY_MS) {
        // Active In-House Stay!
        resStatus = ReservationStatus.CONFIRMED;
        allocStatus = AllocationStatus.CHECKED_IN;
        checkedInAt = new Date(arrivalMs + 14 * 3600 * 1000);
        checkedOutAt = null;
        actualCheckoutDate = null;
        roomStatusToday.set(room.id, RoomStatus.OCCUPIED);
      } else if (Math.abs(departureMs - TODAY_MS) < ONE_DAY_MS) {
        // Checked out today!
        resStatus = ReservationStatus.COMPLETED;
        allocStatus = AllocationStatus.CHECKED_OUT;
        if (!roomStatusToday.has(room.id)) {
          roomStatusToday.set(room.id, RoomStatus.VACANT_DIRTY);
        }
      } else {
        // Past stay: 3% cancellation rate
        const isCancelled = rng() < 0.03;
        if (isCancelled) {
          resStatus = ReservationStatus.CANCELLED;
          allocStatus = AllocationStatus.CANCELLED;
          checkedInAt = null;
          checkedOutAt = null;
          actualCheckoutDate = null;
        }
      }

      // 1. Create Reservation
      allReservations.push({
        id: resId,
        reservationNo: resNo,
        customerId: customer.id,
        status: resStatus,
        createdBy: receptionistUser.id,
        specialRequests: randomChoice(SPECIAL_REQUESTS),
        createdAt: bookingCreatedAt,
      });

      // 2. Create Allocation
      const allocId = generateId("rr");
      allReservationRooms.push({
        id: allocId,
        reservationId: resId,
        roomId: room.id,
        roomCategoryId: room.roomCategoryId,
        arrivalDate,
        departureDate,
        bookedNightlyRate: nightlyRate,
        adults: randomInt(1, room.capacity),
        children: room.capacity > 2 && rng() < 0.25 ? randomInt(1, 2) : 0,
        status: allocStatus,
        checkedInAt,
        checkedOutAt,
        actualCheckoutDate,
        assignedAt: bookingCreatedAt,
        createdAt: bookingCreatedAt,
      });

      // 3. Create Invoice & Items
      invoiceSeq++;
      const invId = generateId("inv");
      const invNo = `INV-2026-${invoiceSeq}`;

      const roomTotal = nightlyRate.mul(stayNights);
      let subtotal = roomTotal;
      let discountTotal = new Prisma.Decimal(0);

      // VIP discount (10% on 15% of stays)
      if (rng() < 0.15) {
        discountTotal = roomTotal.mul(new Prisma.Decimal("0.10"));
      }

      // Extra charges (30% of stays)
      const hasExtra = rng() < 0.30;
      let extraTotal = new Prisma.Decimal(0);
      let extraService: typeof EXTRA_SERVICES[0] | null = null;
      if (hasExtra) {
        extraService = randomChoice(EXTRA_SERVICES);
        extraTotal = new Prisma.Decimal(extraService.unitPrice);
        subtotal = subtotal.add(extraTotal);
      }

      const taxTotal = subtotal.sub(discountTotal).mul(new Prisma.Decimal("0.12")); // 12% GST
      const grandTotal = subtotal.sub(discountTotal).add(taxTotal);

      let invStatus: InvoiceStatus = InvoiceStatus.PAID;
      if (allocStatus === AllocationStatus.CANCELLED) {
        invStatus = InvoiceStatus.VOID;
      } else if (allocStatus === AllocationStatus.CONFIRMED) {
        invStatus = rng() < 0.5 ? InvoiceStatus.ISSUED : InvoiceStatus.PARTIALLY_PAID;
      } else if (allocStatus === AllocationStatus.CHECKED_IN) {
        invStatus = InvoiceStatus.PARTIALLY_PAID;
      }

      allInvoices.push({
        id: invId,
        reservationId: resId,
        invoiceNumber: invNo,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        status: invStatus,
        issuedAt: bookingCreatedAt,
        createdAt: bookingCreatedAt,
      });

      // Room charge item
      allInvoiceItems.push({
        id: generateId("ii"),
        invoiceId: invId,
        reservationRoomId: allocId,
        description: `Room ${room.roomNo} (${category.name}, ${stayNights} night${stayNights === 1 ? "" : "s"})`,
        quantity: new Prisma.Decimal(stayNights),
        unitPrice: nightlyRate,
        lineTotal: roomTotal,
        itemType: InvoiceItemType.ROOM_CHARGE,
        createdAt: bookingCreatedAt,
      });

      // Extra service item if applicable
      if (extraService) {
        allInvoiceItems.push({
          id: generateId("ii"),
          invoiceId: invId,
          reservationRoomId: allocId,
          description: extraService.desc,
          quantity: new Prisma.Decimal(1),
          unitPrice: new Prisma.Decimal(extraService.unitPrice),
          lineTotal: new Prisma.Decimal(extraService.unitPrice),
          itemType: extraService.type,
          createdAt: bookingCreatedAt,
        });
      }

      // 4. Create Payments
      if (invStatus === InvoiceStatus.PAID) {
        // Full settlement on departure
        allPayments.push({
          id: generateId("pay"),
          invoiceId: invId,
          amount: grandTotal,
          paymentMethod: randomChoice(["CREDIT_CARD", "UPI", "BANK_TRANSFER", "CASH"]),
          referenceNumber: `TXN-${randomInt(10000000, 99999999)}`,
          status: PaymentStatus.RECORDED,
          paidAt: departureDate,
          createdBy: receptionistUser.id,
          createdAt: departureDate,
        });
      } else if (invStatus === InvoiceStatus.PARTIALLY_PAID) {
        // 50% advance deposit paid at booking
        const advanceAmount = grandTotal.mul(new Prisma.Decimal("0.50"));
        allPayments.push({
          id: generateId("pay"),
          invoiceId: invId,
          amount: advanceAmount,
          paymentMethod: randomChoice(["CREDIT_CARD", "UPI"]),
          referenceNumber: `DEP-${randomInt(10000000, 99999999)}`,
          status: PaymentStatus.RECORDED,
          paidAt: bookingCreatedAt,
          createdBy: receptionistUser.id,
          createdAt: bookingCreatedAt,
        });
      }
    }
  }

  console.log(`\nInserting operational records in chunked batches...`);
  console.log(`  Planned Records: ${allReservations.length.toLocaleString()} Reservations | ${allInvoices.length.toLocaleString()} Invoices | ${allPayments.length.toLocaleString()} Payments\n`);

  // Insert Reservations
  await insertChunks("Reservations", allReservations, 2500, async (chunk) => {
    await prisma.reservation.createMany({
      data: chunk.map((r) => ({
        id: r.id,
        reservationNo: r.reservationNo,
        customerId: r.customerId,
        status: r.status,
        createdBy: r.createdBy,
        specialRequests: r.specialRequests,
        createdAt: r.createdAt,
      })),
    });
  });

  // Insert Reservation Rooms
  await insertChunks("Room Allocations", allReservationRooms, 2500, async (chunk) => {
    await prisma.reservationRoom.createMany({
      data: chunk.map((rr) => ({
        id: rr.id,
        reservationId: rr.reservationId,
        roomId: rr.roomId,
        roomCategoryId: rr.roomCategoryId,
        arrivalDate: rr.arrivalDate,
        departureDate: rr.departureDate,
        bookedNightlyRate: rr.bookedNightlyRate,
        adults: rr.adults,
        children: rr.children,
        status: rr.status,
        checkedInAt: rr.checkedInAt,
        checkedOutAt: rr.checkedOutAt,
        actualCheckoutDate: rr.actualCheckoutDate,
        assignedAt: rr.assignedAt,
        createdAt: rr.createdAt,
      })),
    });
  });

  // Insert Invoices
  await insertChunks("Invoices", allInvoices, 2500, async (chunk) => {
    await prisma.invoice.createMany({
      data: chunk.map((inv) => ({
        id: inv.id,
        reservationId: inv.reservationId,
        invoiceNumber: inv.invoiceNumber,
        subtotal: inv.subtotal,
        discountTotal: inv.discountTotal,
        taxTotal: inv.taxTotal,
        grandTotal: inv.grandTotal,
        status: inv.status,
        issuedAt: inv.issuedAt,
        createdAt: inv.createdAt,
      })),
    });
  });

  // Insert Invoice Items
  await insertChunks("Invoice Items", allInvoiceItems, 2500, async (chunk) => {
    await prisma.invoiceItem.createMany({
      data: chunk.map((ii) => ({
        id: ii.id,
        invoiceId: ii.invoiceId,
        reservationRoomId: ii.reservationRoomId,
        description: ii.description,
        quantity: ii.quantity,
        unitPrice: ii.unitPrice,
        lineTotal: ii.lineTotal,
        itemType: ii.itemType,
        createdAt: ii.createdAt,
      })),
    });
  });

  // Insert Payments
  await insertChunks("Payments", allPayments, 2500, async (chunk) => {
    await prisma.payment.createMany({
      data: chunk.map((p) => ({
        id: p.id,
        invoiceId: p.invoiceId,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        referenceNumber: p.referenceNumber,
        status: p.status,
        paidAt: p.paidAt,
        createdBy: p.createdBy,
        createdAt: p.createdAt,
      })),
    });
  });

  // --------------------------------------------------------------------------
  // STEP 6: Physical Room Status Alignment for Current Day
  // --------------------------------------------------------------------------
  console.log("\nPhase 6: Aligning Current Physical Room States on October 18, 2026...");

  // Update rooms that are currently OCCUPIED or VACANT_DIRTY based on today's stays
  const occupiedRoomIds: string[] = [];
  const dirtyRoomIds: string[] = [];

  for (const [roomId, status] of roomStatusToday.entries()) {
    if (status === RoomStatus.OCCUPIED) occupiedRoomIds.push(roomId);
    if (status === RoomStatus.VACANT_DIRTY) dirtyRoomIds.push(roomId);
  }

  // Update in chunks
  if (occupiedRoomIds.length > 0) {
    await insertChunks("Updating OCCUPIED Rooms", occupiedRoomIds, 2500, async (chunk) => {
      await prisma.room.updateMany({
        where: { id: { in: chunk } },
        data: { status: RoomStatus.OCCUPIED },
      });
    });
  }

  if (dirtyRoomIds.length > 0) {
    await insertChunks("Updating VACANT_DIRTY Rooms", dirtyRoomIds, 2500, async (chunk) => {
      await prisma.room.updateMany({
        where: { id: { in: chunk } },
        data: { status: RoomStatus.VACANT_DIRTY },
      });
    });
  }

  // Add realistic maintenance / out-of-service flags on 3% of remaining vacant rooms
  const remainingRooms = allRooms.filter((r) => !roomStatusToday.has(r.id));
  const maintenanceRoomIds = remainingRooms.slice(0, 180).map((r) => r.id);
  const outOfServiceRoomIds = remainingRooms.slice(180, 280).map((r) => r.id);

  if (maintenanceRoomIds.length > 0) {
    await prisma.room.updateMany({
      where: { id: { in: maintenanceRoomIds } },
      data: { status: RoomStatus.MAINTENANCE, notes: "HVAC filter replacement and seasonal fresh coat paint." },
    });
  }
  if (outOfServiceRoomIds.length > 0) {
    await prisma.room.updateMany({
      where: { id: { in: outOfServiceRoomIds } },
      data: { status: RoomStatus.OUT_OF_SERVICE, notes: "Bathroom plumbing overhaul and marble polishing." },
    });
  }

  // Calculate live breakdown
  const statusCounts = await prisma.room.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  const totalRevenue = allPayments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("🎉 byteInn Enterprise 1-Year Real-World Seed Successfully Finished!");
  console.log("================================================================================");
  console.log(`Execution Time:     ${totalDuration}s`);
  console.log(`Sites (Properties): ${properties.length}`);
  console.log(`Buildings:          ${buildings.length} (10 per site)`);
  console.log(`Floors:             ${floors.length} (7 per building)`);
  console.log(`Physical Rooms:     ${allRooms.length.toLocaleString()} (105 rooms/building)`);
  console.log(`Guest Profiles:     ${allCustomers.length.toLocaleString()}`);
  console.log(`Reservations:       ${allReservations.length.toLocaleString()} bookings (Oct 2025 – Nov 2026)`);
  console.log(`Allocated Stays:    ${allReservationRooms.length.toLocaleString()}`);
  console.log(`Itemized Invoices:  ${allInvoices.length.toLocaleString()}`);
  console.log(`Invoice Line Items: ${allInvoiceItems.length.toLocaleString()}`);
  console.log(`Recorded Payments:  ${allPayments.length.toLocaleString()}`);
  console.log(`Total Revenue:      ₹${totalRevenue.toLocaleString()}`);
  console.log("\nCurrent Physical Room Status Breakdown on October 18, 2026:");
  for (const sc of statusCounts) {
    console.log(`  - ${sc.status.padEnd(16)}: ${sc._count.id.toLocaleString()} rooms`);
  }
  console.log("================================================================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Fatal seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
