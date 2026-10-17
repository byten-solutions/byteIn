# byteInn — Low-Level Architecture (V1)

## 1. Purpose

byteInn is a reception-operated room management application. Reception staff create and manage reservations, assign rooms, check guests in and out, and record payments. There is no customer-facing booking portal in V1.

## 2. Technology Stack

- **Frontend:** Next.js
- **UI:** shadcn/ui
- **Backend:** Node.js REST API
- **Database:** PostgreSQL
- **Database access:** Prisma ORM
- **Deployment:** One frontend application, one backend API, and one PostgreSQL database

Keep the backend as a single application. Do not introduce microservices, queues, event sourcing, or a separate reporting database for V1.

## 3. High-Level Request Flow

```text
Receptionist / Admin
        |
        v
Next.js Frontend (shadcn/ui)
        |
        | HTTPS / JSON
        v
Node.js REST API
  - Authentication
  - Authorization
  - Request validation
  - Business rules
  - Error handling
        |
        v
Prisma ORM
        |
        v
PostgreSQL
```

The frontend handles presentation and form-level feedback. The backend is responsible for enforcing permissions, validating data, checking availability, calculating charges, and applying state changes.

## 4. Backend Structure

Use feature-based folders in one Node.js application. Avoid creating separate services or packages for every domain.

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
    reports/
    audit/
  lib/
    prisma.js
  utils/
prisma/
  schema.prisma
  migrations/
```

Each module can contain its routes/controllers, validation schemas, and service functions as needed. Keep business logic in service functions rather than inside route handlers.

## 5. Main Modules

### Authentication and Users
- Sign in and sign out.
- Store password hashes, never plain-text passwords.
- Support two V1 roles: `ADMIN` and `RECEPTIONIST`.
- Admin manages users and configuration.
- Receptionist manages day-to-day customer, reservation, check-in/out, and payment workflows.
- Enforce permissions in the API, not only by hiding frontend controls.

### Property and Room Setup
- Properties
- Buildings
- Floors
- Room categories
- Amenities
- Rooms

V1 can support one or multiple properties within the same installation. Do not implement tenants or tenant-resolution middleware yet.

### Customers
- Create and update guest details.
- Store contact details and required identification details.
- Link reservations to a primary customer.
- Keep customer history limited to their reservations for V1.

### Reservations
- Reception staff create every reservation.
- One reservation can include multiple rooms.
- Every room allocation has its own arrival date, departure date, room category, assigned physical room, and agreed nightly rate.
- A physical room is assigned at booking time.
- A reservation may have different stay dates for different rooms.
- The reservation record groups the room allocations under one booking number.
- Support modification, cancellation, and reservation status changes.

### Check-In / Check-Out
- Allow each room allocation to be checked in and checked out independently.
- Validate the room assignment and reservation state before check-in.
- On checkout, mark the room as `VACANT_DIRTY`.
- The room becomes clean only after staff explicitly update its physical status.
- Do not mark a room available merely because a reservation was checked out.

### Billing and Payments
- One reservation can have an invoice covering multiple room allocations.
- Use invoice line items for room charges, additional charges, discounts, and taxes where applicable.
- Support multiple payments against an invoice, including partial payments.
- Track the invoice total, amount paid, and outstanding balance.
- Record refunds explicitly if refunds are supported; do not silently delete or rewrite payment records.
- Preserve the agreed rate saved on each room allocation. Later changes to the room category's default price must not change existing bookings.

### Reports
PMS operational and financial reporting suite:
- **Occupancy & KPIs**: Occupancy rate %, occupied room nights, total room revenue, Average Daily Rate (ADR), Revenue Per Available Room (RevPAR), and room category performance breakdown.
- **Revenue & Collections**: Room charges, extra charges, taxes, discounts, net invoiced vs collected payments, and payment method distribution.
- **Daily Operations (Shift Management)**: Today's arrivals (with invoice balance), departures (with balance due), in-house guests, and overdue check-ins / no-shows.
- **Room Availability / Tape Chart Grid**: Date-by-room visual grid (7-day / 14-day) showing booked slots (with guest names and reservation links), vacant slots (with nightly rates), and maintenance blocks.
- **Daily Collections Report**: End-of-shift drawer reconciliation by payment method (cash, card, UPI, bank transfer) and by staff user.
- **Outstanding Balances & Receivables Aging**: Aging buckets (0–7 days, 8–30 days, 31–60 days, 60+ days) and itemized debtor list filtered by in-house vs departed guests.

Define report calculations consistently before implementing them. Distinguish billed revenue from money actually collected. All monetary metrics enforce Decimal fixed precision.

### Audit
Record important actions such as reservation creation/modification/cancellation, room assignment, check-in/out, invoice changes, and payment/refund activity. Keep the audit implementation simple and centralized.

## 6. Core Data Relationships

```text
User
  └── Role

