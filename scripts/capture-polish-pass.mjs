/* eslint-disable no-console */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SCREENSHOT_DIR = path.join(ROOT_DIR, ".screenshots");
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const prisma = new PrismaClient();

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const res6472 = await prisma.reservation.findUnique({
    where: { reservationNo: "RES-20261011-6472" },
  });
  const inv6472 = await prisma.invoice.findUnique({
    where: { invoiceNumber: "INV-20261011-6472" },
  });
  const custRinshad = await prisma.customer.findFirst({
    where: { phone: "+91 98765 43210" },
  });

  console.log("IDs for capture:", {
    res6472Id: res6472?.id,
    inv6472Id: inv6472?.id,
    custId: custRinshad?.id,
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // 1. Login page with view password toggle
  console.log("1. Capturing login page with view password toggle...");
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill('input[type="email"]', "admin@byteinn.local");
  await page.fill('input[type="password"]', "Admin@123456");
  // Click view password button
  const toggleBtn = page.locator('button[title="Show password"]');
  if (await toggleBtn.isVisible()) {
    await toggleBtn.click();
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "polish_01_login_view_password.png") });

  // Now login
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });
  await page.waitForLoadState("networkidle");

  // 2. Add Room dialog
  console.log("2. Capturing Add Room dialog...");
  await page.goto(`${BASE_URL}/rooms`);
  await page.waitForLoadState("networkidle");
  const addRoomBtn = page.locator('button:has-text("Add room")').first();
  if (await addRoomBtn.isVisible()) {
    await addRoomBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "polish_02_add_room_dialog.png") });
    // Close dialog
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  // 3. Add Category dialog
  console.log("3. Capturing Add Category dialog...");
  await page.goto(`${BASE_URL}/categories`);
  await page.waitForLoadState("networkidle");
  const addCatBtn = page.locator('button:has-text("Add category")').first();
  if (await addCatBtn.isVisible()) {
    await addCatBtn.click();
    await page.waitForTimeout(400);
    // Click an amenity chip to toggle it on
    const wifiChip = page.locator('button:has-text("Wi-Fi")').first();
    if (await wifiChip.isVisible()) {
      await wifiChip.click();
      await page.waitForTimeout(200);
    }
    const acChip = page.locator('button:has-text("Air Conditioning")').first();
    if (await acChip.isVisible()) {
      await acChip.click();
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "polish_03_add_category_dialog.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  // 4. Reservation details (6472)
  if (res6472) {
    console.log("4. Capturing Reservation 6472 details...");
    await page.goto(`${BASE_URL}/reservations/${res6472.id}`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "polish_04_reservation_details.png") });
  }

  // 5. Invoice details (6472)
  if (inv6472) {
    console.log("5. Capturing Invoice 6472 details...");
    await page.goto(`${BASE_URL}/billing/${inv6472.id}`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "polish_05_invoice_details.png") });
  }

  // 6. Guest Profile (Customer)
  if (custRinshad) {
    console.log("6. Capturing Guest profile with masked ID...");
    await page.goto(`${BASE_URL}/customers/${custRinshad.id}`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "polish_06_guest_profile_masked.png") });
    // Click Replace button
    const replaceBtn = page.locator('button:has-text("Replace")').first();
    if (await replaceBtn.isVisible()) {
      await replaceBtn.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "polish_06_guest_profile_replace_input.png") });
    }
  }

  await browser.close();
  console.log("All UI polish screenshots successfully captured in .screenshots/");
}

main()
  .catch((e) => {
    console.error("Screenshot error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
