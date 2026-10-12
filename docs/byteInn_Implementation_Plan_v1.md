# byteInn — V1 Implementation Plan

## 1. V1 Goal

Build a reception-operated room management application. Reception staff create and manage all bookings; customers do not book directly through byteInn.

## 2. Technology Stack

- **Frontend:** Next.js + shadcn/ui
- **Backend:** Node.js API
- **Database:** PostgreSQL
- **Database access:** Prisma is a practical default; confirm before implementation if another ORM is preferred.
- **Deployment:** One frontend, one backend API, and one database.

Keep the backend as a single application organized by feature. Do not introduce microservices, queues, or other infrastructure unless a real requirement appears.

## 3. Confirmed V1 Business Rules

- **Users:** Admin and receptionist.
- **Booking channel:** Reception staff create every booking.
- **Rooms per booking:** One reservation can include multiple rooms.
- **Room assignment:** Every room allocation is assigned to a physical room when the booking is created.
- **Stay dates:** Each room allocation can have its own check-in and check-out dates.
- **Payments:** Support deposits/partial payments and multiple payments against an invoice, as well as full payment.
- **Pricing:** Preserve the agreed rate for each room allocation when booked. Future changes to category or room prices must not change existing bookings.
- **Multi-tenancy:** Out of scope for V1. Do not build tenant management or add `tenant_id` to every table yet. Revisit when onboarding another business.
- **Customer portal and online booking:** Out of scope for V1.

## 4. Implementation Phases

### Phase 1 — Foundation and Access (Completed)
- Set up the Next.js application and shadcn/ui.
- Set up the Node.js API and PostgreSQL database.
- Configure Prisma (if selected), migrations, and environment variables.
- Implement login, secure password hashing, and authorization for Admin and Receptionist roles.
- Add basic centralized validation, error handling, and logging.
- Add a simple audit log for important actions; improve coverage during stabilization.

### Phase 2 — Property and Room Setup (Completed)
- Properties
- Buildings and floors
- Room categories and amenities
- Rooms, room capacity, and current room condition
- Category base prices and optional room-level price overrides

### Phase 3 — Customer Management (Completed)
- Create, view, update, and search customers
- Contact details and ID proof details
- Basic customer booking history

### Phase 4 — Reservations and Room Availability (Completed)
- Create a reservation for a primary customer
- Add multiple room allocations to one reservation
- Assign a physical room to every allocation at booking time
- Store separate stay dates, category, and agreed nightly rate for each allocation
- Search room availability for a date range
- Prevent overlapping active bookings for the same physical room
- Record the staff member who created the booking

### Phase 5 — Check-In and Check-Out (Completed)
- Check in and check out each room allocation according to its own dates
- Record guest verification and required ID details
- Update room condition after checkout (normally Vacant Dirty)
- Allow a room to become ready for booking only when its condition and reservation schedule permit it

### Phase 6 — Billing and Payments (Completed)
- Create invoice(s) for a reservation and its room allocations
- Add invoice line items for room charges and any supported extra charges
- Preserve booked room rates when calculating room charges
- Record partial and full payments, payment method, date, and reference where applicable
- Calculate paid amount and outstanding balance
- Issue receipts
- Record refunds if refunds are allowed by the final cancellation/payment policy

### Phase 7 — Reports (Completed)
- Occupancy report (REP-004: historical room nights, half-open intervals, zero-division guards)
- Revenue report (REP-005: invoiced revenue vs collected payments, payment methods, extra charges)
- Today's arrivals and departures (Phase 5 check-in/out board & Phase 7 reporting)
- Reservation status report (REP-006: confirmed, in-house, completed, cancelled counts, ALOS)
- Dedicated `/reports` page and navigation (REP-007: filters, stat cards, progress bars, print view)

Use clearly defined calculation rules for each report; do not treat room price, invoiced revenue, and collected payments as interchangeable figures.

