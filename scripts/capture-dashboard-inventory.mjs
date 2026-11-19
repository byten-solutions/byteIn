import { chromium } from "playwright";
import path from "node:path";

const ARTIFACT_DIR = "/Users/apple/.gemini/antigravity-cli/brain/2ab07185-520e-4cb7-b7ee-ff69760594ca";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
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

  console.log("Navigating to dashboard...");
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  // Scroll down slightly to show Shift Collections & Room Inventory Status cards clearly
  await page.evaluate(() => window.scrollBy(0, 350));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "dashboard_shift_collections_and_inventory.png") });

  await browser.close();
  console.log("✅ Dashboard screenshot captured successfully!");
}

main().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
