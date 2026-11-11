# byteInn — Application Architecture (V1)

## 1. Purpose and Scope

byteInn is a reception-operated room management system. Reception staff create bookings, manage guests and room allocations, perform check-in/check-out, and record payments. There is no customer-facing booking portal in V1.

Confirmed rules:
- Roles: `SUPER_ADMIN` (Platform-level global administrator; propertyId = null), `ADMIN` (Hotel Administrator scoped to assigned property; manages hotel operations and receptionist accounts), and `RECEPTIONIST` (Front desk operator scoped to assigned property).
- One reservation can contain multiple rooms.
- Each room is assigned at booking time.
- Room allocations can have different arrival/departure dates.
- Partial and full payments are supported.
- Booked rates are preserved.
- Physical room and financial operations are strictly isolated per hotel property.

## 2. Technology Stack

- Frontend: Next.js
- UI components: shadcn/ui
- Backend: Node.js REST API
- Database: PostgreSQL
- ORM: Prisma
- Deployment: one frontend, one backend API, one PostgreSQL database

Use a modular monolith: one backend application organized by features. Do not introduce microservices, message queues, event sourcing, or a separate reporting database in V1.

## 3. System Context

```text
Admin / Receptionist
        |
        v
Next.js Web App + shadcn/ui
        |
        | HTTPS / JSON
        v
Node.js REST API
  - Authentication
  - Role authorization
  - Input validation
  - Business rules
  - Error handling
        |
        v
Prisma ORM
        |
        v
PostgreSQL
```

The frontend provides the user interface and basic form feedback. The API is the source of truth for authorization, availability, pricing snapshots, status transitions, invoice calculations and payment recording.

## 4. Backend Organization

Keep feature folders in a single Node.js project. Each feature can have route/controller, validation, and service files as needed.

```text
src/
  app.js
  config/
  middleware/
    authenticate.js
    authorize.js
    validateRequest.js
    errorHandler.js
  modules/
    auth/
    users/
    properties/
    rooms/
    customers/
    reservations/
    check-in-out/
    billing/
    financial-accounts/
    income/
    expenses/
    payment-methods/
    reports/
    audit/
  lib/
    prisma.js
  utils/
prisma/
  schema.prisma
  migrations/
```

Do not create a separate layer or abstraction unless it solves a real repeated need. Keep route handlers thin and put business rules in service functions.

## 5. Module Responsibilities

### Auth and Users
- Sign in/sign out.
- Store password hashes, never plaintext passwords.
- Support `ADMIN` and `RECEPTIONIST`.
- Admin manages users and configuration.
- Receptionist handles daily guest, reservation, room, check-in/out and payment workflows.
- Enforce access in the API, not only in the frontend.

### Properties and Rooms
- Manage properties, buildings, floors, room categories, amenities and rooms.
- Validate room/building/floor/property relationships.
- Keep physical room status separate from reservation allocation status.

### Customers
- Create/update guest records.
- Link each reservation to a primary guest.
- Show basic reservation history.
- Keep ID proof requirements configurable through a simple policy, not a workflow engine.

### Reservations
- Reception creates all bookings.
- One reservation groups multiple room allocations.
- Every allocation contains its own room, room category, stay dates and booked nightly rate.
- A physical room is assigned at booking.
- Support cancellation and modification.
- Check each room's requested date range for overlap.
- Use a safe database transaction/locking or a PostgreSQL exclusion constraint to prevent simultaneous overlapping bookings for the same physical room.

### Check-in / Check-out
- Process each room allocation independently.
- Validate the allocation and room state before changing status.
- On checkout, mark the room `VACANT_DIRTY`.
- Require a separate room-status update to mark it clean.
- Define how reservation-level status is updated from its room allocations.

### Billing
- Default to one invoice per reservation.
- Include room charges and applicable extra charges, discounts and taxes as invoice items.
- Support multiple payments per invoice and calculate outstanding balance.
- Preserve booked nightly rates and invoice item amounts.
- Keep refunds/voids traceable; do not delete financial history.

### Financial Accounts & Fund Transfers
- Manage property-scoped liquid accounts: Cash drawers, Operating Bank accounts, and digital wallets.
- Each account preserves an `opening_balance` and `opening_balance_date`.
- Account statements calculate closing liquid balance dynamically:
  $$\text{Balance} = \text{Opening} + \sum \text{Receipts}_{\text{RECORDED}} - \sum \text{Payments}_{\text{RECORDED}} + \sum \text{TransfersIn}_{\text{COMPLETED}} - \sum \text{TransfersOut}_{\text{COMPLETED}}$$
  Transactions prior to `opening_balance_date` are strictly excluded from balance computations.
- Support double-entry internal transfers between accounts with atomic transaction serialization (`SELECT ... FOR UPDATE`), check constraint preventing self-transfers (`from_account_id <> to_account_id`), and overdraft protection.
- Support active/inactive lifecycle toggles; inactive accounts cannot receive or disburse funds.

### Direct Income Management
- Capture non-reservation hotel revenue (event hall bookings, banquet dining, laundry services, parking fees, day passes).
- Configurable property-scoped category heads (`income_heads`) with seedable defaults (`BANQUET`, `LAUNDRY`, `RESTAURANT`, `MISC_INCOME`).
- Incomes track lifecycle: `PENDING` -> `PARTIALLY_RECEIVED` -> `RECEIVED` -> `VOIDED`.
- Inward money recorded as `receipts` linked to target `financial_accounts` with required payment methods and client-side `idempotency_key`.
- Two-stage voiding protection: active incomes with recorded receipts cannot be voided directly; voiding a receipt reverses account liquid balance and rolls back parent income status.