### Phase 8 — Stabilization
- Test booking conflicts and overlapping date ranges
- Test reservations with multiple rooms and different dates
- Test partial payments and outstanding balances
- Test cancellation and refund behaviour
- Test role permissions and unauthorized access
- Verify audit coverage, validation, error handling, and backup/recovery basics
- Review performance and security

## 5. Key Data Model Rules

- `reservations` represents the overall booking and its primary customer, booking number, status, notes, and creator.
- `reservation_rooms` represents each room included in the booking. It should contain `reservation_id`, `room_id`, `room_category_id` (or equivalent category snapshot), `check_in`, `check_out`, `booked_nightly_rate`, and assignment/creation timestamps.
- Because rooms are assigned at booking time, `reservation_rooms.room_id` is required in V1.
- Keep stay dates on `reservation_rooms`, not only on `reservations`, because rooms within one booking may have different dates.
- Do not keep a single `room_category_id` on `reservations` as the source of truth; one reservation can include different categories.
- Add `invoice_items` so invoices can explain room charges and extra charges. Payments should be separate records so an invoice can have multiple payments.
- Store money using PostgreSQL `numeric`/decimal types, not floating-point types.
- Enforce relationships so a room, category, property, invoice, and reservation cannot be accidentally mixed across unrelated records.

## 6. Room Status and Availability

Keep physical room condition separate from reservation status.

Suggested physical room statuses:
- `VacantClean`
- `VacantDirty`
- `Occupied`
- `Maintenance`
- `OutOfService`

Determine date-specific availability by checking both the room's physical condition and overlapping room allocations. Avoid relying on a manually maintained `Reserved` status to decide whether a room is available for future dates.

Use a consistent date rule: check-in is inclusive and check-out is exclusive. A stay from October 15 to October 18 occupies the nights of October 15, 16, and 17; another stay may begin on October 18.

Availability validation must happen on the backend and be safe against two receptionists booking the same room concurrently. Use a database transaction and an appropriate PostgreSQL constraint/locking strategy, not only a frontend check.

## 7. Remaining Critical Decisions

These do not need a complex design, but should be agreed before implementing the relevant workflow:

1. **Cancellation and no-show policy:** Can a booking be cancelled after a deposit? Are refunds allowed, and are any fees retained?
2. **Check-in/out workflow:** Is the reservation considered checked in only when every room is checked in, or can each room progress independently? Recommended: track status per room allocation and derive the overall reservation status.
3. **Billing structure:** One invoice per reservation or separate invoices per room allocation? Recommended for V1: one invoice per reservation, with line items for each room and extra charge.
4. **Taxes and discounts:** Are taxes/discounts needed in V1, and are they applied per line item or to the invoice total? Avoid hard-coding a tax rate before confirming requirements.
5. **Guest counts and identity:** Are adult/child counts recorded per room allocation, and is ID proof required for every staying guest or only the primary customer? Recommended: record occupancy per room; confirm local operational requirements for ID collection.
6. **Price calculation:** Is the agreed rate a nightly rate, and can it vary by night? Recommended for V1: one booked nightly rate per room allocation for the entire stay. If prices vary by night, add dated rate lines instead.
7. **Single property or multiple properties:** The schema can support multiple properties under one installation without multi-tenancy. Confirm whether this is needed in V1.

## 8. Explicitly Out of Scope for V1

- Multi-tenancy and tenant administration
- Customer-facing booking portal
- Online travel agency integrations
- Dynamic pricing and seasonal rate engines
- Food ordering, housekeeping task management, and maintenance ticket workflows
- Document OCR and advanced notifications
- Microservices or a separate reporting database

## 9. V1 Completion Criteria

A receptionist can create a customer, create one reservation with multiple physical rooms and independent stay dates, see accurate availability, check guests in and out per room, generate an understandable invoice, record partial or full payments, issue receipts, and view the basic operational reports without allowing overlapping bookings or unauthorized access.
