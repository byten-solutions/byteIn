# Prisma Database Guidelines

This directory contains the database schema and migration definitions for **byteInn**.

---

## 1. Directory Structure

```text
prisma/
├── schema.prisma          # Authoritative Prisma schema definition
├── migrations/            # Version-controlled SQL migration history (created on first migration)
└── README.md              # Database rules & migration guide
```

The singleton Prisma Client instance for the application is located in `src/lib/prisma.ts`.

---

## 2. Source of Truth

- **`prisma/schema.prisma`** is the data architecture source of truth for the codebase, governed by [docs/byteInn_Database_Design_v1.md](file:///Users/apple/Byten/byteInn/docs/byteInn_Database_Design_v1.md).
- Before creating or modifying database entities, fields, enums, or relationships, always inspect `prisma/schema.prisma` and cross-reference with the database design document.
- Never guess model definitions, field names, or foreign key relationships.

---

## 3. Migration Workflow

All schema modifications must follow the official Prisma migration workflow:

```bash
# 1. Validate schema syntax
npx prisma validate

# 2. Create and apply a new migration locally
npx prisma migrate dev --name <descriptive_migration_name>

# 3. Regenerate Prisma Client (automatically run by migrate dev, or manually)
npx prisma generate

# 4. Check migration status
npx prisma migrate status
```

### ⛔ Strict Ban on `db push`
- **Never run `npx prisma db push`**.
- `db push` bypasses version-controlled migration files, makes schema history untraceable, and risks catastrophic data loss in production/staging environments.
- Always use `prisma migrate dev` for local schema changes and `prisma migrate deploy` for deployments.

---

## 4. Monetary Value & Numeric Handling

- All monetary and financial figures must be typed as **PostgreSQL `numeric` / Prisma `Decimal`**:
  - `room_categories.base_price`
  - `rooms.price_override`
  - `reservation_rooms.booked_nightly_rate`
  - `invoices.subtotal`, `discount_total`, `tax_total`, `grand_total`
  - `invoice_items.unit_price`, `line_total`
  - `payments.amount`
- **Never use JavaScript `Number` or floating-point types** for financial calculations to prevent precision and rounding errors.
- Always calculate balances and totals using the Prisma `Decimal` object methods or server-side decimal utilities.

---

## 5. Referential Integrity & Indexing Rules

- **Foreign Keys**: Every foreign key must be indexed for query performance (e.g., `customer_id`, `room_id`, `reservation_id`, `invoice_id`).
- **Unique Constraints**:
  - `users.email` (unique)
  - `reservations.reservation_no` (unique)
  - `invoices.invoice_number` (unique)
  - Room numbers must be unique within their physical scope (e.g., `(building_id, room_no)`).
- **Deletion Safety**: Do NOT use cascading delete (`onDelete: Cascade`) on financial or transactional records (`invoices`, `payments`, `audit_logs`, `reservations`). Soft deletion or restricted deletion must preserve audit trails.

---

## 6. Concurrency & Reservation Overlap Safeguards

- **Date Semantics**: `arrival_date` is inclusive; `departure_date` is exclusive. A checkout on October 18 frees the room for another guest arriving on October 18.
- **Physical Room Assignment**: Because physical rooms are assigned at booking time, overlapping active allocations for the same physical room are strictly forbidden.
- **Database-Level Enforcement**: Availability must never rely solely on client-side validation. All reservation room bookings must be verified and written inside a safe database transaction with appropriate concurrency locking or PostgreSQL exclusion constraints.

---

## 7. Supported Validation Commands

```bash
# Validate schema structure and relationships
npx prisma validate

# Generate the TypeScript Prisma Client
npx prisma generate

# Check migration history status against the active database
npx prisma migrate status
```
