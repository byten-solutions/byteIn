# Multi-Hotel Scoping Defects Fix & Direct Property Scoping Report

## 1. Executive Summary

This phase resolved multi-hotel scoping defects and introduced first-class database-level scoping by storing `property_id` directly on `reservations`, `invoices`, and `payments` tables (along with `registered_property_id` on `customers`).

Previously, multi-hotel isolation and tenant filtering relied on expensive relational joins through `reservation_rooms` and `rooms` (`WHERE EXISTS (SELECT 1 FROM reservation_rooms rr JOIN rooms rm ON rm.id = rr.room_id WHERE rm.property_id = ...)`). Under a 1.87M-record database, this caused significant query latency, full table scans, buffer pressure, and memory bloat.

By denormalizing and indexing `property_id` directly, introducing a strict PostgreSQL validation trigger `enforce_reservation_room_property()`, making authorization scoping fail-closed via `resolveScope()`, and applying property-scoped in-memory caching (`scopedCached`), query latencies dropped by up to **850x** while ensuring strict adversarial multi-hotel tenant isolation.

---

## 2. Step 0: Pre-Flight Validation (on `byteinn_perf`)

Executed on PostgreSQL database `byteinn_perf` prior to applying migrations:

```sql
SELECT 'reservations with no rooms' AS check, count(*) FROM reservations r
  WHERE NOT EXISTS (SELECT 1 FROM reservation_rooms rr WHERE rr.reservation_id = r.id);
-- Result: 0

SELECT 'mixed-property reservations' AS check, count(*) FROM (
  SELECT rr.reservation_id FROM reservation_rooms rr JOIN rooms rm ON rm.id = rr.room_id
  GROUP BY rr.reservation_id HAVING count(DISTINCT rm.property_id) > 1) m;
-- Result: 0

SELECT 'hotel-level users without property' AS check, count(*) FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE r.name IN ('ADMIN', 'RECEPTIONIST') AND u.property_id IS NULL;
-- Result: 0

SELECT 'customers without reservations' AS check, count(*) FROM customers c
  WHERE NOT EXISTS (SELECT 1 FROM reservations r WHERE r.customer_id = c.id);
-- Result: 0
```

All 4 invariant assertions returned `0`, confirming the data was clean and safe for backfill and schema migration.

---

## 3. Database Migration & Integrity Enforcement

**Migration**: `20261018190000_add_property_scope`

### 3.1 Schema & Columns Added
- `reservations.property_id` (`text NOT NULL REFERENCES properties(id) ON DELETE RESTRICT`)
- `invoices.property_id` (`text NOT NULL REFERENCES properties(id) ON DELETE RESTRICT`)
- `payments.property_id` (`text NOT NULL REFERENCES properties(id) ON DELETE RESTRICT`)
- `customers.registered_property_id` (`text NULL REFERENCES properties(id) ON DELETE SET NULL`)

### 3.2 Performance Indexes Created
- `reservations_property_id_created_at_idx` ON `reservations(property_id, created_at DESC)`
- `reservations_property_id_status_idx` ON `reservations(property_id, status)`
- `reservations_property_id_customer_id_idx` ON `reservations(property_id, customer_id)`
- `invoices_property_id_created_at_idx` ON `invoices(property_id, created_at DESC)`
- `invoices_property_id_status_idx` ON `invoices(property_id, status)`
- `payments_property_id_paid_at_idx` ON `payments(property_id, paid_at DESC)`
- `customers_registered_property_id_idx` ON `customers(registered_property_id)`

### 3.3 Database Trigger: `enforce_reservation_room_property()`
Enforced at the database transaction boundary: whenever a row is inserted or updated in `reservation_rooms`, the trigger queries the room's `property_id` and the parent reservation's `property_id`. If they differ, the transaction is aborted immediately with a `P0001` exception.

