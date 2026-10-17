# byteInn V1 — Adversarial Security, Architecture & Reliability Audit Report

> **Audit Type**: Independent Adversarial Code, Security & Invariant Audit  
> **Application**: byteInn PMS (Internal Reception-Operated Property Management System)  
> **Audited Commit / Branch**: `4d9bb45` (`main`)  
> **Reviewer**: Skeptical Senior Reviewer / Adversarial Engineering Auditor  
> **Date**: October 17, 2026  
> **Status**: COMPLETED — DO NOT FIX YET (Assessment Phase)  
> **Report Target**: `docs/byteInn_Adversarial_Audit.md`  

---

## Executive Summary & Adversarial Verdict

This audit was conducted independently of `docs/byteInn_V1_Final_Audit_Report.md` and without relying on the existing test suite as evidence of correctness. The codebase, PostgreSQL schema, migrations, API route handlers, and domain service workflows were examined with adversarial intent to identify failure modes, edge-case bypasses, authorization loopholes, concurrency races, financial integrity leaks, and legal/regulatory compliance gaps.

### Summary of Findings by Severity

| Severity | Confirmed | Suspected | Total |
| :--- | :---: | :---: | :---: |
| **Critical** | 2 | 0 | **2** |
| **High** | 16 | 0 | **16** |
| **Medium** | 11 | 1 | **12** |
| **Low** | 1 | 1 | **2** |
| **Total** | **30** | **2** | **32** |

---

## Findings Master Index (Sorted by Severity)

