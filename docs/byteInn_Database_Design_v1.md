# byteInn — Database Design (V1)

## 1. Scope

This document defines the initial PostgreSQL data model for byteInn, a reception-operated room management application.

Confirmed V1 rules:
- Admin and receptionist roles.
- Reception staff create all reservations.
- A reservation can include multiple rooms.
- A physical room is assigned at booking time.
- Each room in a reservation can have different arrival and departure dates.
- Partial and full payments are supported.
- Agreed room rates are preserved when default prices change.
- Multi-tenancy is deferred.
- One installation may support one or multiple properties; property scope remains a product decision.

Use PostgreSQL with Prisma ORM. Monetary values should use PostgreSQL `numeric` / Prisma `Decimal`.

## 2. Core Entity Relationship

```text
User ── Role

Property ── Building ── Floor ── Room ── RoomCategory

Customer ── Reservation ── ReservationRoom ── Room
                                  │
                                  └── RoomCategory

Reservation ── Invoice ── InvoiceItem
                          └── Payment

User ── AuditLog
```

A `Reservation` groups the booking. Each `ReservationRoom` represents one physical room booked for a specific date range. The room category, assigned room, stay dates and agreed rate belong to the allocation.

## 3. Tables

### 3.1 users

| Column | Type / notes |
|---|---|
| id | UUID or generated ID, primary key |
| name | Required |
| email | Required, unique |
| password_hash | Required |
| role_id | FK to roles.id |
| status | Active / disabled |
| last_login_at | Nullable timestamp |
| created_at | Timestamp |
| updated_at | Timestamp |

### 3.2 roles

| Column | Type / notes |
|---|---|
| id | Primary key |
| name | `ADMIN` or `RECEPTIONIST`, unique |
| description | Optional |
| created_at | Timestamp |
| updated_at | Timestamp |

For V1, use the two fixed roles above. Do not build a configurable permissions editor unless required.

### 3.3 properties

| Column | Type / notes |
|---|---|
| id | Primary key |
| name | Required |
| address | Optional |
| city | Optional |
| state | Optional |
| country | Optional |
| phone | Optional |
| email | Optional |
| status | Active / inactive |
| created_at | Timestamp |
| updated_at | Timestamp |

### 3.4 buildings

| Column | Type / notes |
|---|---|
| id | Primary key |
| property_id | FK to properties.id |
| name | Required |
| description | Optional |
| created_at | Timestamp |
| updated_at | Timestamp |

### 3.5 floors

| Column | Type / notes |
|---|---|
| id | Primary key |
| building_id | FK to buildings.id |
| floor_no | Required |
| name | Optional |
| created_at | Timestamp |
| updated_at | Timestamp |

### 3.6 room_categories

| Column | Type / notes |
|---|---|
| id | Primary key |
| property_id | FK to properties.id if categories vary by property |
| name | Required |
| description | Optional |
| base_price | Required Decimal |
| max_occupancy | Required integer |
| created_at | Timestamp |
| updated_at | Timestamp |

Decision: if categories are shared across all properties in one installation, `property_id` can be omitted. Pick one model before migration.

### 3.7 amenities

| Column | Type / notes |
|---|---|
| id | Primary key |
| name | Required |
| description | Optional |
| created_at | Timestamp |

### 3.8 room_category_amenities

| Column | Type / notes |
|---|---|
| room_category_id | FK to room_categories.id |
| amenity_id | FK to amenities.id |
| primary key | Composite (`room_category_id`, `amenity_id`) |

### 3.9 rooms

| Column | Type / notes |
|---|---|
| id | Primary key |
| property_id | FK to properties.id |
| building_id | FK to buildings.id |
| floor_id | FK to floors.id |
| room_category_id | FK to room_categories.id |
| room_no | Required |
| display_name | Optional |
| capacity | Required integer |
| status | `VACANT_CLEAN`, `VACANT_DIRTY`, `OCCUPIED`, `MAINTENANCE`, `OUT_OF_SERVICE` |
| price_override | Nullable Decimal |
| notes | Optional |
| created_at | Timestamp |
| updated_at | Timestamp |

Constraints:
- Room number must be unique within the chosen scope, preferably `(building_id, room_no)` if buildings are used.
- Validate that building and floor belong to the same property.
- Validate that the room category is valid for the selected property.

### 3.10 customers

| Column | Type / notes |
|---|---|
| id | Primary key |
| first_name | Required |
| last_name | Optional |
| phone | Required or optional depending on business policy |
| email | Optional |
| nationality | Optional |
| address | Optional |
| id_proof_type | Optional until policy is decided |
| id_proof_number | Optional until policy is decided |
| remarks | Optional |
| created_at | Timestamp |
| updated_at | Timestamp |

### 3.11 reservations

| Column | Type / notes |
|---|---|
| id | Primary key |
| reservation_no | Required, unique |
| customer_id | FK to customers.id |
| status | `CONFIRMED`, `CANCELLED`, `COMPLETED` to start |
| created_by | FK to users.id |
| special_requests | Optional |
| created_at | Timestamp |
| updated_at | Timestamp |

A reservation does not store a single arrival/departure range because different room allocations may have different dates.

### 3.12 reservation_rooms