```sql
CREATE OR REPLACE FUNCTION enforce_reservation_room_property()
RETURNS TRIGGER AS $$
DECLARE
  v_res_prop text;
  v_room_prop text;
BEGIN
  SELECT property_id INTO v_res_prop FROM reservations WHERE id = NEW.reservation_id;
  SELECT property_id INTO v_room_prop FROM rooms WHERE id = NEW.room_id;
  IF v_res_prop IS NOT NULL AND v_room_prop IS NOT NULL AND v_res_prop != v_room_prop THEN
    RAISE EXCEPTION 'room % belongs to a different property than reservation %', NEW.room_id, NEW.reservation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_rooms_property_match
BEFORE INSERT OR UPDATE OF room_id, reservation_id ON reservation_rooms
FOR EACH ROW EXECUTE FUNCTION enforce_reservation_room_property();
```

---

## 4. Query Execution Plans: Before vs After (EXPLAIN ANALYZE BUFFERS)

Evaluated on `byteinn_perf` (1.87M records, Property: `cprop366914525589ad143103`, 35,145 reservations, 35,145 invoices, 33,126 payments).

### 4.1 Invoices List Query (`WHERE property_id = ... ORDER BY created_at DESC LIMIT 20`)

#### Before (Cross-Table Join Scan):
```
Limit  (cost=1.13..216.73 rows=20 width=85) (actual time=0.408..145.227 rows=20 loops=1)
  Buffers: shared hit=979 read=423
  ->  Nested Loop Semi Join  (cost=1.13..379127.60 rows=35169 width=85) (actual time=0.407..145.213 rows=20 loops=1)
        Buffers: shared hit=979 read=423
        ->  Index Scan using invoices_created_at_idx on invoices i  (cost=0.42..65831.42 rows=351692 width=85)
        ->  Nested Loop  (cost=0.71..0.88 rows=1 width=25)
              ->  Index Scan using reservation_rooms_reservation_id_idx on reservation_rooms rr
              ->  Index Scan using rooms_pkey on rooms rm
Execution Time: 145.31 ms
```

#### After (Direct Scoped Index Scan `invoices_property_id_created_at_idx`):
```
Limit  (cost=0.42..33.11 rows=20 width=85) (actual time=0.049..0.119 rows=20 loops=1)
  Buffers: shared hit=23
  ->  Index Scan using invoices_property_id_created_at_idx on invoices  (cost=0.42..57320.63 rows=35075 width=85) (actual time=0.048..0.116 rows=20 loops=1)
        Index Cond: (property_id = 'cprop366914525589ad143103'::text)
        Buffers: shared hit=23
Execution Time: 0.17 ms (~850x faster)
```

---

### 4.2 Reservations List Query (`WHERE property_id = ... ORDER BY created_at DESC LIMIT 20`)

#### Before (Cross-Table Join Scan):
```
Limit  (cost=1.13..223.12 rows=20 width=79) (actual time=0.627..52.137 rows=20 loops=1)
  Buffers: shared hit=1261 read=140
  ->  Nested Loop Semi Join  (cost=1.13..390363.93 rows=35169 width=79) (actual time=0.627..52.126 rows=20 loops=1)
        Buffers: shared hit=1261 read=140
        ->  Index Scan using reservations_created_at_idx on reservations r  (cost=0.42..77067.75 rows=351692 width=79)
        ->  Nested Loop
Execution Time: 52.17 ms
```

#### After (Direct Scoped Index Scan `reservations_property_id_created_at_idx`):
```
Limit  (cost=0.42..40.12 rows=20 width=105) (actual time=0.038..0.113 rows=20 loops=1)
  Buffers: shared hit=23
  ->  Index Scan using reservations_property_id_created_at_idx on reservations  (cost=0.42..68512.74 rows=34513 width=105) (actual time=0.037..0.110 rows=20 loops=1)
        Index Cond: (property_id = 'cprop366914525589ad143103'::text)
        Buffers: shared hit=23
Execution Time: 0.14 ms (~370x faster)
```

---

### 4.3 Billing Summary Aggregation (Single SQL Query)
Aggregates grand total invoiced and total payments recorded directly by `property_id`:
```
Result  (cost=31611.31..31611.33 rows=1 width=64) (actual time=96.770..96.774 rows=1 loops=1)
  InitPlan 1: Bitmap Index Scan on invoices_property_id_created_at_idx (34,195 rows) -> 29.7 ms
  InitPlan 2: Bitmap Index Scan on payments_property_id_paid_at_idx (33,126 rows) -> 66.9 ms
Execution Time: 96.99 ms (Uncached) / <0.05 ms (Cached via scopedCached)
```

