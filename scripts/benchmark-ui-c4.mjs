import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const USERS = [
  {
    roleName: "Hotel A Admin",
    email: "admin@byteinn.local",
    password: "Admin@123456",
  },
  {
    roleName: "SuperAdmin",
    email: "superadmin@byteinn.local",
    password: "SuperAdmin@123456",
  },
];

const PAGES = [
  { name: "Dashboard", path: "/" },
  { name: "Rooms Board", path: "/rooms" },
  { name: "Reservations List", path: "/reservations" },
  { name: "Invoices / Billing", path: "/billing" },
  { name: "Customers / Guests", path: "/customers" },
  { name: "Users Management", path: "/users" },
  { name: "Categories", path: "/categories" },
  { name: "Reports Shell", path: "/reports" },
  { name: "Daily Operations (Arrivals)", path: "/reports?tab=daily-ops&opsTab=arrivals" },
  { name: "Daily Operations (In-House)", path: "/reports?tab=daily-ops&opsTab=in-house" },
  { name: "Daily Operations (Departures)", path: "/reports?tab=daily-ops&opsTab=departures" },
  { name: "Availability Grid", path: "/reports?tab=availability" },
  { name: "Financial Report", path: "/reports?tab=financial" },
  { name: "Performance Report", path: "/reports?tab=performance" },
];

async function measurePage(page, url) {
  let transferBytes = 0;
  let documentBytes = 0;

  const onResponse = (response) => {
    try {
      const headers = response.headers();
      const length = parseInt(headers["content-length"] || "0", 10);
      transferBytes += length;
      if (response.url() === url || response.url() === url + "/") {
        documentBytes = length;
      }
    } catch {}
  };

  page.on("response", onResponse);

  const t0 = performance.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForSelector("main, body", { timeout: 10000 });
  // Wait brief tick for hydration and table render
  await page.waitForTimeout(150);
  const loadTimeMs = Math.round(performance.now() - t0);

  page.off("response", onResponse);

  // Measure DOM nodes
  const domNodes = await page.evaluate(() => document.querySelectorAll("*").length);

  return {
    loadTimeMs,
    documentBytes: Math.round(documentBytes / 1024),
    transferBytes: Math.round(transferBytes / 1024),
    domNodes,
  };
}

async function run() {
  console.log("Starting Playwright UI & DOM Benchmarks (Task C4)...");
  const browser = await chromium.launch({ headless: true });

  const allResults = {};

  for (const user of USERS) {
    console.log(`\n========================================`);
    console.log(`Benchmarking Actor: ${user.roleName} (${user.email})`);
    console.log(`========================================`);

    allResults[user.roleName] = [];
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    // Login
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });
    await page.waitForTimeout(500);

    for (const target of PAGES) {
      const url = `${BASE_URL}${target.path}`;
      // Run 3 times to get median and max
      const runs = [];
      for (let i = 0; i < 3; i++) {
        const m = await measurePage(page, url);
        runs.push(m);
        await page.waitForTimeout(100);
      }

      runs.sort((a, b) => a.loadTimeMs - b.loadTimeMs);
      const median = runs[1];
      const maxTime = Math.max(...runs.map((r) => r.loadTimeMs));

      const result = {
        name: target.name,
        path: target.path,
        loadTimeMedianMs: median.loadTimeMs,
        loadTimeMaxMs: maxTime,
        documentKB: median.documentBytes,
        transferKB: median.transferBytes,
        domNodes: median.domNodes,
      };

      allResults[user.roleName].push(result);
      console.log(
        `✓ ${target.name.padEnd(30)} | Median: ${String(result.loadTimeMedianMs).padStart(4)} ms | Max: ${String(result.loadTimeMaxMs).padStart(4)} ms | DOM: ${String(result.domNodes).padStart(5)} nodes | Doc: ${result.documentKB} KB | Total: ${result.transferKB} KB`
      );
    }

    await context.close();
  }

  await browser.close();
  console.log("\nBenchmark Complete!");
  console.log(JSON.stringify(allResults, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