Property
  └── Building
       └── Floor
            └── Room ── RoomCategory

Customer
  └── Reservation
       └── ReservationRoom
            ├── RoomCategory
            └── Room (assigned at booking)

Reservation
  └── Invoice
       ├── InvoiceItem
       └── Payment

User
  └── AuditLog
```

### Important database rules

- `ReservationRoom` represents one room included in a reservation.
- Store `arrival_date`, `departure_date`, `room_category_id`, `room_id`, and `booked_nightly_rate` on `ReservationRoom`.
- `room_id` is required because V1 assigns a physical room at booking.
- Use a unique reservation number and invoice number.
- Enforce room-number uniqueness within the chosen property/building scope.
- Use foreign keys and suitable indexes for foreign keys and frequently queried dates/statuses.
- Store monetary values using PostgreSQL `numeric`/Prisma `Decimal`, not floating-point numbers.
- Keep reservation status separate from room physical status.
- Use consistent date semantics: arrival is inclusive and departure is exclusive.
- Prevent overlapping active allocations for the same physical room. Perform the availability check and reservation write safely in a database transaction; do not rely only on the frontend availability result.
- Since rooms in one reservation can have different dates, availability must be checked for each room allocation's own date range.
- Validate that a room belongs to the selected property and matches the chosen room category.
- For V1, users, properties, rooms, customers, reservations, invoices, payments, and audit records do not require `tenant_id`.

## 7. Reservation and Room Statuses

### Reservation
Use a small, explicit lifecycle. Suggested V1 statuses:

- `CONFIRMED`
- `CANCELLED`
- `COMPLETED`

If a draft or pending workflow is genuinely required by reception, add it; otherwise do not add statuses that the UI does not use.

Check-in/check-out state should be tracked per room allocation so different rooms in one reservation can progress independently. A reservation-level status can be derived or updated based on the states of its room allocations.

### Room physical status
- `VACANT_CLEAN`
- `VACANT_DIRTY`
- `OCCUPIED`
- `MAINTENANCE`
- `OUT_OF_SERVICE`

Booking availability is not a room status. A room is bookable only when its physical state permits it and no active reservation allocation overlaps the requested dates.

## 8. API Boundaries

Use REST endpoints grouped by feature. Exact endpoint names can be finalized during implementation.

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
/reports
/audit-logs
```

The API must validate identifiers and relationships on every request. Never trust a room, customer, invoice, or reservation ID merely because it came from the frontend.

## 9. Frontend Structure

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

Use shadcn/ui for common interface elements and forms. Keep API calls and shared types organized, but do not add global state management unless real UI needs require it.

## 10. Security and Reliability

- Hash passwords with a suitable password-hashing algorithm.
- Use secure session/token handling appropriate to the deployment.
- Apply authentication and role checks to protected API routes.
- Validate all request data on the server.
- Use database transactions for multi-step operations such as booking a room and recording payments.
- Avoid logging passwords, authentication tokens, or unnecessary identity-document data.
- Configure backups and test restoring them.
- Add integration tests for booking overlap, room assignment, partial payments, cancellation, and tenant-free authorization boundaries.
- Use environment variables for secrets and database credentials.

## 11. V1 Exclusions

Do not build these unless a confirmed business requirement appears:

- Multi-tenancy
- Customer-facing booking portal
- Online booking channel / OTA integrations
- Dynamic pricing
- Housekeeping task management
- Maintenance ticket workflow
- Notifications and messaging integrations
- Document OCR
- Microservices or event-driven infrastructure
- Advanced accounting

## 12. Remaining Decisions

These can be settled before the related module is implemented:

1. **Cancellation and refunds:** Whether deposits are refundable, partially refundable, or non-refundable, and who can approve refunds.
2. **Pricing:** Whether a room allocation has one fixed nightly rate for the whole stay or a rate per night. The database must preserve whichever rates were agreed at booking.
3. **Extra charges and taxes:** Which charge types and tax rules are required for the first property.
4. **Property scope:** Whether V1 must support multiple properties in one installation. The proposed schema supports this without introducing multi-tenancy.
5. **Reservation edits:** Rules for changing dates or assigned rooms when a booking is already checked in or partially checked out.

## 13. Implementation Principle

Build one complete reception workflow at a time:

**Create reservation with multiple assigned rooms → check in each room → create invoice → record one or more payments → check out each room → review reports.**

Prefer the simplest implementation that correctly enforces these business rules. Add abstractions only when repeated code or a concrete requirement justifies them.
