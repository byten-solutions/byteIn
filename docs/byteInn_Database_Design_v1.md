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
                          └── Receipt (Inward Money)

Property ── FinancialAccount ── AccountTransfer (From/To)
                 │
                 ├── PaymentMethod
                 ├── Receipt (Inward Money)
                 └── Payment (Outward Disbursements)

IncomeHead ── Income ── Receipt
ExpenseHead ── Expense ── Payment

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
| status | Allocation status: `CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`, `CANCELLED`, `NO_SHOW` |
| checked_in_at | Nullable timestamp |
| checked_out_at | Nullable timestamp |
| actual_checkout_date | Nullable date recorded at checkout (`effective_checkout_date = actual_checkout_date ?? departure_date`) |
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

### 3.15 receipts (Inward Money / Collections)

| Column | Type / notes |
|---|---|
| id | Primary key |
| property_id | FK to properties.id |
| invoice_id | Nullable FK to invoices (mutually exclusive with income_id) (`onDelete: Restrict`) |
| income_id | Nullable FK to incomes (mutually exclusive with invoice_id) (`onDelete: Restrict`) |
| account_id | FK to financial_accounts.id (`onDelete: Restrict`) |
| payment_method_id | Nullable FK to payment_methods.id (`onDelete: Restrict`) |
| payment_method_code | Required code string (`CASH`, `CARD`, `UPI`, `BANK_TRANSFER`) |
| amount | Required positive Decimal(10, 2) (`chk_receipts_positive_amount`) |
| reference_number | Optional string |
| idempotency_key | Optional unique string (`@unique @map("idempotency_key")`) preventing duplicate receipts |
| status | `RECORDED` or `VOIDED` (`ReceiptStatus`) |
| paid_at | Required timestamp |
| is_legacy | Boolean flag indicating migration from earlier payment records |
| created_by | FK to users.id |
| void_reason | Optional string explaining voiding |
| voided_at | Nullable timestamp |
| voided_by | Nullable FK to users.id |
| created_at | Timestamp |

Unified inward money records. Enforces check constraint `chk_receipts_target_exclusive` ensuring exactly one of `invoice_id` or `income_id` is set.

### 3.16 financial_accounts

| Column | Type / notes |
|---|---|
| id | Primary key |
| property_id | FK to properties.id |
| account_name | Required string, unique per property (`@@unique([propertyId, accountName])`) |
| account_type | `BANK`, `CASH`, or `WALLET` (`AccountType`) |
| opening_balance | Required Decimal(10, 2), default 0.00 |
| opening_balance_date | Required date (`@db.Date`), baseline anchor for liquid calculations |
| is_default | Boolean flag (one default per property) |
| is_active | Boolean lifecycle flag |
| created_at | Timestamp |
| updated_at | Timestamp |

Liquid accounts for cash drawers, operating banks, and digital wallets. byteInn uses account-based cash management with internal account transfers, not a general ledger.

### 3.17 account_transfers

| Column | Type / notes |
|---|---|
| id | Primary key |
| property_id | FK to properties.id |
| from_account_id | FK to financial_accounts.id (`onDelete: Restrict`) |
| to_account_id | FK to financial_accounts.id (`onDelete: Restrict`) |
| amount | Required positive Decimal(10, 2) (`chk_transfers_positive_amount`) |
| transfer_date | Required date (`@db.Date`) |
| description | Optional string |
| reference_number | Optional string |
| status | `COMPLETED` or `REVERSED` (`TransferStatus`) |
| created_by | FK to users.id |
| created_at | Timestamp |
| updated_at | Timestamp |

Internal fund transfers between accounts. Enforces check constraint `chk_transfers_accounts_different` (`from_account_id <> to_account_id`).

### 3.18 payment_methods

| Column | Type / notes |
|---|---|
| id | Primary key |
| property_id | FK to properties.id |
| name | Required string |
| code | Required string, unique per property (`@@unique([propertyId, code])`) |
| default_account_id | Nullable FK to financial_accounts.id (`onDelete: Restrict`) |
| is_active | Boolean lifecycle flag |
| created_at | Timestamp |
| updated_at | Timestamp |

### 3.19 income_heads

| Column | Type / notes |
|---|---|
| id | Primary key |
| property_id | FK to properties.id |
| name | Required string |
| code | Required string, unique per property (`@@unique([propertyId, code])`) |
| description | Optional string |
| is_active | Boolean lifecycle flag |
| created_at | Timestamp |
| updated_at | Timestamp |

Direct revenue categories. Seedable default codes: `COMMISSION`, `SCRAP_ASSET_SALE`, `FOREX_COMMISSION`, `INTEREST`, and `OTHER_DIRECT_INCOME`. Hall, laundry, and restaurant revenue remain service-invoice revenue under billing.

### 3.20 incomes

| Column | Type / notes |
|---|---|
| id | Primary key |
| property_id | FK to properties.id |
| income_head_id | FK to income_heads.id (`onDelete: Restrict`) |
| title | Required string |
| description | Optional string |
| expected_amount | Required positive Decimal(10, 2) |
| income_date | Required date (`@db.Date`) |
| status | `PENDING`, `PARTIALLY_RECEIVED`, `RECEIVED`, or `VOIDED` (`IncomeStatus`) |
| created_by | FK to users.id |
| void_reason | Optional string |
| voided_at | Nullable timestamp |
| voided_by | Nullable FK to users.id |
| created_at | Timestamp |
| updated_at | Timestamp |

Direct non-reservation hotel revenue items.

### 3.21 expense_heads