| Column | Type / notes |
|---|---|
| id | Primary key |
| reservation_id | FK to reservations.id |
| room_id | Required FK to rooms.id; room assigned at booking |
| room_category_id | FK to room_categories.id |
| arrival_date | Required date |
| departure_date | Required date |
| booked_nightly_rate | Required Decimal snapshot |
| adults | Integer, default 1 |
| children | Integer, default 0 |
| status | Allocation status such as `CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`, `CANCELLED` |
| checked_in_at | Nullable timestamp |
| checked_out_at | Nullable timestamp |
| assigned_at | Timestamp |
| created_at | Timestamp |
| updated_at | Timestamp |

Constraints and rules:
- `departure_date` must be after `arrival_date`.
- Arrival is inclusive; departure is exclusive.
- `room_id` is required because assignment occurs at booking.
- `room_category_id` should match the assigned room's category.
- Prevent overlapping active allocations for the same physical room.
- The overlap check must be enforced safely on the backend/database, not just in the UI.
- A room allocation's dates and booked rate are independent of other allocations in the same reservation.

### 3.13 invoices

| Column | Type / notes |
|---|---|
| id | Primary key |
| reservation_id | FK to reservations.id |
| invoice_number | Required, unique |
| subtotal | Required Decimal |
| discount_total | Required Decimal, default 0 |
| tax_total | Required Decimal, default 0 |
| grand_total | Required Decimal |
| status | `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `VOID` |
| issued_at | Nullable timestamp |
| created_at | Timestamp |
| updated_at | Timestamp |

For V1, use one invoice per reservation unless the business requires separate invoices per room or guest.

### 3.14 invoice_items

| Column | Type / notes |
|---|---|
| id | Primary key |
| invoice_id | FK to invoices.id |
| reservation_room_id | Nullable FK to reservation_rooms.id for room-related charges |
| description | Required |
| quantity | Decimal or integer |
| unit_price | Required Decimal |
| line_total | Required Decimal |
| item_type | Room charge / extra charge / discount / tax |
| created_at | Timestamp |

Store the billed amounts on invoice items so later changes to room prices do not alter issued invoices.

### 3.15 payments

| Column | Type / notes |
|---|---|
| id | Primary key |
| invoice_id | FK to invoices.id |
| amount | Required positive Decimal |
| payment_method | Cash / card / UPI / bank transfer, as supported |
| reference_number | Optional |
| status | `RECORDED`, `VOIDED` or equivalent |
| paid_at | Required timestamp |
| created_by | FK to users.id |
| created_at | Timestamp |

Allow multiple payment records against one invoice. Derive outstanding balance from invoice total minus valid payments, accounting for refunds/voids according to the finalized policy.

### 3.16 audit_logs

| Column | Type / notes |
|---|---|
| id | Primary key |
| user_id | Nullable FK to users.id if system actions are possible |
| entity_type | Required |
| entity_id | Required identifier |
| action | Required |
| old_data | Nullable JSON |
| new_data | Nullable JSON |
| created_at | Timestamp |

Record important actions: reservation creation/modification/cancellation, room assignment, check-in/out, invoice changes, payments, and refunds.

## 4. Status Rules

### Reservation
- `CONFIRMED`
- `CANCELLED`
- `COMPLETED`

Track check-in and check-out independently on `reservation_rooms`. Reservation status should be updated consistently based on its allocations; avoid adding extra reservation statuses unless the UI needs them.

### Room physical status
- `VACANT_CLEAN`
- `VACANT_DIRTY`
- `OCCUPIED`
- `MAINTENANCE`
- `OUT_OF_SERVICE`

Room status represents physical condition/occupancy, not whether the room has a future reservation. Booking availability is calculated for the requested dates.

## 5. Indexes and Integrity

At minimum:
- Unique index on `users.email`.
- Unique index on `reservations.reservation_no`.
- Unique index on `invoices.invoice_number`.
- Unique room number index for the selected scope.
- Index foreign keys and common search fields such as customer phone, reservation status, allocation dates, room ID, invoice status and payment invoice ID.
- Use foreign keys and appropriate delete rules. Avoid cascading deletion of financial records.
- Use Decimal for currency.
- Use transactions for creating a multi-room reservation and its allocations, and for recording payments and updating invoice state.
- Consider a PostgreSQL exclusion constraint on the room ID and date range for active allocations if implemented cleanly with the chosen schema; otherwise use a transaction/locking approach that reliably prevents concurrent overlapping bookings.

## 6. Important Business Rules

1. All reservations are entered by reception staff.
2. Every reservation contains one or more room allocations.
3. Each allocation has one physical room assigned at booking.
4. Different allocations may have different stay dates.
5. The booked nightly rate is snapshotted per allocation.
6. Partial and full payments are supported.
7. Check-in and check-out can occur per room allocation.
8. Checkout changes the physical room to `VACANT_DIRTY`.
9. A room is available only if its physical status permits it and there is no overlapping active allocation.
10. Multi-tenancy is out of scope for V1.

## 7. Remaining Decisions

Settle these before implementing the relevant module:
- Are room rates fixed for the entire stay, or can the price differ by night?
- What are the cancellation and refund rules?
- Which taxes and extra charge types are required?
- Is customer ID proof mandatory at booking or check-in?
- Does the installation need multiple properties in V1?
- Can reservations be edited after one of their room allocations has checked in?

