import {
  PrismaClient,
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
  Prisma,
} from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

// Deterministic fast PRNG
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

const rng = createRng(20261117);

function randomInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function generateId(prefix: string): string {
  const hex = crypto.randomBytes(10).toString("hex");
  return `c${prefix.toLowerCase()}${hex}`;
}

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
  "Shaurya", "Atharva", "Advik", "Pranav", "Kabir", "Ananya", "Diya", "Saanvi", "Myra", "Aadhya",
  "Aarohi", "Anvi", "Pari", "Isha", "Navya", "Riya", "Avani", "Tanvi", "Sia", "Mira",
  "Alexander", "Benjamin", "Charlotte", "Daniel", "Emily", "Felix", "Gabriel", "Hannah", "Isabella", "James",
  "Liam", "Lucas", "Maya", "Noah", "Olivia", "Sophia", "Thomas", "Victoria", "William", "Zoe",
  "Tariq", "Fatima", "Kenji", "Hana", "Chen", "Mei", "Rashid", "Layla", "Vikram", "Priyanka"
];

const LAST_NAMES = [
  "Sharma", "Verma", "Patel", "Reddy", "Nair", "Iyer", "Rao", "Chatterjee", "Banerjee", "Bose",
  "Gupta", "Malhotra", "Kapoor", "Bhatia", "Saxena", "Chopra", "Joshi", "Kulkarni", "Deshmukh", "Patil",
  "Mehta", "Shah", "Ambani", "Singhania", "Birla", "Tata", "Murthy", "Narayanan", "Pillai", "Menon",
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Anderson", "Taylor",
  "Al-Mansoor", "Takahashi", "Watanabe", "Zhang", "Wang", "Müller", "Schmidt", "Dubois", "Moreau", "Rossi"
];

const CITIES = [
  "Bengaluru", "Mumbai", "New Delhi", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Kochi",
  "London", "Dubai", "Singapore", "New York", "San Francisco", "Frankfurt", "Tokyo", "Sydney"
];