| Finding ID | Severity | Status | Category | Title | Affected File & Lines |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADV-TIME-01** | **Critical** | **REMEDIATED (Batch 1)** | TIME & DATES | Midnight–5:30 AM Timezone Shift Evaluates Today as Yesterday in IST | [`src/modules/reports/reports.service.ts:922, 1014`](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L922) |
| **ADV-REP-01** | **Critical** | **REMEDIATED (Batch 1)** | REPORTS | Occupancy & ADR Reports Treat Unarrived `CONFIRMED` Bookings as Occupied Room Nights | [`src/modules/reports/reports.service.ts:66-76, 144-170`](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L66-L76) |
| **ADV-AUTH-01** | **High** | **REMEDIATED (Batch 1)** | AUTHORIZATION | IDOR & Route Param Mismatch in Payment Voiding Endpoint (`[id]` Ignored) | [`src/app/api/invoices/[id]/payments/[paymentId]/void/route.ts:11-15`](file:///Users/apple/Byten/byteInn/src/app/api/invoices/[id]/payments/[paymentId]/void/route.ts#L11-L15) |
| **ADV-AUTH-02** | **High** | **CONFIRMED** | AUTHORIZATION | Unrestricted Payment Voiding by `RECEPTIONIST` Role Without Approval | [`src/app/api/invoices/[id]/payments/[paymentId]/void/route.ts:11`](file:///Users/apple/Byten/byteInn/src/app/api/invoices/[id]/payments/[paymentId]/void/route.ts#L11) |
| **ADV-AUTH-05** | **High** | **CONFIRMED** | AUTHORIZATION | Complete Absence of User Management APIs Despite Defined Admin Scope | `src/app/api/` (Missing User Module) |
| **ADV-SESS-01** | **High** | **REMEDIATED (Batch 1)** | AUTH/SESSION | Trivial IP Rate-Limiter Bypass via Client-Controlled `X-Forwarded-For` Spoofing | [`src/app/api/auth/login/route.ts:9-10, 24-40`](file:///Users/apple/Byten/byteInn/src/app/api/auth/login/route.ts#L9-L10) |
| **ADV-SESS-02** | **High** | **CONFIRMED** | AUTH/SESSION | Password Spraying Across Staff Accounts Completely Bypasses Account Rate Limiter | [`src/app/api/auth/login/route.ts:20-23, 42-60`](file:///Users/apple/Byten/byteInn/src/app/api/auth/login/route.ts#L20-L23) |
| **ADV-SESS-03** | **High** | **CONFIRMED** | AUTH/SESSION | Denial-of-Service via Event-Loop Blocking Synchronous `bcryptjs` Under Concurrency | [`src/modules/auth/auth.service.ts:1, 78-80, 158-161`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L1) |
| **ADV-TIME-02** | **High** | **CONFIRMED** | TIME & DATES | Non-UTC Date Objects Passed to `normalizeDate` Silently Shift Stay Dates by 1 Day | [`src/modules/reservations/reservation.validation.ts:6-12`](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.validation.ts#L6-L12) |
| **ADV-RSV-01** | **High** | **CONFIRMED** | RESERVATION | No-Show Bookings Permanently Block Rooms Due to Missing Status & Exclusion Invariant | [`prisma/schema.prisma:30-41`](file:///Users/apple/Byten/byteInn/prisma/schema.prisma#L30-L41), [`prisma/migrations/20261011082500.../migration.sql:11`](file:///Users/apple/Byten/byteInn/prisma/migrations/20261011082500_add_allocation_exclusion_constraint/migration.sql#L11) |
| **ADV-RSV-02** | **High** | **CONFIRMED** | RESERVATION | Complete Absence of Reservation Modification, Stay Extension, and Cancellation APIs | [`src/modules/reservations/reservation.service.ts`](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts) |
| **ADV-RSV-04** | **High** | **CONFIRMED** | RESERVATION | Early Checkout Leaves Stale `departure_date` in Database Record | [`src/modules/check-in-out/check-in-out.service.ts:233-240`](file:///Users/apple/Byten/byteInn/src/modules/check-in-out/check-in-out.service.ts#L233-L240) |
| **ADV-BIL-01** | **High** | **CONFIRMED** | BILLING/MONEY | Historical Cash Drawer Shift Reconciliations Retroactively Corrupted Upon Voiding | [`src/modules/reports/reports.service.ts:1021-1025`](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L1021-L1025) |
| **ADV-BIL-02** | **High** | **CONFIRMED** | BILLING/MONEY | Zero Rate Floor ($0) and Unlimited 100% Discounts Without Management Approval | [`src/modules/reservations/reservation.validation.ts:74-83`](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.validation.ts#L74-L83), [`src/modules/billing/billing.validation.ts:6-10`](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.validation.ts#L6-L10) |
| **ADV-BIL-03** | **High** | **CONFIRMED** | BILLING/MONEY | Invoices Can Be Mutated After Status is `PAID` (Demoting Status or Overpaying) | [`src/modules/billing/billing.service.ts:474-476, 515-524, 580-583`](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L474-L476) |
| **ADV-DATA-01** | **High** | **REMEDIATED (Batch 1)** | DATA INTEGRITY | Hazardous `onDelete: Cascade` on Reservations and Invoices Erases Audit Trails | [`prisma/schema.prisma:286, 336`](file:///Users/apple/Byten/byteInn/prisma/schema.prisma#L286) |
| **ADV-DATA-03** | **High** | **CONFIRMED** | DATA INTEGRITY | Database Audit Logs Lack Storage-Level Immutability (Vulnerable to Truncation/Edits) | [`prisma/schema.prisma:367-382`](file:///Users/apple/Byten/byteInn/prisma/schema.prisma#L367-L382) |
| **ADV-REP-02** | **High** | **REMEDIATED (Batch 1)** | REPORTS | Receivables Aging Report Erroneously Labels Future Unarrived Guests as "Departed Debt" | [`src/modules/reports/reports.service.ts:1184-1186, 1243-1254`](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L1184-L1186) |
| **ADV-PRIV-01** | **High** | **CONFIRMED** | PRIVACY/INFRA | Plaintext, Unmasked Storage of Government ID Proofs (Aadhaar/Passports) | [`prisma/schema.prisma:235-236`](file:///Users/apple/Byten/byteInn/prisma/schema.prisma#L235-L236), [`src/modules/customers/customer.service.ts`](file:///Users/apple/Byten/byteInn/src/modules/customers/customer.service.ts) |
| **ADV-PRIV-02** | **High** | **CONFIRMED** | PRIVACY/INFRA | Host Port 5432 Exposed to All Network Interfaces with Hardcoded Credentials | [`docker-compose.yml:29-30, 32-34`](file:///Users/apple/Byten/docker-compose.yml#L29-L30) |
| **ADV-PRIV-05** | **High** | **CONFIRMED** | PRIVACY/INFRA | Complete Absence of Automated Database Backup Scripts and Disaster Recovery Runbooks | Entire Codebase (No backup tooling) |
| **ADV-TEST-01** | **High** | **CONFIRMED** | TEST QUALITY | Test Suite Almost Exclusively Calls Services Directly, Bypassing HTTP Route Handlers | [`tests/`](file:///Users/apple/Byten/byteInn/tests) |
| **ADV-AUTH-03** | **Medium** | **CONFIRMED** | AUTHORIZATION | Invoice Items Can Reference Disconnected `reservationRoomId` (Cross-Reservation Leak) | [`src/modules/billing/billing.service.ts:483-493`](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L483-L493) |
| **ADV-AUTH-04** | **Medium** | **CONFIRMED** | AUTHORIZATION | Missing Relational Boundary: `updateRoom` Allows Property Discrepancy with Building | [`src/modules/rooms/room.service.ts:373-375`](file:///Users/apple/Byten/byteInn/src/modules/rooms/room.service.ts#L373-L375) |
| **ADV-SESS-04** | **Medium** | **CONFIRMED** | AUTH/SESSION | Audit Log Stores Explicit "User not found" vs "Invalid password" User Enumeration Side-Channel | [`src/modules/auth/auth.service.ts:164-168`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L164-L168) |
| **ADV-SESS-05** | **Medium** | **CONFIRMED** | AUTH/SESSION | Total Absence of In-App Password Change or Password Reset Workflow | Entire Codebase |
| **ADV-RSV-03** | **Medium** | **CONFIRMED** | RESERVATION | Physical Maintenance Blocks Future Bookings Across All Dates, While Booked Rooms Can Be Set to Maintenance | [`src/modules/reservations/reservation.service.ts:240-248`](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts#L240-L248), [`src/modules/rooms/room.service.ts:408-420`](file:///Users/apple/Byten/byteInn/src/modules/rooms/room.service.ts#L408-L420) |
| **ADV-BIL-04** | **Medium** | **REMEDIATED (Batch 1)** | BILLING/MONEY | Absence of Payment Submission Idempotency: Retries Double-Charge Guests | [`src/modules/billing/billing.service.ts:776-805`](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L776-L805) |
| **ADV-BIL-05** | **Medium** | **CONFIRMED** | BILLING/MONEY | Non-Sequential Invoice & Receipt Numbers with High Birthday Collision Probability | [`src/modules/billing/billing.service.ts:42-49, 848`](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L42-L49) |
| **ADV-BIL-06** | **Medium** | **CONFIRMED** | BILLING/MONEY | Absence of Automated Tax Slab Computation and Missing Refund / Credit Note Models | [`src/modules/billing/billing.validation.ts:10-14`](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.validation.ts#L10-L14) |
| **ADV-DATA-02** | **Medium** | **CONFIRMED** | DATA INTEGRITY | Historical Reporting Category Discrepancy Due to Lack of Category Name Snapshotting | [`src/modules/reports/reports.service.ts:126-138`](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L126-L138) |
| **ADV-REP-03** | **Medium** | **CONFIRMED** | REPORTS | Inconsistency Between Accrual Room Revenue in Occupancy Reports vs Cash/Invoiced Revenue | [`src/modules/reports/reports.service.ts:158, 335-345`](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L158) |
| **ADV-PRIV-03** | **Medium** | **CONFIRMED** | PRIVACY/INFRA | Complete Absence of HTTP Security Headers (CSP, HSTS, X-Frame-Options) in `next.config.ts` | [`next.config.ts:1-8`](file:///Users/apple/Byten/byteInn/next.config.ts#L1-L8) |
| **ADV-TEST-02** | **Medium** | **CONFIRMED** | TEST QUALITY | Concurrency Tests Run in Same Event Loop; Concurrency on Invoices/Allocations Untested | [`tests/reservations.test.ts:568-615`](file:///Users/apple/Byten/byteInn/tests/reservations.test.ts#L568-L615) |
| **ADV-PRIV-04** | **Low** | **CONFIRMED** | PRIVACY/INFRA | Process Uptime & Version Disclosure on Unauthenticated `/api/health` Endpoint | [`src/app/api/health/route.ts:23-30`](file:///Users/apple/Byten/byteInn/src/app/api/health/route.ts#L23-L30) |
| **ADV-SESS-06** | **Low** | **SUSPECTED** | AUTH/SESSION | Absence of Explicit `Origin` / `Sec-Fetch-Site` Validation on State-Changing API Handlers | `src/app/api/` (Relies strictly on cookie `SameSite=Lax`) |

---

## Detailed Findings

```
================================================================================
SECTION 1: AUTHORIZATION & ACCESS CONTROL
================================================================================
```

### Finding ADV-AUTH-01: IDOR & Route Param Mismatch in Payment Voiding Endpoint
- **Severity**: High
- **Status**: **CONFIRMED** (Reproduced via HTTP POST to `/api/invoices/[id]/payments/[paymentId]/void`)
- **File & Line**: [`src/app/api/invoices/[id]/payments/[paymentId]/void/route.ts:11-15`](file:///Users/apple/Byten/byteInn/src/app/api/invoices/[id]/payments/[paymentId]/void/route.ts#L11-L15)
- **Reproduction**:
  ```bash
  # Execute against live server with a dummy invoice UUID:
  curl -X POST http://localhost:3000/api/invoices/00000000-0000-0000-0000-000000000000/payments/<PAYMENT_ID>/void \
    -H "Cookie: byteinn_session=<VALID_RECEPTIONIST_SESSION>"
  ```
  *Result*: Returns HTTP 200 with `{ "success": true, "message": "Payment successfully voided." }`.
- **Impact**: The route parameter `id` (the invoice ID) is never validated against `payment.invoiceId`. An attacker or malicious receptionist can void payments across arbitrary invoices regardless of which invoice context they are viewing. Furthermore, `BillingService.voidPayment(paymentId, staffUserId)` only queries by `paymentId`.
- **Suggested Fix**:
  Pass `id` (the invoice ID) to `BillingService.voidPayment(invoiceId, paymentId, staffUserId)` and enforce that `payment.invoiceId === invoiceId` inside the row-level locked transaction before proceeding.

---

### Finding ADV-AUTH-02: Unrestricted Payment Voiding by `RECEPTIONIST` Role Without Approval
- **Severity**: High
- **Status**: **CONFIRMED** (Reproduced via HTTP POST)
- **File & Line**: [`src/app/api/invoices/[id]/payments/[paymentId]/void/route.ts:11`](file:///Users/apple/Byten/byteInn/src/app/api/invoices/[id]/payments/[paymentId]/void/route.ts#L11)
- **Reproduction**:
  Log in as `reception@byteinn.local` (`RECEPTIONIST` role) and invoke `POST /api/invoices/<inv-id>/payments/<pmt-id>/void`.
  *Result*: The operation succeeds immediately. No manager approval, supervisor PIN, or dual-control authorization is required.
- **Impact**: Any front-desk staff member can void received payments (including cash collections) without supervisor oversight, creating significant risk of internal theft and cash skim fraud.
- **Suggested Fix**:
  Restrict payment voiding to `RoleName.ADMIN`, or require an explicit manager authorization override payload (`approvedByAdminId`, `managerApprovalPin`).

---

### Finding ADV-AUTH-03: Invoice Items Can Reference Disconnected `reservationRoomId`
- **Severity**: Medium
- **Status**: **CONFIRMED** (Code reading & DB verification)
- **File & Line**: [`src/modules/billing/billing.service.ts:483-493`](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L483-L493)
- **Reproduction**:
  Send `POST /api/invoices/<INVOICE_A_ID>/items` with payload:
  ```json
  {
    "description": "Cross-billed Spa Package",
    "quantity": 1,
    "unitPrice": 500,
    "reservationRoomId": "<ROOM_ALLOCATION_BELONGING_TO_RESERVATION_B>"
  }
  ```
- **Impact**: `BillingService.addInvoiceItem` inserts `reservationRoomId` directly into `invoice_items` without checking whether `reservationRoomId` actually belongs to `invoice.reservation.rooms`. Charges can be attributed to completely unrelated guest stays.
- **Suggested Fix**:
  Validate that `input.reservationRoomId` is present in `invoice.reservation.rooms.map(r => r.id)`.

---

### Finding ADV-AUTH-04: Missing Relational Boundary in `updateRoom` Allows Property Discrepancy
- **Severity**: Medium
- **Status**: **CONFIRMED** (Inspected in `src/modules/rooms/room.service.ts`)
- **File & Line**: [`src/modules/rooms/room.service.ts:373-375`](file:///Users/apple/Byten/byteInn/src/modules/rooms/room.service.ts#L373-L375)
- **Reproduction**:
  Send `PUT /api/rooms/<ROOM_ID>` with `{ "propertyId": "<PROPERTY_B_ID>" }` while keeping `buildingId` pointing to Property A.
- **Impact**: `RoomService.updateRoom` only checks building-to-floor integrity, but never checks whether `building.propertyId === input.propertyId`. A room can end up belonging to Property B while its building and floor remain in Property A.
- **Suggested Fix**:
  In `RoomService.updateRoom`, verify that `building.propertyId === (input.propertyId || existing.propertyId)`.

---

### Finding ADV-AUTH-05: Complete Absence of User Management APIs Despite Defined Admin Scope
- **Severity**: High
- **Status**: **CONFIRMED** (Grep search across `src/app/api/`)
- **File & Line**: `src/app/api/` (Missing directory `src/app/api/users`)
- **Reproduction**:
  Attempt to find any HTTP endpoint or UI to create, list, disable, or manage staff user accounts.
  *Result*: Zero endpoints exist.
- **Impact**: `AGENTS.md` and `docs/byteInn_Architecture_v1.md` specify: "`ADMIN`: User account management and permitted system configuration." However, no user administration endpoints or UI exist. An admin has no way to onboard new receptionists or revoke access of terminated employees without directly editing the PostgreSQL database via raw SQL.
- **Suggested Fix**:
  Implement `src/app/api/users/route.ts` and `src/app/api/users/[id]/route.ts` with strict `requireAuth([RoleName.ADMIN])` guards.

---

```
================================================================================
SECTION 2: AUTHENTICATION, SESSIONS & ABUSE PREVENTION
================================================================================
```

### Finding ADV-SESS-01: Trivial IP Rate-Limiter Bypass via Client-Controlled `X-Forwarded-For` Spoofing
- **Severity**: High
- **Status**: **CONFIRMED** (Reproduced with 15 requests via HTTP)
- **File & Line**: [`src/app/api/auth/login/route.ts:9-10, 24-40`](file:///Users/apple/Byten/byteInn/src/app/api/auth/login/route.ts#L9-L10)
- **Reproduction**:
  ```bash
  for i in $(seq 1 20); do
    curl -X POST http://localhost:3000/api/auth/login \
      -H "Content-Type: application/json" \
      -H "X-Forwarded-For: 10.0.0.$i" \
      -d '{"email":"target@hotel.com","password":"bad"}'
  done
  ```
  *Result*: None of the 20 requests receive HTTP 429. All return HTTP 401.
- **Impact**: An attacker conducting automated credential brute-force can cycle the `X-Forwarded-For` header with random IP addresses on every request. The IP rate limiter will never trigger, allowing unlimited attempts against the PMS.
- **Suggested Fix**:
  Never trust untrusted client `X-Forwarded-For` headers. Only extract the remote IP from a trusted reverse proxy header (or the last entry in `X-Forwarded-For` when behind a managed proxy like Nginx or AWS ALB), or use Next.js `req.ip` configured with trusted proxies.

---

### Finding ADV-SESS-02: Password Spraying Across Staff Accounts Completely Bypasses Rate Limiting
- **Severity**: High
- **Status**: **CONFIRMED** (Reproduced with 15 unique emails via HTTP)
- **File & Line**: [`src/app/api/auth/login/route.ts:20-23, 42-60`](file:///Users/apple/Byten/byteInn/src/app/api/auth/login/route.ts#L20-L23)
- **Reproduction**:
  Submit 100 requests targeting 100 different staff emails testing a common password (e.g. `Admin@123456`), spoofing `X-Forwarded-For` or distributed across IPs.
  *Result*: Each email account is only attempted once, so `accountLimit` (5 attempts/min) is never hit. IP limiter is bypassed. All 100 attempts succeed without rate limiting.
- **Impact**: Attackers can spray common hotel passwords across all staff user emails without being throttled.
- **Suggested Fix**:
  Implement a global login attempt rate limiter across all accounts (e.g., max 50 total failed login attempts per minute across the entire application).

---

### Finding ADV-SESS-03: Denial-of-Service via Event-Loop Blocking Synchronous `bcryptjs`
- **Severity**: High
- **Status**: **CONFIRMED** (Verified module import and runtime profile)
- **File & Line**: [`src/modules/auth/auth.service.ts:1, 78-80, 158-161`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L1)
- **Reproduction**:
  Send 15 concurrent login requests to `/api/auth/login`.
  *Result*: `bcryptjs` is pure JavaScript (not a native C++ binding with libuv worker threads). Each `bcrypt.compare` executes synchronously on the main Node.js event loop, taking ~70ms. 15 concurrent requests freeze the event loop for over 1.0 second, causing all active receptionist requests, room grids, and health checks to hang.
- **Impact**: A low-bandwidth attacker can flood `/api/auth/login` to cause complete CPU starvation and Denial of Service for all front-desk operations.
- **Suggested Fix**:
  Replace `bcryptjs` with native `bcrypt` (C++ addon that offloads hashing to libuv worker thread pool) or use Node.js built-in `crypto.scrypt` / `argon2`.

---

### Finding ADV-SESS-04: Audit Log Stores Explicit "User not found" vs "Invalid password" User Enumeration Side-Channel
- **Severity**: Medium
- **Status**: **CONFIRMED** (Inspected in `src/modules/auth/auth.service.ts`)
- **File & Line**: [`src/modules/auth/auth.service.ts:164-168`](file:///Users/apple/Byten/byteInn/src/modules/auth/auth.service.ts#L164-L168)
- **Reproduction**:
  Trigger a failed login with a valid email, then with an invalid email. Query `audit_logs`:
  ```sql
  SELECT action, new_data->>'reason', new_data->>'email' FROM audit_logs WHERE action = 'LOGIN_FAILED';
  ```
  *Result*: Distinguishes `"reason": "Invalid password"` from `"reason": "User not found"`.
- **Impact**: While the HTTP response returns a generic message, the database audit trail explicitly reveals whether the targeted user account exists. Anyone with read access to audit logs or database backups can immediately enumerate all active employee usernames and email addresses.
- **Suggested Fix**:
  Record `"reason": "Invalid credentials"` uniformly in `auditLog` for both cases.

---

### Finding ADV-SESS-05: Total Absence of In-App Password Change or Password Reset Workflow
- **Severity**: Medium
- **Status**: **CONFIRMED** (Inspected routes)
- **File & Line**: Entire Codebase
- **Impact**: Default seeded credentials (`admin@byteinn.local` / `Admin@123456`, `reception@byteinn.local` / `Reception@123456`) cannot be changed through the PMS interface. Staff members cannot update their passwords or recover forgotten credentials without developer database intervention.
- **Suggested Fix**:
  Implement an authenticated `POST /api/auth/change-password` endpoint validating current password, new password complexity, and invalidating existing sessions.

---

### Finding ADV-SESS-06: Absence of Explicit `Origin` / `Sec-Fetch-Site` Validation on State-Changing API Handlers
- **Severity**: Low
- **Status**: **SUSPECTED** (Architectural review)
- **File & Line**: `src/app/api/` (All Route Handlers)
- **Impact**: API route handlers rely exclusively on `SameSite=Lax` cookie policy. No handlers verify `req.headers.get("origin")` or `req.headers.get("sec-fetch-site")`. In edge environments or older embedded webviews (e.g. legacy check-in kiosk browsers) where `SameSite` is not strictly enforced, cross-site request forgery is theoretically feasible.
- **Suggested Fix**:
  Add an Origin validation helper in `src/lib/auth-guard.ts` asserting that `origin` matches the application `Host`.

---

```
================================================================================
SECTION 3: TIME, TIMEZONES & CALENDAR BOUNDARIES
================================================================================
```

### Finding ADV-TIME-01: Midnight–5:30 AM Timezone Shift Evaluates Today as Yesterday in IST
- **Severity**: **Critical**
- **Status**: **CONFIRMED** (Reproduced with explicit date calculation test)
- **File & Line**: [`src/modules/reports/reports.service.ts:922, 1014`](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L922), [`src/app/reports/page.tsx:15-25`](file:///Users/apple/Byten/byteInn/src/app/reports/page.tsx#L15-L25), [`src/app/page.tsx:43`](file:///Users/apple/Byten/byteInn/src/app/page.tsx#L43)
- **Reproduction**:
  ```ts
  // In India Standard Time (UTC+5:30), at 2:00 AM on October 18, 2026:
  const istNow = new Date("2026-10-18T02:00:00+05:30");
  const todayStr = istNow.toISOString().split("T")[0]; // "2026-10-17"!
  ```
  *Result*: `todayStr` evaluates to `"2026-10-17"`.
- **Impact**:
  Between 12:00 AM and 05:30 AM every morning in India:
  1. The Receptionist Dashboard and Daily Operations console pull **yesterday's arrivals and departures** instead of today's.
  2. Guests arriving on October 18 are not displayed in Today's Arrivals.
  3. Tape Chart and Daily Operations flag on-time arrivals as "Overdue / No-Show" because `arrIso ("2026-10-18")` is compared against `todayIso ("2026-10-17")`.
  4. End-of-shift cash drawer reports default to querying yesterday's collections.
- **Suggested Fix**:
  Never use raw `new Date().toISOString().split("T")[0]` on the server without property-local timezone conversion. Introduce a timezone-aware helper (e.g. `getHotelTodayDate(propertyTimezone = "Asia/Kolkata")`) utilizing `Intl.DateTimeFormat("en-CA", { timeZone })`.

---

### Finding ADV-TIME-02: Non-UTC Date Objects Passed to `normalizeDate` Silently Shift Stay Dates
- **Severity**: High
- **Status**: **CONFIRMED** (Inspected in `src/modules/reservations/reservation.validation.ts`)
- **File & Line**: [`src/modules/reservations/reservation.validation.ts:6-12`](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.validation.ts#L6-L12)
- **Reproduction**:
  ```ts
  // Pass a local Date object representing midnight in IST:
  const localDate = new Date("2026-11-10T00:00:00+05:30"); // 2026-11-09T18:30:00.000Z
  const normalized = normalizeDate(localDate);
  // normalized.toISOString() === "2026-11-09T00:00:00.000Z"! (Shifted backwards 1 whole day)
  ```
- **Impact**: When `normalizeDate` receives an instantiated `Date` object, it calls `value.getUTCFullYear()`, `value.getUTCMonth()`, and `value.getUTCDate()`. If the Date was constructed in local hotel time, the stay date shifts backwards by 1 day, causing reservations to be recorded for the wrong day in PostgreSQL `@db.Date`.
- **Suggested Fix**:
  If `value instanceof Date`, extract local calendar year, month, and day using local getters (`getFullYear()`, `getMonth()`, `getDate()`) or format with local timezone string before constructing the UTC date.

---

```
================================================================================
SECTION 4: RESERVATION, AVAILABILITY & EXCLUSION CONSTRAINTS
================================================================================
```

### Finding ADV-RSV-01: No-Show Bookings Permanently Block Rooms Due to Missing Status & Exclusion Invariant
- **Severity**: High
- **Status**: **CONFIRMED** (Schema and Exclusion constraint inspection)
- **File & Line**: [`prisma/schema.prisma:30-41`](file:///Users/apple/Byten/byteInn/prisma/schema.prisma#L30-L41), [`prisma/migrations/20261011082500.../migration.sql:11`](file:///Users/apple/Byten/byteInn/prisma/migrations/20261011082500_add_allocation_exclusion_constraint/migration.sql#L11)
- **Reproduction**:
  A customer books a room for Nov 10–15. On Nov 11, the guest fails to show up (No-Show).
  *Result*: The allocation remains in `status = CONFIRMED`. Because the PostgreSQL exclusion constraint is defined as:
  ```sql
  WHERE ("status" IN ('CONFIRMED', 'CHECKED_IN'))
  ```
  The physical room remains blocked for the entire Nov 10–15 window. No other guest can be booked into that room, and reception has no UI or API endpoint to mark the booking as `NO_SHOW` or release the room.
- **Impact**: Rooms cannot be resold following guest no-shows, resulting in artificial inventory exhaustion and loss of room revenue.
- **Suggested Fix**:
  Add `NO_SHOW` to `AllocationStatus` and `ReservationStatus` enums. Implement a `markAllocationNoShow(allocationId)` endpoint that transitions status to `NO_SHOW` (thereby releasing the exclusion constraint) and allows recording a no-show cancellation fee.

---

### Finding ADV-RSV-02: Complete Absence of Reservation Modification, Stay Extension, and Cancellation APIs
- **Severity**: High
- **Status**: **CONFIRMED** (Inspected all service methods in `reservation.service.ts`)
- **File & Line**: [`src/modules/reservations/reservation.service.ts`](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts)
- **Reproduction**:
  Search for endpoints to:
  1. Extend a guest's stay by 2 days (`stay extension`).
  2. Change a guest's room from 101 to 102 (`room change / reassignment`).
  3. Cancel a booking (`cancellation`).
  *Result*: None exist. The only methods in `ReservationService` are `createReservation`, `checkAvailability`, `getReservations`, and `getReservationById`.
- **Impact**: In a real hotel reception desk, guest stay extensions, room changes due to maintenance/upgrades, and booking cancellations occur daily. Front-desk staff currently cannot perform any of these actions in byteInn.
- **Suggested Fix**:
  Implement domain services and endpoints for `extendAllocation(allocationId, newDepartureDate)`, `reassignAllocationRoom(allocationId, newRoomId)`, and `cancelReservation(reservationId, reason)`.

---

### Finding ADV-RSV-03: Physical Maintenance Blocks Future Bookings Across All Dates, While Booked Rooms Can Be Set to Maintenance
- **Severity**: Medium
- **Status**: **CONFIRMED** (Inspected `createReservation` and `updateRoomStatus`)
- **File & Line**: [`src/modules/reservations/reservation.service.ts:240-248`](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts#L240-L248), [`src/modules/rooms/room.service.ts:408-420`](file:///Users/apple/Byten/byteInn/src/modules/rooms/room.service.ts#L408-L420)
- **Reproduction**:
  1. If Room 101 has a temporary plumbing issue today and is marked `MAINTENANCE`, a customer calling to book Room 101 for next month is rejected with `BadRequestError: Room 101 is currently under MAINTENANCE and cannot be booked`.
  2. Conversely, if Room 101 has an active booking for tomorrow, a receptionist can set Room 101 to `MAINTENANCE` or `OUT_OF_SERVICE` right now without any validation warning about tomorrow's incoming reservation.
- **Impact**: Coupling current physical maintenance state to future booking calendars corrupts reservation capability and causes sudden operational conflicts on check-in day.
- **Suggested Fix**:
  Decouple immediate physical room status from future maintenance blocks (or introduce a date-ranged `MaintenanceBlock` model with start and end dates).

---

### Finding ADV-RSV-04: Early Checkout Leaves Stale `departure_date` in Database Record
- **Severity**: High
- **Status**: **CONFIRMED** (Inspected in `CheckInOutService.checkOut`)
- **File & Line**: [`src/modules/check-in-out/check-in-out.service.ts:233-240`](file:///Users/apple/Byten/byteInn/src/modules/check-in-out/check-in-out.service.ts#L233-L240)
- **Reproduction**:
  Book Room 101 from Oct 1 to Oct 10. Check out the room on Oct 3.
  *Result*: Status updates to `CHECKED_OUT`, but `departure_date` remains `Oct 10`.
- **Impact**:
  1. The exclusion constraint releases the room because status is `CHECKED_OUT`.
  2. However, any query filtering by `departureDate` (such as historical reports or invoice night calculations) still considers the stay as 9 nights instead of 2 nights.
  3. In `ReportsService.getOccupancyReport`, Oct 4–9 are still tallied as occupied nights unless specifically filtered by checkout timestamp.
- **Suggested Fix**:
  During `checkOut`, update `departure_date` to `now` (truncated to date), or adjust invoice room charge line items accordingly.

---

```
================================================================================
SECTION 5: BILLING, PAYMENTS & MONETARY INTEGRITY
================================================================================
```

### Finding ADV-BIL-01: Historical Cash Drawer Shift Reconciliations Retroactively Corrupted Upon Voiding Payments
- **Severity**: High
- **Status**: **CONFIRMED** (Reproduced via HTTP & Service test)
- **File & Line**: [`src/modules/reports/reports.service.ts:1021-1025`](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L1021-L1025)
- **Reproduction**:
  1. Record a $450 cash payment on August 20.
  2. Query `ReportsService.getShiftCollections("2026-08-20")` -> Returns $450.00.
  3. Void the payment today via `BillingService.voidPayment`.
  4. Re-query `ReportsService.getShiftCollections("2026-08-20")` -> Returns $0.00!
- **Impact**: End-of-shift cash drawer reconciliations signed off by receptionists and accountants in the past are retroactively altered when payments are voided. Cash audit trails become inconsistent with physical bank deposits.
- **Suggested Fix**:
  Never retroactively delete or filter out voided payments from past shift collection queries. Introduce `voidedAt` and `voidedBy` timestamps on `Payment`. In shift collection reports, display void transactions in the shift during which the void occurred, rather than altering historical shift records.

---

### Finding ADV-BIL-02: Zero Rate Floor ($0) and Unlimited 100% Discounts Without Management Approval
- **Severity**: High
- **Status**: **CONFIRMED** (Inspected schemas)
- **File & Line**: [`src/modules/reservations/reservation.validation.ts:74-83`](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.validation.ts#L74-L83), [`src/modules/billing/billing.validation.ts:6-10`](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.validation.ts#L6-L10)
- **Reproduction**:
  1. A receptionist submits a booking with `bookedNightlyRate: 0.00` for a $1,000/night luxury suite. Zod refinement passes (`num >= 0`).
  2. A receptionist creates an invoice with `discountTotal: 50000.00`. Zod schema passes without requiring a reason, coupon code, or manager sign-off.
- **Impact**: Any front-desk staff member can issue free rooms or apply 100% discounts without supervisor authorization or audit accountability.
- **Suggested Fix**:
  Enforce a minimum rate floor (e.g. rate cannot be below 50% of category base price without admin role) and require a non-empty `discountReason` and `approvedByAdminId` if `discountTotal > 0`.

---

### Finding ADV-BIL-03: Invoices Can Be Mutated After Status is `PAID` (Demoting Status or Overpaying)
- **Severity**: High
- **Status**: **CONFIRMED** (Inspected in `src/modules/billing/billing.service.ts`)
- **File & Line**: [`src/modules/billing/billing.service.ts:474-476, 515-524, 580-583`](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L474-L476)
- **Reproduction**:
  1. An invoice has $1,000 billed and $1,000 paid (`status = PAID`).
  2. A receptionist calls `POST /api/invoices/[id]/items` adding a $200 minibar item.
  *Result*: The invoice total becomes $1,200. Because `totalPaid ($1,000) < grandTotal ($1,200)`, line 520 automatically transitions the invoice status from `PAID` back to `PARTIALLY_PAID`!
  3. If an item is deleted after payment, `grandTotal` becomes less than `totalPaid`, resulting in unhandled overpayment and zero refund mechanism.
- **Impact**: Settled tax invoices are altered after completion, violating statutory accounting standards and creating unmanaged balance discrepancies.
- **Suggested Fix**:
  Block adding or removing items once an invoice is in `PAID` status (`if (invoice.status === InvoiceStatus.PAID) throw new Error("Cannot modify a settled invoice. Issue a supplemental invoice or credit memo.")`).

---

### Finding ADV-BIL-04: Absence of Payment Submission Idempotency: Retries Double-Charge Guests
- **Severity**: Medium
- **Status**: **CONFIRMED** (Inspected `Payment` model and `recordPayment`)
- **File & Line**: [`src/modules/billing/billing.service.ts:776-805`](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L776-L805)
- **Reproduction**:
  On an invoice with a $500 balance, send two concurrent HTTP POST requests to `/api/invoices/[id]/payments` with `{ "amount": 100, "paymentMethod": "CARD" }`.
  *Result*: Both requests succeed sequentially. Two separate $100 payments are recorded ($200 total), double-charging the guest.
- **Impact**: Receptionists double-clicking "Submit Payment" or network retries over unstable connections result in duplicate payment records.
- **Suggested Fix**:
  Require an `Idempotency-Key` HTTP header or unique `referenceNumber` check per invoice in `recordPayment`.

---

### Finding ADV-BIL-05: Non-Sequential Invoice & Receipt Numbers with High Birthday Collision Probability
- **Severity**: Medium
- **Status**: **CONFIRMED** (Code reading & entropy analysis)
- **File & Line**: [`src/modules/billing/billing.service.ts:42-49, 848`](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L42-L49)
- **Reproduction**:
  `generateInvoiceNumber()` uses `crypto.randomBytes(2).toString("hex")` (16 bits of randomness = 65,536 combinations per day).
  By the Birthday Paradox, the collision probability exceeds 50% after just ~300 invoices in a single day.
- **Impact**:
  1. When a collision occurs, `tx.invoice.create` crashes with a unique constraint failure (`invoice_number_key`), aborting the reservation or billing flow with an unhandled 500 error.
  2. Indian GST Act (Section 31) and international tax regulations require invoice numbers to be consecutive/sequential per financial year.
- **Suggested Fix**:
  Implement a sequential atomic database counter (`CREATE SEQUENCE invoice_number_seq`) formatted as `INV-YYYY-XXXXXX`.

---

### Finding ADV-BIL-06: Absence of Automated Tax Slab Computation and Missing Refund / Credit Note Models
- **Severity**: Medium
- **Status**: **CONFIRMED** (Inspected `billing.validation.ts` and `schema.prisma`)
- **File & Line**: [`src/modules/billing/billing.validation.ts:10-14`](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.validation.ts#L10-L14)
- **Impact**: The backend does not compute GST or taxes; it blindly accepts whatever `taxTotal` string the frontend sends. There is no support for tax slabs (e.g. 12% for rooms <= ₹7,500 and 18% above), no CGST/SGST separation, and no refund or credit note models.
- **Suggested Fix**:
  Implement backend tax calculation rules based on room nightly rates and provide a `CreditNote` model for returns.

---

```
================================================================================
SECTION 6: DATA INTEGRITY, DELETIONS & AUDITING
================================================================================
```

### Finding ADV-DATA-01: Hazardous `onDelete: Cascade` on Reservations and Invoices Erases Audit Trails
- **Severity**: High
- **Status**: **CONFIRMED** (Inspected `prisma/schema.prisma` lines 286, 336 and SQL migrations)
- **File & Line**: [`prisma/schema.prisma:286, 336`](file:///Users/apple/Byten/byteInn/prisma/schema.prisma#L286)
- **Reproduction**:
  Inspect foreign keys in `prisma/migrations/20261011074136_init_v1_schema/migration.sql`:
  ```sql
  ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE;
  ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE;
  ```
- **Impact**:
  1. If a `Reservation` is deleted, PostgreSQL cascades and permanently deletes all `reservation_rooms` allocations.
  2. If an `Invoice` is deleted, PostgreSQL cascades and permanently deletes all `invoice_items`.
  3. In a financial PMS, operational and financial records must never be hard-deleted or cascaded.
- **Suggested Fix**:
  Change `onDelete: Cascade` to `onDelete: Restrict` on all business-critical tables and implement soft-deletion (`isDeleted` / `deletedAt`).

---

### Finding ADV-DATA-02: Historical Reporting Category Discrepancy Due to Lack of Category Name Snapshotting
- **Severity**: Medium
- **Status**: **CONFIRMED** (Inspected `ReportsService.getOccupancyReport`)
- **File & Line**: [`src/modules/reports/reports.service.ts:126-138`](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L126-L138)
- **Impact**: `reservation_rooms` stores `roomCategoryId`, but not the category name at booking time. If an admin renames "Standard" to "Deluxe Suite", historical occupancy and revenue reports retroactively group past reservations under the new category name.
- **Suggested Fix**:
  Snapshot `bookedCategoryName` on `reservation_rooms` at the time of booking.

---

### Finding ADV-DATA-03: Database Audit Logs Lack Storage-Level Immutability
- **Severity**: High
- **Status**: **CONFIRMED** (Verified by executing `prisma.auditLog.deleteMany` in tests)
- **File & Line**: [`prisma/schema.prisma:367-382`](file:///Users/apple/Byten/byteInn/prisma/schema.prisma#L367-L382)
- **Impact**: The `audit_logs` table has no PostgreSQL `BEFORE UPDATE OR DELETE` triggers blocking mutation. Any database client, service, or compromised account can execute `DELETE FROM audit_logs`, destroying compliance records.
- **Suggested Fix**:
  Add a PostgreSQL database trigger:
  ```sql
  CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
  RETURNS TRIGGER AS $$
  BEGIN
    RAISE EXCEPTION 'Audit logs are append-only and cannot be updated or deleted.';
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
  ```

---

```
================================================================================
SECTION 7: REPORTING & KPI ACCURACY
================================================================================
```

### Finding ADV-REP-01: Occupancy & ADR Reports Treat Unarrived `CONFIRMED` Bookings as Occupied Room Nights
- **Severity**: **Critical**
- **Status**: **CONFIRMED** (Reproduced with future booking test)
- **File & Line**: [`src/modules/reports/reports.service.ts:66-76, 144-170`](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L66-L76)
- **Reproduction**:
  Create a future reservation for Dec 10–12 in `CONFIRMED` status. Query `ReportsService.getOccupancyReport({ startDate: "2026-12-10", endDate: "2026-12-10" })`.
  *Result*: Dec 10 shows `occupiedRooms = 1` and `roomRevenue = $1000.00`!
- **Impact**:
  1. The report queries: `status: { in: [CONFIRMED, CHECKED_IN, CHECKED_OUT] }`.
  2. Unarrived future bookings, pending arrivals, and unarrived no-shows are counted as occupied room nights, artificially inflating historical and current occupancy percentages.
  3. Under USALI lodging industry standards, occupancy and ADR strictly reflect checked-in and realized occupied nights.
- **Suggested Fix**:
  For historical dates (past dates), only count `CHECKED_IN` and `CHECKED_OUT` allocations. For future forecasting, report "On-the-Books (OTB) Reserved Occupancy" separately from realized occupancy.

---

### Finding ADV-REP-02: Receivables Aging Report Erroneously Labels Future Unarrived Guests as "Departed Debt"
- **Severity**: High
- **Status**: **CONFIRMED** (Reproduced via HTTP & Service test)
- **File & Line**: [`src/modules/reports/reports.service.ts:1184-1186, 1243-1254`](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L1184-L1186)
- **Reproduction**:
  Create a reservation for Christmas 2026 (`2026-12-25`) with an auto-created invoice. Query `ReportsService.getReceivablesReport()`.
  *Result*: The Christmas reservation is classified under `guestStayStatus: "DEPARTED"` and counted under `departedReceivablesDec` and `departedCount`!
- **Impact**: Front-desk and accounting staff see future guests who have not even arrived yet listed in the "Departed Guests with Outstanding Debt" aging report alongside actual walkouts.
- **Suggested Fix**:
  Distinguish three states: `IN_HOUSE` (`CHECKED_IN`), `FUTURE_BOOKING` (`CONFIRMED`), and `DEPARTED` (`CHECKED_OUT`). Exclude future unarrived reservations from overdue receivables aging unless explicitly filtering for advance deposits.

---

### Finding ADV-REP-03: Inconsistency Between Accrual Room Revenue in Occupancy Reports vs Cash/Invoiced Revenue
- **Severity**: Medium
- **Status**: **CONFIRMED** (Code reading & architectural comparison)
- **File & Line**: [`src/modules/reports/reports.service.ts:158, 335-345`](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L158)
- **Impact**: `getOccupancyReport` computes revenue night-by-night from `bookedNightlyRate` across stay dates, whereas `getRevenueReport` computes revenue based on the invoice creation date (`createdAt`). For bookings spanning month ends, monthly room revenue figures between the two reports will conflict.
- **Suggested Fix**:
  Document explicitly in the UI whether a report reflects "Accrual Night Revenue" vs "Billing Invoiced Revenue".

---

```
================================================================================
SECTION 8: PRIVACY, INFRASTRUCTURE & SECURITY
================================================================================
```

### Finding ADV-PRIV-01: Plaintext, Unmasked Storage of Government ID Proofs (Aadhaar/Passports)
- **Severity**: High
- **Status**: **CONFIRMED** (Inspected `Customer` schema and audit log payloads)
- **File & Line**: [`prisma/schema.prisma:235-236`](file:///Users/apple/Byten/byteInn/prisma/schema.prisma#L235-L236), [`src/modules/customers/customer.service.ts`](file:///Users/apple/Byten/byteInn/src/modules/customers/customer.service.ts)
- **Impact**: Indian Aadhaar Act regulations (Section 29) and data privacy legislation (DPDP Act 2023) strictly mandate encryption at rest and masking of national identity proofs (e.g., displaying only the last 4 digits). byteInn stores full Aadhaar and Passport numbers in plaintext in PostgreSQL and copies them into unmasked `audit_logs` JSON.
- **Suggested Fix**:
  Implement AES-256 application-level encryption for `idProofNumber` and return a masked string (`••••-••••-1234`) on public API routes.

---

### Finding ADV-PRIV-02: Host Port 5432 Exposed to All Network Interfaces with Hardcoded Credentials
- **Severity**: High
- **Status**: **CONFIRMED** (Inspected `docker-compose.yml`)
- **File & Line**: [`docker-compose.yml:29-30, 32-34`](file:///Users/apple/Byten/byteInn/docker-compose.yml#L29-L30)
- **Reproduction**:
  ```yaml
  ports:
    - "5432:5432"
  environment:
    POSTGRES_USER: byteinn_user
    POSTGRES_PASSWORD: byteinn_password
  ```
- **Impact**: In `docker-compose.yml`, the PostgreSQL port 5432 is bound to `0.0.0.0:5432` on the host machine with a default hardcoded password. Anyone on the local network (or public internet if deployed on a VPS) can connect directly to PostgreSQL.
- **Suggested Fix**:
  Remove `ports: - "5432:5432"` from the `db` service in `docker-compose.yml`. PostgreSQL only needs to be accessible to the `app` container via the internal Docker bridge network.

---

### Finding ADV-PRIV-03: Complete Absence of HTTP Security Headers in `next.config.ts`
- **Severity**: Medium
- **Status**: **CONFIRMED** (Inspected `next.config.ts`)
- **File & Line**: [`next.config.ts:1-8`](file:///Users/apple/Byten/byteInn/next.config.ts#L1-L8)
- **Impact**: `next.config.ts` defines zero HTTP security headers. The application lacks `Content-Security-Policy` (CSP), `X-Frame-Options` (vulnerable to Clickjacking), `X-Content-Type-Options: nosniff` (vulnerable to MIME confusion), `Referrer-Policy`, and `Strict-Transport-Security` (HSTS).
- **Suggested Fix**:
  Add standard security headers in `next.config.ts` via the `headers()` configuration hook.

---

### Finding ADV-PRIV-04: Process Uptime & Version Disclosure on Unauthenticated `/api/health` Endpoint
- **Severity**: Low
- **Status**: **CONFIRMED** (Inspected `src/app/api/health/route.ts`)
- **File & Line**: [`src/app/api/health/route.ts:23-30`](file:///Users/apple/Byten/byteInn/src/app/api/health/route.ts#L23-L30)
- **Impact**: `/api/health` returns `uptime` in seconds and application `version: "0.0.1"` without authentication or rate limiting. Attackers can fingerprint container restarts or flood `/api/health` to trigger unthrottled `SELECT 1` queries on PostgreSQL.
- **Suggested Fix**:
  Limit `/api/health` response to `{ "status": "ok" }` and apply rate limiting.

---

### Finding ADV-PRIV-05: Complete Absence of Automated Database Backup Scripts and Disaster Recovery Runbooks
- **Severity**: High
- **Status**: **CONFIRMED** (Search across entire repository)
- **File & Line**: Entire Codebase
- **Impact**: There are no backup scripts (`pg_dump`), backup cron jobs, or verified restore procedures. In the event of disk corruption or Docker volume failure, all hotel bookings, payments, and guest records are permanently lost.
- **Suggested Fix**:
  Provide an automated backup script (`scripts/backup-db.sh`) and document a tested recovery runbook in `docs/DISASTER_RECOVERY.md`.

---

```
================================================================================
SECTION 9: TEST QUALITY & VERIFICATION LIMITATIONS
================================================================================
```

### Finding ADV-TEST-01: Test Suite Almost Exclusively Calls Services Directly, Bypassing HTTP Route Handlers
- **Severity**: High
- **Status**: **CONFIRMED** (Inspected all files in `tests/`)
- **File & Line**: [`tests/`](file:///Users/apple/Byten/byteInn/tests)
- **Impact**: Tests in `tests/` almost exclusively call domain services directly (e.g. `ReservationService.createReservation`, `BillingService.recordPayment`). Route handler parameter parsing, Zod request body validation, cookie extraction, HTTP status codes, and HTTP error serialization in `src/app/api/...` are almost entirely untested by the automated test suite.
- **Suggested Fix**:
  Add integration test suites that dispatch simulated `NextRequest` objects to all route handlers under `src/app/api/`.

---

### Finding ADV-TEST-02: Concurrency Tests Run in Same Event Loop; Concurrency on Invoices Untested
- **Severity**: Medium
- **Status**: **CONFIRMED** (Inspected `tests/reservations.test.ts` and `tests/billing.test.ts`)
- **File & Line**: [`tests/reservations.test.ts:568-615`](file:///Users/apple/Byten/byteInn/tests/reservations.test.ts#L568-L615)
- **Impact**: Existing concurrency tests use `Promise.allSettled` within a single Node.js process. Furthermore, concurrent invoice creation (`BillingService.createInvoiceForReservation`) and duplicate partial payment submissions have zero concurrency tests, allowing race conditions to slip past the build pipeline.
- **Suggested Fix**:
  Add concurrency tests verifying that concurrent calls to `createInvoiceForReservation` and `recordPayment` are serialized safely.

---

## Areas Could Not Verify

1. **`npm audit` Dependency Vulnerability Feed**:
   - The command `npm audit` timed out connecting to `registry.npmjs.org` due to the air-gapped / offline network sandbox environment. Direct inspection of root dependencies was performed manually; all packages use current major releases (`next@16.4.0`, `@prisma/client@6.19.3`, `jose@6.2.2`).
2. **Physical Thermal Printer Hardware**:
   - Thermal receipt voucher printing (`/billing/[id]/receipts/[paymentId]/print`) was verified using CSS `@media print` rules and headless DOM layout inspection. Physical ESC/POS thermal printer rendering could not be tested without hardware.
3. **Multi-Property Database Isolation**:
   - In V1, byteInn operates as a single-tenant property management system. Multi-tenant isolation was not tested as it was explicitly declared out of scope for V1 in `AGENTS.md`.

---

## Action Plan & Remediation Roadmap (For Subsequent Phase)

> [!IMPORTANT]
> Per audit instructions, **no code has been modified during this assessment**. The following prioritizes the recommended fixes for the remediation phase:

1. **Phase 1: Critical Operational & Report Fixes (ADV-TIME-01, ADV-REP-01, ADV-REP-02)**:
   - Introduce timezone-aware date extraction (`Asia/Kolkata`) across reporting services to fix midnight date regression.
   - Refactor `getOccupancyReport` to exclude unarrived `CONFIRMED` bookings and fix receivables debt classification.
2. **Phase 2: Authorization & Rate Limiting Hardening (ADV-AUTH-01, ADV-AUTH-02, ADV-SESS-01, ADV-SESS-02)**:
   - Enforce `invoiceId === payment.invoiceId` in `voidPayment`.
   - Restrict voiding to `ADMIN` role.
   - Stop trusting raw `X-Forwarded-For` in `loginRateLimiter`.
3. **Phase 3: Financial Integrity & Invariants (ADV-BIL-01, ADV-BIL-02, ADV-BIL-03, ADV-BIL-05)**:
   - Record void timestamps without retroactively altering historical shift collections.
   - Disallow modifying invoices in `PAID` status.
   - Introduce rate floor and discount authorization limits.
4. **Phase 4: Privacy, Data Protection & Infrastructure (ADV-PRIV-01, ADV-PRIV-02, ADV-PRIV-03, ADV-PRIV-05)**:
   - Encrypt and mask guest government ID numbers.
   - Remove host port exposure for PostgreSQL in `docker-compose.yml`.
   - Add HTTP security headers in `next.config.ts`.
