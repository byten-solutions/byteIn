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

// Parse CLI flags: --only=<name>
const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only="))?.split("=")[1]?.toLowerCase() || null;

function shouldRun(name) {
  if (!onlyArg) return true;
  return name.toLowerCase().includes(onlyArg);
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });
}

async function ensureTheme(page, theme) {
  await page.evaluate((t) => {
    if (t === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
  }, theme);
  await page.waitForTimeout(100);
}

async function capture() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // 1. Check data availability in DB without creating anything
  console.log("Checking DB records for dynamic route screenshots...");
  const firstRes = await prisma.reservation.findFirst();
  const firstInv = await prisma.invoice.findFirst({
    include: { payments: true },
  });
  const firstCust = await prisma.customer.findFirst();

  const resId = firstRes ? firstRes.id : null;
  const invId = firstInv ? firstInv.id : null;
  const paymentId = firstInv?.payments[0] ? firstInv.payments[0].id : null;
  const custId = firstCust ? firstCust.id : null;

  console.log({ resId, invId, paymentId, custId });

  const browser = await chromium.launch({ headless: true });

  const themes = ["light", "dark"];
  const viewports = [
    { name: "1280", width: 1280, height: 900 },
    { name: "390", width: 390, height: 844 },
  ];

  for (const theme of themes) {
    for (const vp of viewports) {
      console.log(`\n========================================`);
      console.log(`Capturing: Theme = ${theme.toUpperCase()}, Viewport = ${vp.name}px`);
      console.log(`========================================`);

      const context = await browser.newContext({
        colorScheme: theme,
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();

      // Login as Admin
      await login(page, "admin@byteinn.local", "Admin@123456");

      const takeShot = async (filename, fullPage = true) => {
        await ensureTheme(page, theme);
        const filePath = path.join(SCREENSHOT_DIR, `${vp.name}_${theme}_${filename}.png`);
        await page.screenshot({ path: filePath, fullPage });
        console.log(`  -> Saved: ${path.basename(filePath)}`);
      };

      // 1. / (Overview)
      if (shouldRun("overview")) {
        await page.goto(`${BASE_URL}/`);
        await page.waitForLoadState("networkidle");
        await takeShot("01_overview");
      }

      // 2. /reservations
      if (shouldRun("reservations")) {
        await page.goto(`${BASE_URL}/reservations`);
        await page.waitForLoadState("networkidle");
        await takeShot("02_reservations_list");
      }

      // 3. /reservations/new (all 3 steps + date popover)
      if (shouldRun("reservations-new") || shouldRun("new")) {
        await page.goto(`${BASE_URL}/reservations/new`);
        await page.waitForLoadState("networkidle");
        await takeShot("03_new_res_step1");

        // Try date popover if present
        try {
          const datePickerTrigger = page.locator('button[aria-haspopup="dialog"], button:has-text("Check-in"), button:has-text("From")').first();
          if (await datePickerTrigger.isVisible()) {
            await datePickerTrigger.click();
            await page.waitForTimeout(300);
            await takeShot("03_new_res_date_popover", false);
            await page.keyboard.press("Escape");
            await page.waitForTimeout(200);
          }
        } catch {}

        // Step 2 & 3
        try {
          const addBtn = page.locator('button:has-text("Add")').first();
          if (await addBtn.isVisible()) {
            await addBtn.click();
            await page.waitForTimeout(300);
          }
          const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
          if (await continueBtn.isVisible()) {
            await continueBtn.click();
            await page.waitForTimeout(400);
            await takeShot("04_new_res_step2");

            const newGuestBtn = page.locator('button:has-text("New Guest")').first();
            if (await newGuestBtn.isVisible()) {
              await newGuestBtn.click();
              await page.waitForTimeout(200);
              const firstName = page.locator('input[placeholder*="John"], input[name="firstName"]').first();
              if (await firstName.isVisible()) await firstName.fill("Ramesh Kumar");
            }
            const continueBtn2 = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
            if (await continueBtn2.isVisible()) {
              await continueBtn2.click();
              await page.waitForTimeout(400);
              await takeShot("05_new_res_step3");
            }
          }
        } catch (e) {
          console.log("  [WARN] Stepper navigation note:", e.message);
        }
      }

      // 4. /reservations/[id]
      if (shouldRun("reservation-detail")) {
        if (resId) {
          await page.goto(`${BASE_URL}/reservations/${resId}`);
          await page.waitForLoadState("networkidle");
          await takeShot("06_reservation_detail");
        } else {
          console.log("  [SKIP] /reservations/[id]: No reservation in DB");
        }
      }

      // 5. /billing
      if (shouldRun("billing")) {
        await page.goto(`${BASE_URL}/billing`);
        await page.waitForLoadState("networkidle");
        await takeShot("07_billing_list");
      }

      // 6. /billing/[id] + dialogs
      if (shouldRun("billing-detail")) {
        if (invId) {
          await page.goto(`${BASE_URL}/billing/${invId}`);
          await page.waitForLoadState("networkidle");
          await takeShot("08_billing_detail");

          // Add charge dialog
          const addChargeBtn = page.locator('button:has-text("Add charge"), button:has-text("Add Charge")').first();
          if (await addChargeBtn.isVisible()) {
            await addChargeBtn.click();
            await page.waitForTimeout(300);
            await takeShot("09_billing_add_charge_dialog", false);
            const cancelBtn = page.locator('button:has-text("Cancel")').first();
            if (await cancelBtn.isVisible()) await cancelBtn.click();
            await page.waitForTimeout(200);
          }

          // Record payment dialog
          const recordPaymentBtn = page.locator('button:has-text("Record Payment"), button:has-text("Record payment")').first();
          if (await recordPaymentBtn.isVisible()) {
            await recordPaymentBtn.click();
            await page.waitForTimeout(300);
            await takeShot("10_billing_record_payment_dialog", false);
            const cancelBtn = page.locator('button:has-text("Cancel")').first();
            if (await cancelBtn.isVisible()) await cancelBtn.click();
            await page.waitForTimeout(200);
          }

          // Receipt modal (if payment row exists)
          const receiptBtn = page.locator('button:has-text("Receipt"), button:has-text("View Receipt")').first();
          if (await receiptBtn.isVisible()) {
            await receiptBtn.click();
            await page.waitForTimeout(300);
            await takeShot("11_billing_receipt_modal", false);
            const closeBtn = page.locator('button:has-text("Close"), button:has-text("Cancel")').first();
            if (await closeBtn.isVisible()) await closeBtn.click();
            await page.waitForTimeout(200);
          }

          // Print pages (Task 3)
          try {
            await page.goto(`${BASE_URL}/billing/${invId}/print`);
            await page.waitForLoadState("networkidle");
            if (!page.url().includes("404")) {
              await takeShot("12_invoice_print");
            }
          } catch {}

          if (paymentId) {
            try {
              await page.goto(`${BASE_URL}/billing/${invId}/receipts/${paymentId}/print`);
              await page.waitForLoadState("networkidle");
              if (!page.url().includes("404")) {
                await takeShot("13_receipt_print");
              }
            } catch {}
          }
        } else {
          console.log("  [SKIP] /billing/[id]: No invoice in DB");
        }
      }

      // 7. /customers & /customers/[id]
      if (shouldRun("customers")) {
        await page.goto(`${BASE_URL}/customers`);
        await page.waitForLoadState("networkidle");
        await takeShot("14_customers_list");

        if (custId) {
          await page.goto(`${BASE_URL}/customers/${custId}`);
          await page.waitForLoadState("networkidle");
          await takeShot("15_customer_detail");
        } else {
          console.log("  [SKIP] /customers/[id]: No customer in DB");
        }
      }

      // 8. /rooms + modals
      if (shouldRun("rooms")) {
        await page.goto(`${BASE_URL}/rooms`);
        await page.waitForLoadState("networkidle");
        await takeShot("16_rooms_board");

        // Add room modal
        const addRoomBtn = page.locator('button:has-text("Add room"), button:has-text("Add Room")').first();
        if (await addRoomBtn.isVisible()) {
          await addRoomBtn.click();
          await page.waitForTimeout(300);
          await takeShot("17_rooms_add_modal", false);
          const cancelBtn = page.locator('button:has-text("Cancel")').first();
          if (await cancelBtn.isVisible()) await cancelBtn.click();
          await page.waitForTimeout(200);
        }

        // Status change modal
        const changeStatusBtn = page.locator('button:has-text("Change status"), button:has-text("Update status")').first();
        if (await changeStatusBtn.isVisible()) {
          await changeStatusBtn.click();
          await page.waitForTimeout(300);
          await takeShot("18_rooms_status_modal", false);
          const cancelBtn = page.locator('button:has-text("Cancel")').first();
          if (await cancelBtn.isVisible()) await cancelBtn.click();
          await page.waitForTimeout(200);
        }
      }

      // 9. /categories + modal
      if (shouldRun("categories")) {
        await page.goto(`${BASE_URL}/categories`);
        await page.waitForLoadState("networkidle");
        await takeShot("19_categories_list");

        const addCatBtn = page.locator('button:has-text("Add Category"), button:has-text("Add category")').first();
        if (await addCatBtn.isVisible()) {
          await addCatBtn.click();
          await page.waitForTimeout(300);
          await takeShot("20_categories_add_modal", false);
          const cancelBtn = page.locator('button:has-text("Cancel")').first();
          if (await cancelBtn.isVisible()) await cancelBtn.click();
          await page.waitForTimeout(200);
        }
      }

      // 10. 404 page
      if (shouldRun("404")) {
        await page.goto(`${BASE_URL}/non-existent-sample-page-404`);
        await page.waitForLoadState("networkidle");
        await takeShot("21_not_found_page");
      }

      // 11. Collapsed sidebar & user account menu (at 1280px)
      if (vp.name === "1280" && shouldRun("sidebar")) {
        await page.goto(`${BASE_URL}/`);
        await page.waitForLoadState("networkidle");

        // Toggle sidebar collapse if button exists
        const collapseBtn = page.locator('button[aria-label*="sidebar"], button[title*="sidebar"], button:has-text("Collapse")').first();
        if (await collapseBtn.isVisible()) {
          await collapseBtn.click();
          await page.waitForTimeout(300);
          await takeShot("22_sidebar_collapsed");
        }

        // Open user account menu
        await page.evaluate(() => {
          document.querySelectorAll('nextjs-portal').forEach(el => el.remove());
        }).catch(() => {});
        const userMenuBtn = page.locator('button[aria-label="User account menu"], button:has-text("Administrator")').first();
        if (await userMenuBtn.isVisible()) {
          await userMenuBtn.click({ force: true });
          await page.waitForTimeout(300);
          await takeShot("23_user_account_menu_open", false);
        }
      }

      await context.close();
    }
  }

  // 12. 768px tablet width checks for /rooms, /reservations/new, /billing/[id]
  if (shouldRun("tablet") || shouldRun("768")) {
    console.log(`\n========================================`);
    console.log(`Capturing: Tablet 768px checks (light & dark)`);
    console.log(`========================================`);

    for (const theme of themes) {
      const tabContext = await browser.newContext({
        colorScheme: theme,
        viewport: { width: 768, height: 1024 },
      });
      const tab = await tabContext.newPage();
      await login(tab, "admin@byteinn.local", "Admin@123456");

      const takeTabShot = async (filename) => {
        await ensureTheme(tab, theme);
        const filePath = path.join(SCREENSHOT_DIR, `768_${theme}_${filename}.png`);
        await tab.screenshot({ path: filePath, fullPage: true });
        console.log(`  -> Saved: ${path.basename(filePath)}`);
      };

      await tab.goto(`${BASE_URL}/rooms`);
      await tab.waitForLoadState("networkidle");
      await takeTabShot("rooms_board");

      await tab.goto(`${BASE_URL}/reservations/new`);
      await tab.waitForLoadState("networkidle");
      await takeTabShot("reservations_new");

      if (invId) {
        await tab.goto(`${BASE_URL}/billing/${invId}`);
        await tab.waitForLoadState("networkidle");
        await takeTabShot("billing_detail");
      }

      await tabContext.close();
    }
  }

  // 13. Receptionist role checks
  if (shouldRun("receptionist")) {
    console.log(`\n========================================`);
    console.log(`Capturing: Receptionist Role Inspection`);
    console.log(`========================================`);
    const recContext = await browser.newContext({
      colorScheme: "light",
      viewport: { width: 1280, height: 900 },
    });
    const rec = await recContext.newPage();
    await login(rec, "reception@byteinn.local", "Reception@123456");

    await rec.goto(`${BASE_URL}/categories`);
    await rec.waitForLoadState("networkidle");
    const recPath = path.join(SCREENSHOT_DIR, `1280_light_receptionist_categories_readonly.png`);
    await rec.screenshot({ path: recPath, fullPage: true });
    console.log(`  -> Saved: ${path.basename(recPath)}`);

    await recContext.close();
  }

  await browser.close();
  await prisma.$disconnect();
  console.log("\nScreenshot capture run completed!");
}

capture().catch(async (err) => {
  console.error("Screenshot error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
