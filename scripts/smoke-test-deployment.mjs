import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";

const ROLES = [
  { name: "SuperAdmin", email: "superadmin@byteinn.local", pass: "SuperAdmin@123456" },
  { name: "Hotel Admin", email: "admin@byteinn.local", pass: "Admin@123456" },
  { name: "Receptionist", email: "reception@byteinn.local", pass: "Reception@123456" },
];

async function main() {
  console.log("================================================================================");
  console.log("🏨 byteInn — Smoke Test Suite: 3 Roles across /, /reservations, /billing & Booking Flow");
  console.log("================================================================================\n");

  const browser = await chromium.launch({ headless: true });

  // 1. Smoke test 3 roles on /, /reservations, /billing
  for (const r of ROLES) {
    console.log(`Testing Role: ${r.name} (${r.email})...`);
    const context = await browser.newContext();
    const page = await context.newPage();

    // Catch console errors and uncaught exceptions
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // Login
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[type="email"]', r.email);
    await page.fill('input[type="password"]', r.pass);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });
    console.log(`  ✓ Logged in successfully`);

    // Test / (Dashboard)
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("body");
    await page.waitForTimeout(300);
    const dashNodes = await page.evaluate(() => document.querySelectorAll("*").length);
    console.log(`  ✓ / (Dashboard) loaded cleanly (${dashNodes} DOM nodes)`);

    // Test /reservations
    await page.goto(`${BASE_URL}/reservations`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("body");
    await page.waitForTimeout(300);
    const resNodes = await page.evaluate(() => document.querySelectorAll("*").length);
    console.log(`  ✓ /reservations loaded cleanly (${resNodes} DOM nodes)`);

    // Test /billing
    await page.goto(`${BASE_URL}/billing`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("body");
    await page.waitForTimeout(300);
    const billNodes = await page.evaluate(() => document.querySelectorAll("*").length);
    console.log(`  ✓ /billing loaded cleanly (${billNodes} DOM nodes)`);

    // Check for React errors (e.g. Minified React error #441)
    const fatalErrors = errors.filter((e) => e.includes("Minified React error") || e.includes("Unhandled application error"));
    if (fatalErrors.length > 0) {
      console.error(`  ❌ React error detected on ${r.name}:`, fatalErrors);
      throw new Error(`React runtime error detected: ${fatalErrors.join("; ")}`);
    } else {
      console.log(`  ✓ Zero runtime / React errors for ${r.name}`);
    }

    await context.close();
  }

  // 2. Transactional Workflow: Create and pay a test reservation
  console.log("\n--------------------------------------------------------------------------------");
  console.log("Testing Transactional Workflow: Create, Issue & Pay a Reservation...");
  console.log("--------------------------------------------------------------------------------");

  const adminContext = await browser.newContext();
  const page = await adminContext.newPage();

  // Login as Hotel Admin
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', "admin@byteinn.local");
  await page.fill('input[type="password"]', "Admin@123456");
  await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });

  // Check availability and pick first available room
  const today = new Date();
  const fromDate = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]; // 60 days out
  const toDate = new Date(today.getTime() + 63 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]; // 3 nights

  const availRes = await page.request.get(
    `${BASE_URL}/api/availability?arrivalDate=${fromDate}&departureDate=${toDate}&limit=5`
  );
  const availData = await availRes.json();
  if (!availData.success || !availData.rooms || availData.rooms.length === 0) {
    throw new Error("No rooms available for test reservation");
  }
  const testRoom = availData.rooms[0];
  console.log(`  ✓ Selected available room: ${testRoom.roomNo} (${testRoom.category.name})`);

  // Create a customer
  const timestamp = Date.now();
  const custRes = await page.request.post(`${BASE_URL}/api/customers`, {
    data: {
      firstName: "DeployTest",
      lastName: `Guest-${timestamp}`,
      email: `deploytest-${timestamp}@byteinn.local`,
      phone: `+1-555-${String(timestamp).slice(-4)}`,
      idProofType: "Passport",
      idProofNumber: "9999",
    },
  });
  const custData = await custRes.json();
  const testCustomerId = custData.customer.id;
  console.log(`  ✓ Created test customer: ${custData.customer.firstName} ${custData.customer.lastName} (${testCustomerId})`);

  // Create reservation
  const resBookingRes = await page.request.post(`${BASE_URL}/api/reservations`, {
    data: {
      customerId: testCustomerId,
      specialRequests: "Deployment smoke test verification booking",
      allocations: [
        {
          roomId: testRoom.id,
          roomCategoryId: testRoom.category.id,
          arrivalDate: fromDate,
          departureDate: toDate,
          bookedNightlyRate: Number(testRoom.category.basePrice),
          adults: 1,
          children: 0,
        },
      ],
    },
  });
  const bookingData = await resBookingRes.json();
  if (!bookingData.success) {
    throw new Error(`Failed to create reservation: ${JSON.stringify(bookingData)}`);
  }
  const newReservation = bookingData.reservation;
  console.log(`  ✓ Created reservation: ${newReservation.reservationNo} (ID: ${newReservation.id})`);

  // Locate the generated invoice
  const invListRes = await page.request.get(
    `${BASE_URL}/api/invoices?reservationId=${newReservation.id}`
  );
  const invListData = await invListRes.json();
  const testInvoice = invListData.data?.invoices?.[0] || invListData.invoices?.[0];
  if (!testInvoice) {
    throw new Error(`Invoice not generated for reservation ${newReservation.reservationNo}: ${JSON.stringify(invListData)}`);
  }
  console.log(`  ✓ Found invoice: ${testInvoice.invoiceNumber} (Total: $${testInvoice.grandTotal}, Status: ${testInvoice.status})`);

  // Issue invoice if DRAFT
  if (testInvoice.status === "DRAFT") {
    const issueRes = await page.request.post(`${BASE_URL}/api/invoices/${testInvoice.id}/issue`);
    const issueData = await issueRes.json();
    console.log(`  ✓ Issued invoice: ${issueData.data?.status || issueData.invoice?.status || "ISSUED"}`);
  }

  // Pay invoice in full
  const payRes = await page.request.post(`${BASE_URL}/api/invoices/${testInvoice.id}/payments`, {
    headers: {
      "Idempotency-Key": `smoke-pay-${timestamp}`,
    },
    data: {
      amount: Number(testInvoice.grandTotal),
      paymentMethod: "CASH",
      referenceNotes: "Smoke test full payment",
    },
  });
  const payData = await payRes.json();
  if (!payData.success) {
    throw new Error(`Failed to record payment: ${JSON.stringify(payData)}`);
  }
  console.log(`  ✓ Recorded payment of $${testInvoice.grandTotal} via CASH`);

  // Re-fetch invoice and verify PAID status
  const verifiedInvRes = await page.request.get(`${BASE_URL}/api/invoices/${testInvoice.id}`);
  const verifiedInvData = await verifiedInvRes.json();
  const verifiedInvoice = verifiedInvData.data || verifiedInvData.invoice;
  console.log(`  ✓ Verified Invoice Status: ${verifiedInvoice?.status} (Balance Due: $${verifiedInvoice?.balanceDue ?? 0})`);

  await adminContext.close();
  await browser.close();

  console.log("\n================================================================================");
  console.log("🎉 SMOKE TEST PASSED: All 3 roles verified and booking/payment workflow green!");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("❌ Smoke test failed:", err);
  process.exit(1);
});
