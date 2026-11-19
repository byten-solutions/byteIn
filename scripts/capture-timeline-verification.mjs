import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACT_DIR = "/Users/apple/.gemini/antigravity-cli/brain/2ab07185-520e-4cb7-b7ee-ff69760594ca";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PROP_ID = "cprop9b08a85e82f70fe85065";

async function main() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  const page = await context.newPage();

  console.log("1. Logging in as admin@byteinn.local...");
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill('input[type="email"]', "admin@byteinn.local");
  await page.fill('input[type="password"]', "Admin@123456");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  // 1. Dashboard Overview
  console.log("2. Capturing Dashboard Overview with Today's Live Operations & Financial Activity...");
  await page.goto(`${BASE_URL}/?propertyId=${PROP_ID}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "dashboard_timeline_today_preview.png") });

  // 2. Cash Flow Trajectory (Nov 01 - Nov 17)
  console.log("3. Capturing Cash Flow Trajectory Report (Nov 01–17)...");
  await page.goto(`${BASE_URL}/reports/cash-flow?from=2026-11-01&to=2026-11-17&propertyId=${PROP_ID}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "report_cash_flow_nov01_17.png") });

  // 3. Daily Operations Today (Nov 17)
  console.log("4. Capturing Daily Operations Today (Nov 17)...");
  await page.goto(`${BASE_URL}/reports/daily-operations?date=2026-11-17&propertyId=${PROP_ID}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "report_daily_operations_today.png") });

  // 4. Shift Collections Today (Nov 17)
  console.log("5. Capturing Shift Collections Today (Nov 17)...");
  await page.goto(`${BASE_URL}/reports/collections?from=2026-11-17&to=2026-11-17&propertyId=${PROP_ID}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "report_collections_today.png") });

  // 5. Occupancy & ADR Trend
  console.log("6. Capturing Occupancy & ADR Trend (Nov 01–17)...");
  await page.goto(`${BASE_URL}/reports/occupancy?from=2026-11-01&to=2026-11-17&propertyId=${PROP_ID}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "report_occupancy_trend.png") });

  // 6. Aged Receivables
  console.log("7. Capturing Aged Folio Receivables...");
  await page.goto(`${BASE_URL}/reports/receivables?propertyId=${PROP_ID}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "report_aged_receivables.png") });

  await browser.close();
  console.log("✅ All verification screenshots saved to artifacts directory successfully!");
}

main().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
