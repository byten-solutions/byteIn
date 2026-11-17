import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SCREENSHOT_DIR = path.join(ROOT_DIR, ".screenshots");
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
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

  // 1. Overview dashboard with sidebar showing Reports categories opened by default
  console.log("Capturing Sidebar with Reports open by default on dashboard...");
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "final_13_sidebar_reports_default_open.png") });

  // 2. Direct navigation to /reports to verify automatic redirect to daily-operations
  console.log("Navigating to /reports to verify automatic redirection...");
  await page.goto(`${BASE_URL}/reports`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  console.log("Current URL after navigating to /reports:", page.url());
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "final_14_reports_redirect.png") });

  await browser.close();
  console.log("✅ Sidebar reports screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