---

### 4.4 Customer List Scoped Query
```
Limit  (cost=0.29..99.97 rows=20 width=99) (actual time=35.929..35.976 rows=20 loops=1)
  Buffers: shared hit=2 read=163
  ->  Index Scan using customers_created_at_idx on customers c
        Filter: ((registered_property_id = 'cprop366914525589ad143103'::text) OR (hashed SubPlan 2))
        SubPlan 2: Index Only Scan using reservations_property_id_customer_id_idx on reservations r
          Heap Fetches: 0
Execution Time: 36.02 ms
```

---

## 5. Security & Isolation Testing

Ran the complete test suite against test database (`byteinn_test`):
- **Test suites**: 90
- **Total tests**: 280
- **Passed**: 280 (100%)
- **Failed**: 0

### Adversarial Scenarios Verified:
1. **Cross-hotel reservation mutation rejected**: Hotel A receptionist attempting to cancel Hotel B reservation or check in Hotel B room allocation throws `NotFoundError`.
2. **Cross-hotel invoice mutation rejected**: Hotel A user recording payment or generating invoice for Hotel B reservation is rejected with `NotFoundError` / `ForbiddenError`.
3. **Cross-hotel room allocation trigger**: Direct SQL injection or invalid service allocation attempting to insert a room from Property B into a reservation for Property A is rejected by `enforce_reservation_room_property()`.
4. **Cross-hotel customer isolation and crossover**: A customer registered at Hotel B is invisible to Hotel A staff until that customer makes a reservation at Hotel A, at which point Hotel A staff can view the customer and their stay details.
5. **Invariant drift queries**:
   - `SELECT count(*) FROM reservations r JOIN reservation_rooms rr ON rr.reservation_id = r.id JOIN rooms rm ON rm.id = rr.room_id WHERE rm.property_id != r.property_id` -> 0
   - `SELECT count(*) FROM invoices i JOIN reservations r ON i.reservation_id = r.id WHERE i.property_id != r.property_id` -> 0
   - `SELECT count(*) FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE p.property_id != i.property_id` -> 0
6. **Scoped cache isolation**: Cache invalidations triggered in Hotel A never affect or invalidate Hotel B cached metrics.

---

## 6. Production Benchmark Results

Measured against Next.js 16.4 production server (`npm run build && next start -p 3005`) connected to `byteinn_perf` (3 runs per route, authenticated as property administrator):

| Route | Cold TTFB (ms) | Cold Total (ms) | Warm Median TTFB (ms) | Warm Median Total (ms) | Worst Total (ms) | Payload Bytes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`/` (Dashboard)** | 163.2 | 164.1 | 19.4 | 19.5 | 164.1 | 62.6 KB |
| **`/billing`** | 9.1 | 136.4 | 6.4 | 29.1 | 136.4 | 191.9 KB |
| **`/reservations`** | 7.9 | 50.3 | 7.9 | 21.1 | 50.3 | 169.7 KB |
| **`/customers`** | 8.4 | 130.3 | 7.1 | 44.6 | 130.3 | 197.5 KB |
| **`/reports`** | 6.9 | 14.5 | 5.0 | 6.2 | 14.5 | 49.1 KB |

All warm routes respond in **< 45ms** under heavy production data volume.

---

## 7. Commits Made on Branch `perf/after-rbac`

1. `d04d926` - `fix(auth): make resolveScope fail-closed and enforce property isolation across all routes`
2. `f113e3c` - `feat(schema): store property_id on reservations, invoices, payments with composite indexes and trigger`
3. `0ca6769` - `feat(perf): rewrite read paths, scoped caches, and dashboard for direct property scoping`
4. `53d36c3` - `test(perf): add adversarial multi-hotel isolation and invariant test suite`

---

## 8. Safe Application to Production / Main DB (`byteinn`)

To apply these verified changes to the main `byteinn` database:
1. Verify pre-flight invariants on `byteinn`:
   ```bash
   npx prisma migrate deploy
   ```
2. Run database vacuum analyze:
   ```sql
   VACUUM ANALYZE reservations;
   VACUUM ANALYZE invoices;
   VACUUM ANALYZE payments;
   VACUUM ANALYZE customers;
   ```
