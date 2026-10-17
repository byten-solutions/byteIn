import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  RoleName,
  RoomStatus,
  InvoiceStatus,
  PaymentStatus,
  AllocationStatus,
  ReservationStatus,
  Prisma,
} from "@prisma/client";
import { BillingService } from "../src/modules/billing/billing.service";
import { ReservationService } from "../src/modules/reservations/reservation.service";
import { CustomerService } from "../src/modules/customers/customer.service";
import { CheckInOutService } from "../src/modules/check-in-out/check-in-out.service";
import { enforceRole } from "../src/lib/auth-guard";
import type { SessionPayload } from "../src/modules/auth/auth.types";
import { getHotelTodayDate } from "../src/lib/date";

describe("Phase 6: Billing & Payments Tests", () => {
  let testStaffUserId: string;
  let testPropertyId: string;
  let testBuildingId: string;
  let testFloorId: string;
  let testCategoryId: string;
  let room301Id: string;
  let room302Id: string;
  let testCustomerId: string;
  let testReservationId: string;
  let secondReservationId: string;

  const adminSession: SessionPayload = {
    sub: "admin-billing-test",
    email: "admin@byteinn.test",
    role: RoleName.ADMIN,
    name: "Admin User",
  };

  const receptionistSession: SessionPayload = {
    sub: "rec-billing-test",
    email: "rec@byteinn.test",
    role: RoleName.RECEPTIONIST,
    name: "Receptionist User",
  };

  before(async () => {
    // 1. Staff User
    await prisma.user.deleteMany({ where: { email: "staff.billing@byteinn.test" } });
    const user = await prisma.user.create({
      data: {
        email: "staff.billing@byteinn.test",
        passwordHash: "hash-test",
        name: "Billing Staff",
        role: {
          connectOrCreate: {
            where: { name: RoleName.RECEPTIONIST },
            create: { name: RoleName.RECEPTIONIST },
          },
        },
      },
    });
    testStaffUserId = user.id;

    // 2. Property, Building, Floor
    const property = await prisma.property.create({
      data: {
        name: "Grand Billing Resort",
        city: "Financetown",
        status: "ACTIVE",
      },
    });
    testPropertyId = property.id;

    const building = await prisma.building.create({
      data: {
        propertyId: property.id,
        name: "Billing Tower",
      },
    });
    testBuildingId = building.id;

    const floor = await prisma.floor.create({
      data: {
        buildingId: building.id,
        floorNo: 3,
        name: "Floor 3",
      },
    });
    testFloorId = floor.id;

    // 3. Room Category
    const category = await prisma.roomCategory.create({
      data: {
        propertyId: property.id,
        name: "Executive Suite",
        description: "Suite with office space",
        basePrice: new Prisma.Decimal("150.00"),
        maxOccupancy: 2,
      },
    });
    testCategoryId = category.id;

    // 4. Physical Rooms
    // Room 301: base rate $150.00
    const r301 = await prisma.room.create({
      data: {
        propertyId: property.id,
        buildingId: building.id,
        floorId: floor.id,
        roomCategoryId: category.id,
        roomNo: "301",
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
      },
    });
    room301Id = r301.id;

    // Room 302: price override $200.00
    const r302 = await prisma.room.create({
      data: {
        propertyId: property.id,
        buildingId: building.id,
        floorId: floor.id,
        roomCategoryId: category.id,
        roomNo: "302",
        capacity: 2,
        status: RoomStatus.VACANT_CLEAN,
        priceOverride: new Prisma.Decimal("200.00"),
      },
    });
    room302Id = r302.id;

    // 5. Customer
    const customer = await CustomerService.createCustomer({
      firstName: "Michael",
      lastName: "Corleone",
      phone: "+1-555-4422",
      email: "michael.c@billing.test",
      nationality: "American",
      idProofType: "Passport",
      idProofNumber: "MC889900",
    });
    testCustomerId = customer.id;

    // 6. Primary Multi-Room Reservation
    // Room 301: Nov 1 to Nov 4 (3 nights @ $150.00 = $450.00)
    // Room 302: Nov 1 to Nov 3 (2 nights @ $200.00 = $400.00)
    // Total Room Cost = $850.00
    const reservation = await ReservationService.createReservation(
      {
        customerId: testCustomerId,
        allocations: [
          {
            roomId: room301Id,
            arrivalDate: "2026-11-01",
            departureDate: "2026-11-04",
          },
          {
            roomId: room302Id,
            arrivalDate: "2026-11-01",
            departureDate: "2026-11-03",
          },
        ],
      },
      testStaffUserId
    );
    testReservationId = reservation.id;

    // 7. Second Reservation for separate tests
    const res2 = await ReservationService.createReservation(
      {
        customerId: testCustomerId,
        allocations: [
          {
            roomId: room301Id,
            arrivalDate: "2026-11-10",
            departureDate: "2026-11-12", // 2 nights @ $150 = $300.00
          },
        ],
      },
      testStaffUserId
    );
    secondReservationId = res2.id;
  });

  after(async () => {
    // Cascade-safe cleanup
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { userId: testStaffUserId },
          { entityType: "Invoice" },
          { entityType: "Payment" },
        ],
      },
    });

    await prisma.payment.deleteMany({
      where: { createdBy: testStaffUserId },
    });

    await prisma.invoiceItem.deleteMany({
      where: {
        invoice: {
          OR: [
            { reservationId: { in: [testReservationId, secondReservationId] } },
            { reservation: { createdBy: testStaffUserId } },
          ],
        },
      },
    });

    await prisma.invoice.deleteMany({
      where: {
        OR: [
          { reservationId: { in: [testReservationId, secondReservationId] } },
          { reservation: { createdBy: testStaffUserId } },
        ],
      },
    });

    await prisma.reservationRoom.deleteMany({
      where: { roomId: { in: [room301Id, room302Id] } },
    });

    await prisma.reservation.deleteMany({
      where: { createdBy: testStaffUserId },
    });

    await prisma.customer.deleteMany({
      where: { email: { contains: "billing.test" } },
    });

    await prisma.room.deleteMany({
      where: { propertyId: testPropertyId },
    });

    await prisma.roomCategory.deleteMany({
      where: { id: testCategoryId },
    });

    await prisma.floor.deleteMany({
      where: { id: testFloorId },
    });

    await prisma.building.deleteMany({
      where: { id: testBuildingId },
    });

    await prisma.property.deleteMany({
      where: { id: testPropertyId },
    });

    await prisma.user.deleteMany({
      where: { id: testStaffUserId },
    });
  });

  describe("1. Invoice Generation & Rate Preservation", () => {
    let createdInvoiceId: string;

    it("should generate itemized invoice with accurate nights and snapshotted room rates", async () => {
      const invoice = await BillingService.createInvoiceForReservation(
        {
          reservationId: testReservationId,
          autoIssue: false,
        },
        testStaffUserId
      );

      assert.ok(invoice.id);
      assert.ok(invoice.invoiceNumber.startsWith("INV-"));
      assert.equal(invoice.reservationId, testReservationId);
      assert.equal(invoice.status, InvoiceStatus.DRAFT);
      assert.equal(invoice.items.length, 2);

      // Verify Room 301 item: 3 nights @ $150.00 = $450.00
      const r301Item = invoice.items.find((i) => i.description.includes("Room 301"));
      assert.ok(r301Item);
      assert.equal(r301Item.quantity, "3.00");
      assert.equal(r301Item.unitPrice, "150.00");
      assert.equal(r301Item.lineTotal, "450.00");

      // Verify Room 302 item: 2 nights @ $200.00 = $400.00
      const r302Item = invoice.items.find((i) => i.description.includes("Room 302"));
      assert.ok(r302Item);
      assert.equal(r302Item.quantity, "2.00");
      assert.equal(r302Item.unitPrice, "200.00");
      assert.equal(r302Item.lineTotal, "400.00");

      // Subtotal & Grand Total: $450.00 + $400.00 = $850.00
      assert.equal(invoice.subtotal, "850.00");
      assert.equal(invoice.discountTotal, "0.00");
      assert.equal(invoice.taxTotal, "0.00");
      assert.equal(invoice.grandTotal, "850.00");
      assert.equal(invoice.totalPaid, "0.00");
      assert.equal(invoice.balanceDue, "850.00");

      createdInvoiceId = invoice.id;
    });

    it("should reject creating a second active invoice for the same reservation", async () => {
      await assert.rejects(
        async () => {
          await BillingService.createInvoiceForReservation(
            { reservationId: testReservationId },
            testStaffUserId
          );
        },
        /already exists for this reservation/
      );
    });

    it("should preserve booked rates even if room category base price is updated later", async () => {
      // Modify RoomCategory basePrice to $999.00
      await prisma.roomCategory.update({
        where: { id: testCategoryId },
        data: { basePrice: new Prisma.Decimal("999.00") },
      });

      // Existing invoice must strictly retain original snapshotted rates!
      const invoice = await BillingService.getInvoiceById(createdInvoiceId);
      assert.equal(invoice.grandTotal, "850.00");
      assert.equal(invoice.subtotal, "850.00");

      // Restore category price
      await prisma.roomCategory.update({
        where: { id: testCategoryId },
        data: { basePrice: new Prisma.Decimal("150.00") },
      });
    });

    it("should retrieve invoice by reservation ID", async () => {
      const invoice = await BillingService.getInvoiceByReservationId(testReservationId);
      assert.ok(invoice);
      assert.equal(invoice.id, createdInvoiceId);
    });
  });

  describe("2. Line Items & Extra Charges", () => {
    let invoiceId: string;
    let extraItemId: string;

    before(async () => {
      const inv = await BillingService.getInvoiceByReservationId(testReservationId);
      assert.ok(inv);
      invoiceId = inv.id;
    });

    it("should add extra charge line item and recalculate subtotal and grand total", async () => {
      const updated = await BillingService.addInvoiceItem(
        invoiceId,
        {
          description: "Minibar - Premium Beverages",
          quantity: 2,
          unitPrice: 25.5,
        },
        testStaffUserId
      );

      // Line total = 2 * 25.50 = $51.00
      // Previous grand total: $850.00 -> New grand total: $901.00
      assert.equal(updated.items.length, 3);
      assert.equal(updated.subtotal, "901.00");
      assert.equal(updated.grandTotal, "901.00");
      assert.equal(updated.balanceDue, "901.00");

      const item = updated.items.find((i) => i.description.includes("Minibar"));
      assert.ok(item);
      assert.equal(item.lineTotal, "51.00");
      extraItemId = item.id;
    });

    it("should remove extra charge line item and revert totals", async () => {
      const updated = await BillingService.removeInvoiceItem(
        invoiceId,
        extraItemId,
        testStaffUserId
      );

      assert.equal(updated.items.length, 2);
      assert.equal(updated.subtotal, "850.00");
      assert.equal(updated.grandTotal, "850.00");
      assert.equal(updated.balanceDue, "850.00");
    });
  });

  describe("3. Invoice Issuance", () => {
    it("should transition DRAFT invoice to ISSUED with issuedAt timestamp", async () => {
      const inv = await BillingService.getInvoiceByReservationId(testReservationId);
      assert.ok(inv);
      assert.equal(inv.status, InvoiceStatus.DRAFT);

      const issued = await BillingService.issueInvoice(inv.id, testStaffUserId);
      assert.equal(issued.status, InvoiceStatus.ISSUED);
      assert.ok(issued.issuedAt);
    });

    it("should reject issuing an already issued invoice", async () => {
      const inv = await BillingService.getInvoiceByReservationId(testReservationId);
      assert.ok(inv);

      await assert.rejects(
        async () => {
          await BillingService.issueInvoice(inv.id, testStaffUserId);
        },
        /already in ISSUED status/
      );
    });
  });

  describe("4. Payment Recording & Status Progression", () => {
    let invoiceId: string;
    let payment1Id: string;

    before(async () => {
      const inv = await BillingService.getInvoiceByReservationId(testReservationId);
      assert.ok(inv);
      invoiceId = inv.id;
    });

    it("should reject negative or zero payment amount", async () => {
      await assert.rejects(
        async () => {
          await BillingService.recordPayment(
            invoiceId,
            { amount: -50, paymentMethod: "CASH" },
            testStaffUserId
          );
        },
        /greater than zero/
      );

      await assert.rejects(
        async () => {
          await BillingService.recordPayment(
            invoiceId,
            { amount: 0, paymentMethod: "CASH" },
            testStaffUserId
          );
        },
        /greater than zero/
      );
    });

    it("should reject payment exceeding outstanding balance", async () => {
      // Outstanding balance is $850.00; payment of $1000.00 must be rejected!
      await assert.rejects(
        async () => {
          await BillingService.recordPayment(
            invoiceId,
            { amount: 1000.0, paymentMethod: "CARD" },
            testStaffUserId
          );
        },
        /exceeds remaining balance/
      );
    });

    it("should record partial payment and transition status to PARTIALLY_PAID", async () => {
      const result = await BillingService.recordPayment(
        invoiceId,
        {
          amount: 350.0,
          paymentMethod: "CARD",
          referenceNumber: "AUTH-89211",
        },
        testStaffUserId
      );

      assert.equal(result.invoice.status, InvoiceStatus.PARTIALLY_PAID);
      assert.equal(result.invoice.totalPaid, "350.00");
      assert.equal(result.invoice.balanceDue, "500.00"); // 850 - 350 = 500

      // Verify Receipt Details
      assert.ok(result.receipt.receiptNumber.startsWith("REC-"));
      assert.equal(result.receipt.amountPaid, "350.00");
      assert.equal(result.receipt.paymentMethod, "CARD");
      assert.equal(result.receipt.referenceNumber, "AUTH-89211");
      assert.equal(result.receipt.remainingBalance, "500.00");
      assert.equal(result.receipt.invoiceStatus, InvoiceStatus.PARTIALLY_PAID);

      payment1Id = result.receipt.paymentId;
    });

    it("should record remaining balance payment and transition status to PAID", async () => {
      const result = await BillingService.recordPayment(
        invoiceId,
        {
          amount: 500.0,
          paymentMethod: "CASH",
        },
        testStaffUserId
      );

      assert.equal(result.invoice.status, InvoiceStatus.PAID);
      assert.equal(result.invoice.totalPaid, "850.00");
      assert.equal(result.invoice.balanceDue, "0.00");
      assert.equal(result.receipt.remainingBalance, "0.00");
      assert.equal(result.receipt.invoiceStatus, InvoiceStatus.PAID);
    });

    it("should reject payment on an already fully paid invoice", async () => {
      await assert.rejects(
        async () => {
          await BillingService.recordPayment(
            invoiceId,
            { amount: 10.0, paymentMethod: "CASH" },
            testStaffUserId
          );
        },
        /already fully paid/
      );
    });

    it("should transition PAID back to PARTIALLY_PAID when a payment is voided", async () => {
      const updated = await BillingService.voidPayment(payment1Id, testStaffUserId);

      // Voided payment1 ($350.00). Remaining payment: $500.00 out of $850.00
      assert.equal(updated.status, InvoiceStatus.PARTIALLY_PAID);
      assert.equal(updated.totalPaid, "500.00");
      assert.equal(updated.balanceDue, "350.00");

      const voidedPayment = updated.payments.find((p) => p.id === payment1Id);
      assert.ok(voidedPayment);
      assert.equal(voidedPayment.status, PaymentStatus.VOIDED);
    });

    it("should reject voiding an already voided payment", async () => {
      await assert.rejects(
        async () => {
          await BillingService.voidPayment(payment1Id, testStaffUserId);
        },
        /already voided/
      );
    });
  });

  describe("5. Invoices Query & Reporting Summary", () => {
    it("should list invoices with pagination and accurate aggregate metrics", async () => {
      const list = await BillingService.getInvoices({ page: 1, limit: 10 });

      assert.ok(list.invoices.length >= 1);
      assert.ok(parseFloat(list.summary.totalInvoiced) >= 850);
      assert.ok(parseFloat(list.summary.totalCollected) >= 500);
      assert.ok(parseFloat(list.summary.totalOutstanding) >= 350);
    });

    it("should filter invoices by status", async () => {
      const partialList = await BillingService.getInvoices({
        status: InvoiceStatus.PARTIALLY_PAID,
      });
      assert.ok(partialList.invoices.every((i) => i.status === InvoiceStatus.PARTIALLY_PAID));
    });

    it("should search invoices by customer name or invoice number", async () => {
      const searchRes = await BillingService.getInvoices({ search: "Corleone" });
      assert.ok(searchRes.invoices.some((i) => i.customerName.includes("Corleone")));
    });
  });

  describe("6. Concurrency & Overpayment Prevention", () => {
    let raceInvoiceId: string;

    before(async () => {
      // Create invoice for second reservation: 2 nights @ $150.00 = $300.00 grand total
      const inv = await BillingService.createInvoiceForReservation(
        {
          reservationId: secondReservationId,
          autoIssue: true,
        },
        testStaffUserId
      );
      raceInvoiceId = inv.id;
    });

    it("should prevent concurrent double-full-payment on the same invoice via row-level locks", async () => {
      // Remaining balance is $300.00.
      // Two concurrent payment attempts of $300.00 each are launched simultaneously!
      // Exactly ONE must succeed and the other must be rejected (exceeding remaining balance)!
      const p1 = BillingService.recordPayment(
        raceInvoiceId,
        { amount: 300.0, paymentMethod: "CARD", referenceNumber: "RACE-1" },
        testStaffUserId
      );
      const p2 = BillingService.recordPayment(
        raceInvoiceId,
        { amount: 300.0, paymentMethod: "CARD", referenceNumber: "RACE-2" },
        testStaffUserId
      );

      const results = await Promise.allSettled([p1, p2]);
      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      assert.equal(succeeded.length, 1, "Exactly one concurrent full payment must succeed");
      assert.equal(failed.length, 1, "Exactly one concurrent payment must fail");

      const failReason = (failed[0] as PromiseRejectedResult).reason;
      assert.ok(
        failReason?.message?.includes("exceeds remaining balance") ||
          failReason?.message?.includes("already fully paid"),
        `Expected balance error but got: ${failReason}`
      );

      // Verify the invoice ended in PAID with exactly $300.00 total paid
      const finalInvoice = await BillingService.getInvoiceById(raceInvoiceId);
      assert.equal(finalInvoice.status, InvoiceStatus.PAID);
      assert.equal(finalInvoice.totalPaid, "300.00");
      assert.equal(finalInvoice.balanceDue, "0.00");
    });
  });

  describe("7. Role Authorization & Access Control", () => {
    it("should permit RECEPTIONIST role for billing operations", () => {
      const permitted = enforceRole(receptionistSession, [
        RoleName.ADMIN,
        RoleName.RECEPTIONIST,
      ]);
      assert.equal(permitted.role, RoleName.RECEPTIONIST);
    });

    it("should permit ADMIN role for billing operations", () => {
      const permitted = enforceRole(adminSession, [
        RoleName.ADMIN,
        RoleName.RECEPTIONIST,
      ]);
      assert.equal(permitted.role, RoleName.ADMIN);
    });

    it("should throw AuthError(401) for unauthenticated requests", () => {
      assert.throws(
        () => {
          enforceRole(null, [RoleName.ADMIN, RoleName.RECEPTIONIST]);
        },
        /Authentication required/
      );
    });
  });

  describe("8. Batch 1 Regression: Reservation Auto-Invoicing & Checkout Billing Integration", () => {
    let autoReservationId: string;
    let autoInvoiceId: string;

    it("should atomically provision an itemized draft invoice upon reservation creation when autoCreateInvoice is true", async () => {
      // Create new reservation with autoCreateInvoice = true (3 nights in Room 301 @ $150 = $450)
      const todayIso = getHotelTodayDate();
      const pastArrival = new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10);
      const res = await ReservationService.createReservation(
        {
          customerId: testCustomerId,
          allocations: [
            {
              roomId: room301Id,
              arrivalDate: pastArrival,
              departureDate: todayIso, // 3 nights @ $150
            },
          ],
          autoCreateInvoice: true,
        },
        testStaffUserId
      );

      assert.ok(res.id);
      autoReservationId = res.id;

      // Verify invoice was automatically provisioned in DB
      const invoice = await BillingService.getInvoiceByReservationId(res.id);
      assert.ok(invoice, "Invoice must be automatically provisioned");
      assert.equal(invoice.reservationId, res.id);
      assert.equal(invoice.status, InvoiceStatus.DRAFT);
      assert.equal(invoice.subtotal, "450.00");
      assert.equal(invoice.grandTotal, "450.00");
      assert.equal(invoice.balanceDue, "450.00");
      assert.equal(invoice.totalPaid, "0.00");
      assert.equal(invoice.items.length, 1);
      assert.equal(invoice.items[0].quantity, "3.00");
      assert.equal(invoice.items[0].unitPrice, "150.00");
      assert.equal(invoice.items[0].lineTotal, "450.00");

      autoInvoiceId = invoice.id;
    });

    it("should reconcile manual invoice creation idempotently by returning existing active invoice", async () => {
      // Re-invoking createInvoiceForReservation directly still throws conflict
      await assert.rejects(
        async () => {
          await BillingService.createInvoiceForReservation(
            { reservationId: autoReservationId },
            testStaffUserId
          );
        },
        /already exists for this reservation/
      );

      // But getInvoiceByReservationId reliably fetches the single source of truth
      const existing = await BillingService.getInvoiceByReservationId(autoReservationId);
      assert.ok(existing);
      assert.equal(existing.id, autoInvoiceId);
    });

    it("should preserve invoice and outstanding balance even after partial payment and allocation checkout", async () => {
      // Record partial payment of $200.00
      const { invoice: invoiceAfterPay, receipt } = await BillingService.recordPayment(
        autoInvoiceId,
        {
          amount: 200,
          paymentMethod: "UPI",
          referenceNumber: "UPI-BATCH1-9999",
        },
        testStaffUserId
      );

      assert.ok(receipt.receiptNumber);
      assert.equal(receipt.amountPaid, "200.00");
      assert.equal(invoiceAfterPay.status, InvoiceStatus.PARTIALLY_PAID);
      assert.equal(invoiceAfterPay.totalPaid, "200.00");
      assert.equal(invoiceAfterPay.balanceDue, "250.00");

      // Verify checkout completes cleanly and leaves invoice and unpaid balance intact
      const freshRes = await prisma.reservation.findUnique({
        where: { id: autoReservationId },
        include: { rooms: true },
      });
      assert.ok(freshRes && freshRes.rooms.length > 0);
      const allocId = freshRes.rooms[0].id;

      // Check-in first
      await prisma.reservationRoom.update({
        where: { id: allocId },
        data: {
          status: AllocationStatus.CHECKED_IN,
          checkedInAt: new Date(Date.now() - 86400000 * 3),
        },
      });
      await prisma.room.update({
        where: { id: room301Id },
        data: { status: RoomStatus.OCCUPIED },
      });

      // Execute Checkout
      const checkoutResult = await CheckInOutService.checkOut(
        { allocationId: allocId, notes: "Guest departed with pending balance" },
        testStaffUserId
      );

      assert.equal(checkoutResult.allocationStatus, AllocationStatus.CHECKED_OUT);
      assert.equal(checkoutResult.roomStatus, RoomStatus.VACANT_DIRTY);
      assert.equal(checkoutResult.reservationStatus, ReservationStatus.COMPLETED);

      // Verify the invoice and its unpaid balance remain completely visible on billing
      const finalInvoice = await BillingService.getInvoiceById(autoInvoiceId);
      assert.ok(finalInvoice);
      assert.equal(finalInvoice.status, InvoiceStatus.PARTIALLY_PAID);
      assert.equal(finalInvoice.balanceDue, "250.00");
      assert.equal(finalInvoice.totalPaid, "200.00");
    });
  });
});
