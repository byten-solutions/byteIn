import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACT_DIR = "/Users/apple/.gemini/antigravity-cli/brain/2ab07185-520e-4cb7-b7ee-ff69760594ca";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();

  console.log("Logging in as admin@byteinn.local...");
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill('input[type="email"]', "admin@byteinn.local");
  await page.fill('input[type="password"]', "Admin@123456");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  // 1. Occupancy report with scrollable paginated breakdown table
  console.log("Navigating to /reports/occupancy...");
  await page.goto(`${BASE_URL}/reports/occupancy`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  // Scroll down to the table view
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "report_occupancy_scrollable_table.png") });

  // 2. Cash Flow report with scrollable paginated ledger breakdown table
  console.log("Navigating to /reports/cash-flow...");
  await page.goto(`${BASE_URL}/reports/cash-flow`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  // Scroll down to the daily breakdown table
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "report_cash_flow_scrollable_table.png") });

  await browser.close();
  console.log("✅ Scrollable tables screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