### Expense Management
- Track hotel operational expenses (utilities, facility maintenance, room amenities, housekeeping supplies, food/beverage stock, staff welfare).
- Configurable property-scoped category heads (`expense_heads`) with 6 approved default codes: `UTILITIES`, `MAINTENANCE`, `SUPPLIES`, `FOOD_BEVERAGE`, `STAFF_WELFARE`, and `MISC_EXPENSE`.
- Expenses track lifecycle: `PENDING` -> `PARTIALLY_PAID` -> `PAID` -> `VOIDED`.
- Outgoing disbursements recorded as `payments` linked to source `financial_accounts` with required payment methods.
- Strict overdraft prevention: disbursements serialize via `FOR UPDATE` on financial accounts and reject requests exceeding available funds.
- Robust idempotency: compares full payload details and handles server defaults; catches PostgreSQL `23505` unique constraint races (Prisma `P2002`) and recovers via clean fallback lookup outside aborted transactions.
- Controlled two-stage voiding: an expense with recorded payments cannot be voided directly; voiding an individual disbursement immediately refunds the account balance and dynamically recalculates expense status (`PAID` -> `PARTIALLY_PAID` or `PENDING`).

### Payment Methods & Reception Cash Drawer
- Track accepted tender types (`CASH`, `CARD`, `UPI`, `BANK_TRANSFER`) mapped to default financial accounts.
- Enforce active/inactive status and referential integrity against incoming receipts and outgoing payments.

### Reports
Start with occupancy, revenue/payments, arrivals and departures. Define whether revenue means billed charges or payments collected and use that definition consistently.

### Audit
Record key actions: reservation creation/modification/cancellation, room assignment, check-in/out, invoice changes, payment and refund activity. Keep audit logging centralized and simple.

## 6. Frontend Organization

```text
app/
  (auth)/
  dashboard/
  properties/
  rooms/
  customers/
  reservations/
  check-in-out/
  billing/
  finance/
  reports/
  users/
components/
  ui/          # shadcn/ui components
  shared/
lib/
  api-client.ts
  auth.ts
  utils.ts
```

Use shadcn/ui for shared form controls, dialogs, tables and layout primitives. Organize API calls and shared types consistently. Do not add Redux/Zustand or another global state library unless a real requirement emerges.

## 7. API Boundaries

Group REST endpoints by feature. Names can be finalized during implementation.

```text
/auth
/users
/properties
/buildings
/floors
/room-categories
/rooms
/customers
/reservations
/reservations/:id/room-allocations
/room-allocations/:id/check-in
/room-allocations/:id/check-out
/invoices
/invoices/:id/payments
/financial-accounts
/financial-accounts/:id
/financial-accounts/:id/statement
/account-transfers
/payment-methods
/payment-methods/:id
/income-heads
/income-heads/seed
/income-heads/:id
/incomes
/incomes/:id
/incomes/:id/receipts
/incomes/:id/receipts/:receiptId/void
/incomes/:id/void
/expense-heads
/expense-heads/seed
/expense-heads/:id
/expenses
/expenses/:id
/expenses/:id/payments
/expenses/:id/payments/:paymentId/void
/expenses/:id/void
/reports
/audit-logs
```

Every request must validate authorization and the relationships between submitted IDs. Never trust a room/customer/invoice/reservation ID simply because it came from the frontend.

## 8. Core Workflow

```text
Reception signs in
        |
        v
Select / create primary guest
        |
        v
Create reservation and add room allocations
(each has assigned room, dates and booked rate)
        |
        v
Validate availability and save atomically
        |
        v
Check in each room allocation when guest arrives
        |
        v
Generate invoice with itemized charges
        |
        v
Record one or more payments
        |
        v
Check out each room allocation
        |
        v
Mark rooms clean after housekeeping
```

This workflow is the primary acceptance path for V1. It should work end-to-end before optional features are added.

## 9. Security and Reliability

- Hash passwords using a suitable password-hashing algorithm.
- Use secure session/token handling appropriate to deployment.
- Validate all request data on the server.
- Enforce roles on protected API endpoints.
- Use database transactions for multi-step booking and payment operations.
- Avoid logging passwords, tokens or unnecessary identity-document data.
- Configure database backups and test restoration.
- Test room overlap/concurrent booking, partial payment, cancellation, check-in/out and role access.
- Keep credentials in environment variables.

## 10. V1 Exclusions

- Multi-tenancy and tenant-resolution middleware
- Customer-facing booking portal
- Online travel agency integrations
- Dynamic pricing
- Housekeeping task management
- Maintenance ticket workflow
- Notifications/messaging integrations
- Document OCR
- Microservices/event-driven infrastructure
- Advanced accounting

## 11. Remaining Decisions

Decide before implementing the relevant feature:
1. Cancellation and refund policy.
2. Whether room rate is fixed per stay or can vary by night.
3. Required taxes and extra charge types.
4. When guest ID proof is mandatory.
5. Whether multiple properties are needed in the first installation.
6. Rules for modifying a reservation after one room allocation has checked in.

## 12. Implementation Principle

Build the simplest complete reception workflow first. Add abstractions only when repeated code or a confirmed business requirement justifies them.