| Column | Type / notes |
|---|---|
| id | Primary key |
| property_id | FK to properties.id |
| name | Required string |
| code | Required string, unique per property (`@@unique([propertyId, code])`) |
| description | Optional string |
| is_active | Boolean lifecycle flag |
| created_at | Timestamp |
| updated_at | Timestamp |

Operational expense categories. Six approved defaults: `UTILITIES`, `MAINTENANCE`, `SUPPLIES`, `FOOD_BEVERAGE`, `STAFF_WELFARE`, and `MISC_EXPENSE`.

### 3.22 expenses

| Column | Type / notes |
|---|---|
| id | Primary key |
| property_id | FK to properties.id |
| expense_head_id | FK to expense_heads.id (`onDelete: Restrict`) |
| title | Required string |
| description | Optional string |
| amount | Required positive Decimal(10, 2) |
| vendor_name | Optional string |
| reference_number | Optional string |
| expense_date | Required date (`@db.Date`) |
| status | `PENDING`, `PARTIALLY_PAID`, `PAID`, or `VOIDED` (`ExpenseStatus`) |
| created_by | FK to users.id |
| void_reason | Optional string |
| voided_at | Nullable timestamp |
| voided_by | Nullable FK to users.id |
| created_at | Timestamp |
| updated_at | Timestamp |

Operational hotel expense records.

### 3.23 payments (Outward Money / Disbursements)

| Column | Type / notes |
|---|---|
| id | Primary key |
| property_id | FK to properties.id |
| expense_id | FK to expenses.id (`onDelete: Restrict`) |
| account_id | FK to financial_accounts.id (`onDelete: Restrict`) |
| payment_method_id | Nullable FK to payment_methods.id (`onDelete: Restrict`) |
| payment_method_code | Required code string (`CASH`, `CARD`, `UPI`, `BANK_TRANSFER`) |
| amount | Required positive Decimal(10, 2) (`chk_payments_positive_amount`) |
| reference_number | Optional string |
| idempotency_key | Optional string, unique per property (`@@unique([propertyId, idempotencyKey])`) |
| status | `RECORDED` or `VOIDED` (`PaymentStatus`) |
| paid_at | Required timestamp |
| created_by | FK to users.id |
| void_reason | Optional string |
| voided_at | Nullable timestamp |
| voided_by | Nullable FK to users.id |
| created_at | Timestamp |
| updated_at | Timestamp |

Outgoing disbursement records for operational expenses.

### 3.24 audit_logs

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

Record important actions: reservation creation/modification/cancellation, room assignment, check-in/out, invoice changes, receipts, expenses, outgoing payments, account transfers, and category changes.

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

### Financial Status Lifecycles

#### Incomes (`IncomeStatus`)
- `PENDING`: Income recorded, zero receipts collected against expected amount.
- `PARTIALLY_RECEIVED`: Sum of recorded receipts is greater than zero but less than expected amount.
- `RECEIVED`: Sum of recorded receipts is greater than or equal to expected amount.
- `VOIDED`: Direct income cancelled (only permitted when zero active receipts exist).

#### Expenses (`ExpenseStatus`)
- `PENDING`: Expense approved, zero disbursements paid against expense amount.
- `PARTIALLY_PAID`: Sum of recorded payments is greater than zero but less than expense amount.
- `PAID`: Sum of recorded payments is greater than or equal to expense amount.
- `VOIDED`: Expense cancelled (only permitted when zero active payments exist).

#### Receipts & Payments (`ReceiptStatus` / `PaymentStatus`)
- `RECORDED`: Valid transaction active on account, counted in financial account balances.
- `VOIDED`: Transaction voided with mandatory `void_reason`, excluded from account balances.

#### Account Transfers (`TransferStatus`)
- `COMPLETED`: Fund transfer executed atomically between source and destination accounts.
- `REVERSED`: Transfer reversed with balance restoration.

## 5. Indexes and Integrity

At minimum:
- Unique index on `users.email`.
- Unique index on `reservations.reservation_no`.
- Unique index on `invoices.invoice_number`.
- Unique room number index for the selected scope (`building_id`, `room_no`).
- Unique composite index on `financial_accounts(property_id, account_name)`.
- Unique composite index on `payment_methods(property_id, code)`.
- Unique composite index on `income_heads(property_id, code)`.
- Unique composite index on `expense_heads(property_id, code)`.
- Unique index on `receipts(idempotency_key)`.
- Unique composite index on `payments(property_id, idempotency_key)`.
- Composite primary keys / unique constraints `(property_id, id)` on all property-scoped tables to support composite foreign key isolation.
- Index foreign keys and common search fields: `customer_id`, `room_id`, `reservation_id`, `invoice_id`, `account_id`, `payment_method_id`, `expense_id`, `income_id`, `paid_at`, `status`.
- Database check constraints:
  - `chk_receipts_target_exclusive`: exactly one of `invoice_id` or `income_id` is set.
  - `chk_transfers_accounts_different`: `from_account_id <> to_account_id`.
  - `chk_receipts_positive_amount`, `chk_payments_positive_amount`, `chk_transfers_positive_amount`: amounts must be `> 0`.
- Referential integrity strictly prevents cascading deletions (`onDelete: Restrict`) across `receipts`, `payments`, `account_transfers`, `expenses`, `incomes`, `financial_accounts`, `invoices`, and `reservations`.
- Use Decimal(10, 2) for all currency and financial figures.
- Use PostgreSQL transactions (`SELECT ... FOR UPDATE`) for multi-step operations (booking, payment recording, balance reduction, account transfers, voiding).
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