async function main() {
  console.log("================================================================================");
  console.log("🏨 byteInn — Comprehensive Past, Present & Future Database Seeding");
  console.log("================================================================================");

  const TODAY_STR = "2026-11-17";
  const TODAY_MS = new Date(`${TODAY_STR}T12:00:00.000Z`).getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  console.log(`Current Target Hotel Date: ${TODAY_STR}`);

  // 1. Fetch Target Property (Grand Orchid Palace) and Staff Users
  let property = await prisma.property.findFirst({
    where: { name: { contains: "Grand Orchid" } },
  });
  if (!property) {
    property = await prisma.property.findFirst();
  }
  if (!property) {
    throw new Error("No property found to seed.");
  }
  const propId = property.id;
  console.log(`Active Target Property: ${property.name} (${propId})`);

  // Staff users
  const adminUser = await prisma.user.findFirst({ where: { email: "admin@byteinn.local" } }) ||
    await prisma.user.findFirst();
  const receptionUser = await prisma.user.findFirst({ where: { email: "reception@byteinn.local" } }) ||
    adminUser;
  const auditorUser = await prisma.user.findFirst({ where: { email: "auditor@byteinn.local" } }) ||
    adminUser;

  if (!adminUser || !receptionUser || !auditorUser) {
    throw new Error("Required seed staff users missing.");
  }

  const staffList = [adminUser, receptionUser, auditorUser];

  // 2. Ensure Core Financial Accounts exist
  console.log("\n1. Ensuring Standard Financial Accounts for Property...");
  const accountConfigs = [
    { name: "Main Operating Drawer", type: AccountType.CASH, opening: 50000 },
    { name: "HDFC Primary Current Account", type: AccountType.BANK, opening: 1250000 },
    { name: "SBI Treasury Operating Account", type: AccountType.BANK, opening: 850000 },
    { name: "UPI & QR Instant Settlement Float", type: AccountType.CASH, opening: 75000 },
    { name: "Petty Cash Imprest", type: AccountType.CASH, opening: 25000 },
  ];

  const accountMap = new Map<string, string>();
  for (const ac of accountConfigs) {
    let acc = await prisma.financialAccount.findFirst({
      where: { propertyId: propId, accountName: ac.name },
    });
    if (!acc) {
      acc = await prisma.financialAccount.create({
        data: {
          id: generateId("acc"),
          propertyId: propId,
          accountName: ac.name,
          accountType: ac.type,
          openingBalance: new Prisma.Decimal(ac.opening),
          openingBalanceDate: new Date("2026-08-01"),
          isDefault: ac.type === AccountType.CASH && ac.name.includes("Main"),
          isActive: true,
        },
      });
    }
    accountMap.set(ac.name, acc.id);
  }
  const defaultCashAccId = accountMap.get("Main Operating Drawer")!;
  const defaultBankAccId = accountMap.get("HDFC Primary Current Account")!;
  const upiAccId = accountMap.get("UPI & QR Instant Settlement Float")!;

  // 3. Ensure Payment Methods
  console.log("2. Ensuring Standard Payment Methods...");
  const methodConfigs = [
    { code: "CASH", name: "Cash", accId: defaultCashAccId },
    { code: "CARD", name: "Credit / Debit Card", accId: defaultBankAccId },
    { code: "UPI", name: "UPI / QR Payment", accId: upiAccId },
    { code: "BANK_TRANSFER", name: "Bank Transfer (NEFT/RTGS)", accId: defaultBankAccId },
  ];
  for (const m of methodConfigs) {
    await prisma.paymentMethod.upsert({
      where: { propertyId_code: { propertyId: propId, code: m.code } },
      update: { defaultAccountId: m.accId, isActive: true },
      create: {
        id: generateId("pm"),
        propertyId: propId,
        name: m.name,
        code: m.code,
        defaultAccountId: m.accId,
        isActive: true,
      },
    });
  }

  // 4. Ensure Expense Heads & Income Heads
  console.log("3. Ensuring Standard Expense & Income Heads...");
  const expenseHeadConfigs = [
    { code: "FNB_GROCERY", name: "Kitchen & F&B Purchases" },
    { code: "UTIL_ELEC", name: "Electricity & Power Utility" },
    { code: "UTIL_WATER", name: "Water & Sanitation Utility" },
    { code: "MAINTENANCE", name: "Property Repairs & HVAC Maintenance" },
    { code: "HK_SUPPLIES", name: "Housekeeping & Linen Supplies" },
    { code: "STAFF_WELFARE", name: "Staff Welfare & Uniforms" },
    { code: "IT_SOFTWARE", name: "Software & Cloud IT Subscriptions" },
  ];
  const expenseHeadMap = new Map<string, string>();
  for (const eh of expenseHeadConfigs) {
    let head = await prisma.expenseHead.findFirst({
      where: { propertyId: propId, code: eh.code },
    });
    if (!head) {
      head = await prisma.expenseHead.create({
        data: {
          id: generateId("eh"),
          propertyId: propId,
          name: eh.name,
          code: eh.code,
          isActive: true,
        },
      });
    }
    expenseHeadMap.set(eh.code, head.id);
  }

  const incomeHeadConfigs = [
    { code: "INC_BANQ", name: "Banquet & Event Space Hire" },
    { code: "INC_SPA", name: "Ayurvedic Spa & Wellness" },
    { code: "INC_TAXI", name: "Airport Taxi & City Transfers" },
    { code: "INC_CONF", name: "Conference Room & Projector Rental" },
    { code: "INC_REST", name: "Restaurant & Cafe Walk-In" },
  ];
  const incomeHeadMap = new Map<string, string>();
  for (const ih of incomeHeadConfigs) {
    let head = await prisma.incomeHead.findFirst({
      where: { propertyId: propId, code: ih.code },
    });
    if (!head) {
      head = await prisma.incomeHead.create({
        data: {
          id: generateId("ih"),
          propertyId: propId,
          name: ih.name,
          code: ih.code,
          isActive: true,
        },
      });
    }
    incomeHeadMap.set(ih.code, head.id);
  }

  // 5. Fetch Rooms & Categories
  const rooms = await prisma.room.findMany({
    where: { propertyId: propId },
    include: { category: true },
  });
  console.log(`Available physical rooms: ${rooms.length}`);

  // Preload existing active allocations to guarantee zero PostgreSQL exclusion constraint violations
  const existingActiveAllocations = await prisma.reservationRoom.findMany({
    where: {
      reservation: { propertyId: propId },
      status: { not: AllocationStatus.CANCELLED },
    },
    select: {
      roomId: true,
      arrivalDate: true,
      departureDate: true,
    },
  });

  const activeAllocations: Array<{ roomId: string; arrMs: number; depMs: number }> =
    existingActiveAllocations.map((a) => ({
      roomId: a.roomId,
      arrMs: a.arrivalDate.getTime(),
      depMs: a.departureDate.getTime(),
    }));

  function isRoomFree(roomId: string, arrMs: number, depMs: number): boolean {
    for (const alloc of activeAllocations) {
      if (alloc.roomId === roomId) {
        if (alloc.arrMs < depMs && alloc.depMs > arrMs) {
          return false;
        }
      }
    }
    return true;
  }

  function pickAvailableRoom(arrDate: Date, depDate: Date, preferredCategoryId?: string): (typeof rooms)[0] | null {
    const arrMs = arrDate.getTime();
    const depMs = depDate.getTime();

    const candidateRooms = preferredCategoryId
      ? [...rooms.filter((r) => r.roomCategoryId === preferredCategoryId), ...rooms.filter((r) => r.roomCategoryId !== preferredCategoryId)]
      : rooms;

    for (const r of candidateRooms) {
      if (isRoomFree(r.id, arrMs, depMs)) {
        activeAllocations.push({ roomId: r.id, arrMs, depMs });
        return r;
      }
    }
    return null;
  }

  // 6. Ensure Pool of Customers
  console.log("4. Ensuring Customer Profiles...");
  const customerList: Array<{ id: string; name: string }> = [];
  const existingCustomers = await prisma.customer.findMany({ where: { registeredPropertyId: propId }, take: 150 });
  for (const c of existingCustomers) {
    customerList.push({ id: c.id, name: `${c.firstName} ${c.lastName}` });
  }

  while (customerList.length < 150) {
    const fn = randomChoice(FIRST_NAMES);
    const ln = randomChoice(LAST_NAMES);
    const city = randomChoice(CITIES);
    const phone = `+91 ${randomInt(90000, 99999)} ${randomInt(10000, 99999)}`;
    const cust = await prisma.customer.create({
      data: {
        id: generateId("cust"),
        registeredPropertyId: propId,
        firstName: fn,
        lastName: ln,
        phone,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}.${Date.now()}@guestmail.com`,
        address: city,
        idProofType: "Aadhaar Card",
        idProofNumber: `XXXX-XXXX-${randomInt(1000, 9999)}`,
      },
    });
    customerList.push({ id: cust.id, name: `${fn} ${ln}` });
  }

  // 7. Seed Past, Present, and Future Stays
  console.log("\n5. Seeding Past, Present (Today), and Future Stays & Invoices...");

  let seqNo = Date.now() % 1000000;
  const occupiedRoomIds = new Set<string>();
  const dirtyRoomIds = new Set<string>();
  const cleanRoomIds = new Set<string>();

  // A. TODAY'S ARRIVALS (Arrival = 2026-11-17)
  console.log("  • Generating Today's Arrivals (Nov 17)...");
  // 12 Already Checked In Today (Rooms become OCCUPIED)
  for (let i = 0; i < 12; i++) {
    const cust = customerList[i % customerList.length]!;
    const staff = randomChoice(staffList);
    const stayNights = randomInt(2, 4);
    const arrivalDate = new Date(`${TODAY_STR}T00:00:00.000Z`);
    const departureDate = new Date(arrivalDate.getTime() + stayNights * ONE_DAY_MS);
    const room = pickAvailableRoom(arrivalDate, departureDate);
    if (!room) continue;

    occupiedRoomIds.add(room.id);
    const rate = room.priceOverride || room.category.basePrice;
    const grandTotal = rate.mul(stayNights);

    const res = await prisma.reservation.create({
      data: {
        id: generateId("res"),
        reservationNo: `RES-TODAY-ARR-${seqNo++}`,
        customerId: cust.id,
        propertyId: propId,
        status: ReservationStatus.CONFIRMED,
        createdBy: staff.id,
        specialRequests: "Arrived today morning via flight; VIP welcome drink served.",
        rooms: {
          create: {
            id: generateId("rr"),
            roomId: room.id,
            roomCategoryId: room.roomCategoryId,
            arrivalDate,
            departureDate,
            bookedNightlyRate: rate,
            status: AllocationStatus.CHECKED_IN,
            checkedInAt: new Date(`${TODAY_STR}T14:15:00.000Z`),
          },
        },
      },
      include: { rooms: true },
    });

    // Invoice with payment recorded today
    const inv = await prisma.invoice.create({
      data: {
        id: generateId("inv"),
        reservationId: res.id,
        propertyId: propId,
        invoiceNumber: `INV-TODAY-ARR-${seqNo++}`,
        subtotal: grandTotal,
        discountTotal: new Prisma.Decimal(0),
        taxTotal: grandTotal.mul(new Prisma.Decimal("0.12")),
        grandTotal: grandTotal.mul(new Prisma.Decimal("1.12")),
        status: InvoiceStatus.PAID,
        issuedAt: new Date(`${TODAY_STR}T14:30:00.000Z`),
        items: {
          create: {
            id: generateId("ii"),
            reservationRoomId: res.rooms[0]!.id,
            description: `${room.category.name} - ${stayNights} Nights Room Charge`,
            quantity: new Prisma.Decimal(stayNights),
            unitPrice: rate,
            lineTotal: grandTotal,
            itemType: InvoiceItemType.ROOM_CHARGE,
          },
        },
      },
    });

    // Receipt recorded TODAY!
    await prisma.receipt.create({
      data: {
        id: generateId("rec"),
        propertyId: propId,
        invoiceId: inv.id,
        accountId: randomChoice([defaultCashAccId, defaultBankAccId, upiAccId]),
        paymentMethodCode: randomChoice(["CASH", "CARD", "UPI"]),
        amount: inv.grandTotal,
        referenceNumber: `REC-TODAY-${seqNo++}`,
        status: ReceiptStatus.RECORDED,
        paidAt: new Date(`${TODAY_STR}T14:35:00.000Z`),
        createdBy: staff.id,
      },
    });
  }

  // 12 Pending Expected Arrivals Today (Rooms VACANT_CLEAN waiting for guest)
  for (let i = 12; i < 24; i++) {
    const cust = customerList[(i + 15) % customerList.length]!;
    const staff = randomChoice(staffList);
    const stayNights = randomInt(1, 3);
    const arrivalDate = new Date(`${TODAY_STR}T00:00:00.000Z`);
    const departureDate = new Date(arrivalDate.getTime() + stayNights * ONE_DAY_MS);
    const room = pickAvailableRoom(arrivalDate, departureDate);
    if (!room) continue;

    if (!occupiedRoomIds.has(room.id)) cleanRoomIds.add(room.id);
    const rate = room.priceOverride || room.category.basePrice;

    await prisma.reservation.create({
      data: {
        id: generateId("res"),
        reservationNo: `RES-TODAY-PEND-${seqNo++}`,
        customerId: cust.id,
        propertyId: propId,
        status: ReservationStatus.CONFIRMED,
        createdBy: staff.id,
        specialRequests: "Late arrival expected ~7:30 PM. Airport pickup requested.",
        rooms: {
          create: {
            id: generateId("rr"),
            roomId: room.id,
            roomCategoryId: room.roomCategoryId,
            arrivalDate,
            departureDate,
            bookedNightlyRate: rate,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
    });
  }

  // B. TODAY'S DEPARTURES (Departure = 2026-11-17)
  console.log("  • Generating Today's Departures (Nov 17)...");
  // 10 Checked Out Today (Rooms become VACANT_DIRTY)
  for (let i = 24; i < 34; i++) {
    const cust = customerList[(i + 30) % customerList.length]!;
    const staff = randomChoice(staffList);
    const stayNights = randomInt(2, 4);
    const departureDate = new Date(`${TODAY_STR}T00:00:00.000Z`);
    const arrivalDate = new Date(departureDate.getTime() - stayNights * ONE_DAY_MS);
    const room = pickAvailableRoom(arrivalDate, departureDate);
    if (!room) continue;

    dirtyRoomIds.add(room.id);
    const rate = room.priceOverride || room.category.basePrice;
    const grandTotal = rate.mul(stayNights);

    const res = await prisma.reservation.create({
      data: {
        id: generateId("res"),
        reservationNo: `RES-TODAY-DEP-${seqNo++}`,
        customerId: cust.id,
        propertyId: propId,
        status: ReservationStatus.COMPLETED,
        createdBy: staff.id,
        specialRequests: "Checked out smoothly this morning. Luggage stored at desk.",
        rooms: {
          create: {
            id: generateId("rr"),
            roomId: room.id,
            roomCategoryId: room.roomCategoryId,
            arrivalDate,
            departureDate,
            bookedNightlyRate: rate,
            status: AllocationStatus.CHECKED_OUT,
            checkedInAt: new Date(arrivalDate.getTime() + 14 * 3600 * 1000),
            checkedOutAt: new Date(`${TODAY_STR}T10:45:00.000Z`),
            actualCheckoutDate: departureDate,
          },
        },
      },
      include: { rooms: true },
    });

    const inv = await prisma.invoice.create({
      data: {
        id: generateId("inv"),
        reservationId: res.id,
        propertyId: propId,
        invoiceNumber: `INV-TODAY-DEP-${seqNo++}`,
        subtotal: grandTotal,
        discountTotal: new Prisma.Decimal(0),
        taxTotal: grandTotal.mul(new Prisma.Decimal("0.12")),
        grandTotal: grandTotal.mul(new Prisma.Decimal("1.12")),
        status: InvoiceStatus.PAID,
        issuedAt: new Date(`${TODAY_STR}T10:40:00.000Z`),
        items: {
          create: {
            id: generateId("ii"),
            reservationRoomId: res.rooms[0]!.id,
            description: `${room.category.name} - ${stayNights} Nights Room Charge`,
            quantity: new Prisma.Decimal(stayNights),
            unitPrice: rate,
            lineTotal: grandTotal,
            itemType: InvoiceItemType.ROOM_CHARGE,
          },
        },
      },
    });

    // Receipt recorded TODAY upon checkout!
    await prisma.receipt.create({
      data: {
        id: generateId("rec"),
        propertyId: propId,
        invoiceId: inv.id,
        accountId: defaultCashAccId,
        paymentMethodCode: "CASH",
        amount: inv.grandTotal,
        referenceNumber: `REC-DEP-${seqNo++}`,
        status: ReceiptStatus.RECORDED,
        paidAt: new Date(`${TODAY_STR}T10:45:00.000Z`),
        createdBy: staff.id,
      },
    });
  }

  // 10 In-House Preparing Departure Today
  for (let i = 34; i < 44; i++) {
    const cust = customerList[(i + 45) % customerList.length]!;
    const staff = randomChoice(staffList);
    const stayNights = 3;
    const departureDate = new Date(`${TODAY_STR}T00:00:00.000Z`);
    const arrivalDate = new Date(departureDate.getTime() - stayNights * ONE_DAY_MS);
    const room = pickAvailableRoom(arrivalDate, departureDate);
    if (!room) continue;

    occupiedRoomIds.add(room.id);
    const rate = room.priceOverride || room.category.basePrice;

    await prisma.reservation.create({
      data: {
        id: generateId("res"),
        reservationNo: `RES-TODAY-DEP-PEND-${seqNo++}`,
        customerId: cust.id,
        propertyId: propId,
        status: ReservationStatus.CONFIRMED,
        createdBy: staff.id,
        specialRequests: "Requested late checkout at 1:00 PM; settled mini-bar charges.",
        rooms: {
          create: {
            id: generateId("rr"),
            roomId: room.id,
            roomCategoryId: room.roomCategoryId,
            arrivalDate,
            departureDate,
            bookedNightlyRate: rate,
            status: AllocationStatus.CHECKED_IN,
            checkedInAt: new Date(arrivalDate.getTime() + 14 * 3600 * 1000),
          },
        },
      },
    });
  }

  // C. MULTI-DAY IN-HOUSE STAYS (Overlapping Today: Arrived earlier, departing later)
  console.log("  • Generating Active In-House Multi-Day Stays...");
  for (let i = 44; i < 80; i++) {
    const cust = customerList[(i + 60) % customerList.length]!;
    const staff = randomChoice(staffList);
    const arrivePastDays = randomInt(1, 4);
    const departFutureDays = randomInt(2, 6);

    const arrivalDate = new Date(TODAY_MS - arrivePastDays * ONE_DAY_MS);
    const departureDate = new Date(TODAY_MS + departFutureDays * ONE_DAY_MS);
    const room = pickAvailableRoom(arrivalDate, departureDate);
    if (!room) continue;

    occupiedRoomIds.add(room.id);
    const rate = room.priceOverride || room.category.basePrice;

    await prisma.reservation.create({
      data: {
        id: generateId("res"),
        reservationNo: `RES-INHOUSE-${seqNo++}`,
        customerId: cust.id,
        propertyId: propId,
        status: ReservationStatus.CONFIRMED,
        createdBy: staff.id,
        specialRequests: "In-house Ayurvedic wellness rejuvenation retreat.",
        rooms: {
          create: {
            id: generateId("rr"),
            roomId: room.id,
            roomCategoryId: room.roomCategoryId,
            arrivalDate,
            departureDate,
            bookedNightlyRate: rate,
            status: AllocationStatus.CHECKED_IN,
            checkedInAt: new Date(arrivalDate.getTime() + 14 * 3600 * 1000),
          },
        },
      },
    });
  }

  // Update physical room statuses (protecting MAINTENANCE and OUT_OF_SERVICE)
  console.log("  • Updating Physical Room States (OCCUPIED, VACANT_DIRTY, VACANT_CLEAN)...");
  for (const roomId of occupiedRoomIds) {
    await prisma.room.update({ where: { id: roomId }, data: { status: RoomStatus.OCCUPIED } });
  }
  for (const roomId of dirtyRoomIds) {
    if (!occupiedRoomIds.has(roomId)) {
      await prisma.room.update({ where: { id: roomId }, data: { status: RoomStatus.VACANT_DIRTY } });
    }
  }
  const protectedRooms = new Set(
    rooms.filter((r) => r.status === RoomStatus.MAINTENANCE || r.status === RoomStatus.OUT_OF_SERVICE).map((r) => r.id)
  );
  for (const room of rooms) {
    if (!occupiedRoomIds.has(room.id) && !dirtyRoomIds.has(room.id) && !protectedRooms.has(room.id)) {
      await prisma.room.update({ where: { id: room.id }, data: { status: RoomStatus.VACANT_CLEAN } });
    }
  }

  // D. PAST DAILY CASH FLOW TRAJECTORY (Every day Nov 01 to Nov 16)
  console.log("\n6. Seeding Continuous Daily Cash Inflows and Outflows for Nov 01–16...");
  for (let day = 1; day <= 16; day++) {
    const dayStr = `2026-11-${day < 10 ? "0" + day : day}`;
    const dayDate = new Date(`${dayStr}T11:00:00.000Z`);

    // Inflows for this day (3 to 5 receipts with proper Income parent records)
    const receiptCount = randomInt(3, 5);
    const incomeHeadCodes = ["INC_REST", "INC_SPA", "INC_BANQ", "INC_TAXI"];
    for (let r = 0; r < receiptCount; r++) {
      const incCode = randomChoice(incomeHeadCodes);
      const headId = incomeHeadMap.get(incCode) || Array.from(incomeHeadMap.values())[0]!;
      const amount = randomInt(18000, 75000);
      const method = randomChoice(["CASH", "CARD", "UPI", "BANK_TRANSFER"]);
      const accId = method === "CASH" ? defaultCashAccId : method === "UPI" ? upiAccId : defaultBankAccId;

      const incRecord = await prisma.income.create({
        data: {
          id: generateId("inc"),
          propertyId: propId,
          incomeHeadId: headId,
          title: `Daily Service Inflow (${incCode}) - Nov ${day < 10 ? "0" + day : day}`,
          expectedAmount: new Prisma.Decimal(amount),
          incomeDate: dayDate,
          status: IncomeStatus.RECEIVED,
          createdBy: randomChoice(staffList).id,
        },
      });

      await prisma.receipt.create({
        data: {
          id: generateId("rec"),
          propertyId: propId,
          incomeId: incRecord.id,
          accountId: accId,
          paymentMethodCode: method,
          amount: new Prisma.Decimal(amount),
          referenceNumber: `REC-PAST-${day}-${r}-${seqNo++}`,
          status: ReceiptStatus.RECORDED,
          paidAt: dayDate,
          createdBy: randomChoice(staffList).id,
        },
      });
    }

    // Outflow expenses for this day (1 to 3 payments)
    const expHeadCode = randomChoice(["FNB_GROCERY", "UTIL_ELEC", "MAINTENANCE", "HK_SUPPLIES", "STAFF_WELFARE"]);
    const headId = expenseHeadMap.get(expHeadCode)!;
    const expAmount = randomInt(8000, 48000);

    const expense = await prisma.expense.create({
      data: {
        id: generateId("exp"),
        propertyId: propId,
        expenseHeadId: headId,
        title: `Daily Operating Disbursal - ${expHeadCode}`,
        amount: new Prisma.Decimal(expAmount),
        expenseDate: dayDate,
        status: ExpenseStatus.PAID,
        createdBy: adminUser.id,
      },
    });

    await prisma.payment.create({
      data: {
        id: generateId("pay"),
        propertyId: propId,
        expenseId: expense.id,
        accountId: defaultBankAccId,
        paymentMethodCode: "BANK_TRANSFER",
        amount: new Prisma.Decimal(expAmount),
        referenceNumber: `PAY-PAST-${day}-${seqNo++}`,
        status: PaymentStatus.RECORDED,
        paidAt: dayDate,
        createdBy: adminUser.id,
      },
    });
  }

  // E. TODAY'S DIRECT INCOMES & OPERATING EXPENSES (Nov 17)
  console.log("\n7. Seeding Today's Direct Incomes & Operating Expenses (Nov 17)...");
  const todayIncomes = [
    { title: "Grand Orchid Banquet & Lawn Wedding Reception", head: "INC_BANQ", amt: 250000, method: "BANK_TRANSFER", acc: defaultBankAccId },
    { title: "Ayurvedic Panchakarma Full Day Wellness Packages", head: "INC_SPA", amt: 65000, method: "CARD", acc: defaultBankAccId },
    { title: "Airport Mercedes-Benz V-Class Chauffeur Transfers", head: "INC_TAXI", amt: 18500, method: "UPI", acc: upiAccId },
    { title: "Rooftop Executive Pavilion Corporate Seminar Day 1", head: "INC_CONF", amt: 45000, method: "BANK_TRANSFER", acc: defaultBankAccId },
    { title: "Cafe Promenade Walk-In Artisanal Day Receipts", head: "INC_REST", amt: 32000, method: "CASH", acc: defaultCashAccId },
    { title: "Poolside Luxury Cabana Day Hire & Refreshments", head: "INC_SPA", amt: 15000, method: "UPI", acc: upiAccId },
  ];

  for (const inc of todayIncomes) {
    const headId = incomeHeadMap.get(inc.head) || Array.from(incomeHeadMap.values())[0]!;
    const income = await prisma.income.create({
      data: {
        id: generateId("inc"),
        propertyId: propId,
        incomeHeadId: headId,
        title: inc.title,
        expectedAmount: new Prisma.Decimal(inc.amt),
        incomeDate: new Date(`${TODAY_STR}T09:00:00.000Z`),
        status: IncomeStatus.RECEIVED,
        createdBy: adminUser.id,
      },
    });

    await prisma.receipt.create({
      data: {
        id: generateId("rec"),
        propertyId: propId,
        incomeId: income.id,
        accountId: inc.acc,
        paymentMethodCode: inc.method,
        amount: new Prisma.Decimal(inc.amt),
        referenceNumber: `REC-INC-${seqNo++}`,
        status: ReceiptStatus.RECORDED,
        paidAt: new Date(`${TODAY_STR}T11:30:00.000Z`),
        createdBy: adminUser.id,
      },
    });
  }

  const todayExpenses = [
    { title: "Daily Hydroponic Farm Vegetables, Herbs & Fresh Dairy", head: "FNB_GROCERY", amt: 42500, method: "BANK_TRANSFER", acc: defaultBankAccId },
    { title: "Commercial Linen Dry Cleaning & Steam Pressing Service", head: "HK_SUPPLIES", amt: 26000, method: "CASH", acc: defaultCashAccId },
    { title: "Emergency Elevator Sensor Calibration & Safety Certification", head: "MAINTENANCE", amt: 18500, method: "BANK_TRANSFER", acc: defaultBankAccId },
    { title: "Diesel Refill (1,200L) for Standby DG Power Generators", head: "UTIL_ELEC", amt: 52000, method: "BANK_TRANSFER", acc: defaultBankAccId },
    { title: "Frontline Operations Staff Daily Meal & Transport Allowance", head: "STAFF_WELFARE", amt: 16500, method: "CASH", acc: defaultCashAccId },
    { title: "Fire Safety Hydrant Pressure Recalibration", head: "MAINTENANCE", amt: 24000, method: "BANK_TRANSFER", acc: defaultBankAccId },
  ];

  for (const exp of todayExpenses) {
    const headId = expenseHeadMap.get(exp.head) || Array.from(expenseHeadMap.values())[0]!;
    const expense = await prisma.expense.create({
      data: {
        id: generateId("exp"),
        propertyId: propId,
        expenseHeadId: headId,
        title: exp.title,
        amount: new Prisma.Decimal(exp.amt),
        expenseDate: new Date(`${TODAY_STR}T10:00:00.000Z`),
        status: ExpenseStatus.PAID,
        createdBy: adminUser.id,
      },
    });

    await prisma.payment.create({
      data: {
        id: generateId("pay"),
        propertyId: propId,
        expenseId: expense.id,
        accountId: exp.acc,
        paymentMethodCode: exp.method,
        amount: new Prisma.Decimal(exp.amt),
        referenceNumber: `PAY-TODAY-${seqNo++}`,
        status: PaymentStatus.RECORDED,
        paidAt: new Date(`${TODAY_STR}T12:00:00.000Z`),
        createdBy: adminUser.id,
      },
    });
  }

  // F. FUTURE RESERVATIONS (Nov 18, 2026 – Jan 15, 2027)
  console.log("\n8. Seeding Confirmed Future Reservations & Advance Deposits...");
  const futureArrivalOffsets = [
    1, 2, 3, 4, 5, 7, 8, 10, 12, 14, 18, 21, 25, 35, 42, 45, 50, 55, 60
  ];

  for (let f = 0; f < 50; f++) {
    const offset = futureArrivalOffsets[f % futureArrivalOffsets.length]!;
    const cust = customerList[(f + 90) % customerList.length]!;
    const staff = randomChoice(staffList);
    const stayNights = randomInt(2, 6);

    const arrivalDate = new Date(TODAY_MS + offset * ONE_DAY_MS);
    const departureDate = new Date(arrivalDate.getTime() + stayNights * ONE_DAY_MS);
    const room = pickAvailableRoom(arrivalDate, departureDate);
    if (!room) continue;

    const rate = room.priceOverride || room.category.basePrice;
    const grandTotal = rate.mul(stayNights);

    const res = await prisma.reservation.create({
      data: {
        id: generateId("res"),
        reservationNo: `RES-FUT-${seqNo++}`,
        customerId: cust.id,
        propertyId: propId,
        status: ReservationStatus.CONFIRMED,
        createdBy: staff.id,
        specialRequests: "Advance booking confirmed; 50% deposit received via online payment.",
        rooms: {
          create: {
            id: generateId("rr"),
            roomId: room.id,
            roomCategoryId: room.roomCategoryId,
            arrivalDate,
            departureDate,
            bookedNightlyRate: rate,
            status: AllocationStatus.CONFIRMED,
          },
        },
      },
      include: { rooms: true },
    });

    // Advance deposit invoice & receipt for future booking
    const depositAmount = grandTotal.mul(new Prisma.Decimal("0.50"));
    const inv = await prisma.invoice.create({
      data: {
        id: generateId("inv"),
        reservationId: res.id,
        propertyId: propId,
        invoiceNumber: `INV-ADV-${seqNo++}`,
        subtotal: depositAmount,
        discountTotal: new Prisma.Decimal(0),
        taxTotal: depositAmount.mul(new Prisma.Decimal("0.12")),
        grandTotal: depositAmount.mul(new Prisma.Decimal("1.12")),
        status: InvoiceStatus.PAID,
        issuedAt: new Date(),
        items: {
          create: {
            id: generateId("ii"),
            reservationRoomId: res.rooms[0]!.id,
            description: `50% Advance Booking Deposit for ${arrivalDate.toISOString().split("T")[0]}`,
            quantity: new Prisma.Decimal(1),
            unitPrice: depositAmount,
            lineTotal: depositAmount,
            itemType: InvoiceItemType.EXTRA_CHARGE,
          },
        },
      },
    });

    await prisma.receipt.create({
      data: {
        id: generateId("rec"),
        propertyId: propId,
        invoiceId: inv.id,
        accountId: defaultBankAccId,
        paymentMethodCode: "CARD",
        amount: inv.grandTotal,
        referenceNumber: `REC-ADV-${seqNo++}`,
        status: ReceiptStatus.RECORDED,
        paidAt: new Date(),
        createdBy: staff.id,
      },
    });
  }

  // G. UNPAID / AGED RECEIVABLES (For Folio Receivables Report)
  console.log("\n9. Seeding Outstanding Folio Invoices Across Aging Buckets (0-7d, 8-14d, 15-30d, 30+d)...");
  const agedFolios = [
    { daysAgo: 3, amt: 28500, desc: "Departed Guest Folio - Unsettled Corporate Bill" },
    { daysAgo: 6, amt: 45000, desc: "Departed Wedding Party Room Block Balance" },
    { daysAgo: 10, amt: 62000, desc: "Departed Tour Group Balance - Settlement in Process" },
    { daysAgo: 22, amt: 85000, desc: "Late October Corporate Retreat Balance" },
    { daysAgo: 45, amt: 120000, desc: "Early October High-Value Event Folio" },
  ];

  for (const af of agedFolios) {
    const cust = randomChoice(customerList);
    const invoiceDate = new Date(TODAY_MS - af.daysAgo * ONE_DAY_MS);
    await prisma.invoice.create({
      data: {
        id: generateId("inv"),
        customerId: cust.id,
        customerName: cust.name,
        propertyId: propId,
        invoiceNumber: `INV-AGING-${af.daysAgo}D-${seqNo++}`,
        subtotal: new Prisma.Decimal(af.amt),
        discountTotal: new Prisma.Decimal(0),
        taxTotal: new Prisma.Decimal(af.amt).mul(new Prisma.Decimal("0.12")),
        grandTotal: new Prisma.Decimal(af.amt).mul(new Prisma.Decimal("1.12")),
        status: InvoiceStatus.ISSUED,
        issuedAt: invoiceDate,
        createdAt: invoiceDate,
      },
    });
  }

  console.log("\n================================================================================");
  console.log("✅ Comprehensive Seeding Complete!");
  console.log(`• Today (${TODAY_STR}): Arrivals, Departures, Active In-House, Receipts & Expenses`);
  console.log("• Past (Aug – Nov 16): Continuous Cash Flow, Occupancy Trajectory & Aged Receivables");
  console.log("• Future (Nov 18 – Jan 2027): Confirmed Bookings & Advance Deposits");
  console.log("================================================================================\n");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
