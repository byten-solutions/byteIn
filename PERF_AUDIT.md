# byteInn Performance Audit Report

**Date of Audit**: October 18, 2026  
**Auditor**: Lead System & Performance Architect  
**Audit Scope**: Read-only performance evaluation of ByteInn under real-world scale (1.87M records).  
**Application Code Modified**: None (Strict Read-Only Enforcement).  

---

## Executive Summary

1. **Root Bottleneck — `/rooms` Hydration Collapse**: Loading `/rooms` transfers **42.2 MB raw HTML (917 KB gzip)** and creates **311,712 DOM nodes**, locking the client browser main thread for **4,564 ms** during React hydration.
2. **Missing Server-Side Room Pagination**: `RoomService.getRooms()` ([src/modules/rooms/room.service.ts#L271-L301](file:///Users/apple/Byten/byteInn/src/modules/rooms/room.service.ts#L271-L301)) executes `findMany` with no `take` and four nested joins across all 10,500 rooms.
3. **Monolithic Reports Fetching**: `/reports` ([src/app/reports/page.tsx#L28-L53](file:///Users/apple/Byten/byteInn/src/app/reports/page.tsx#L28-L53)) triggers 7 intensive reports concurrently on initial page load, executing 20 SQL queries, generating **38.8 MB raw payload**, and incurring a **5,277 ms TTFB**.
4. **Unindexed Sorting on Massive Tables**: `reservations` and `invoices` lack a B-Tree index on `created_at`; all `ORDER BY created_at DESC` queries trigger 351,692-row parallel sequential scans and top-N heapsorts.
5. **Table-Wide Billing Aggregations**: `/billing` ([src/modules/billing/billing.service.ts#L443-L454](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L443-L454)) recomputes `SUM(grand_total)` and `SUM(payments)` across 351k invoices and 331k payments on every request, spilling 3.5 MB into PostgreSQL temporary disk files.
6. **Overview Homepage Reservation Count**: `/` ([src/app/page.tsx#L65](file:///Users/apple/Byten/byteInn/src/app/page.tsx#L65)) executes `prisma.reservation.count()` over 351k rows on every page view, adding 687 ms of server latency.
7. **Zero Caching Layer**: No caching exists anywhere in the application (no `unstable_cache`, no HTTP cache headers, no Redis, no SWR/React Query). Every request executes raw database queries.
8. **Auth Per-Request Query Overhead**: `getSession()` ([src/lib/auth-guard.ts#L39-L42](file:///Users/apple/Byten/byteInn/src/lib/auth-guard.ts#L39-L42)) queries `users` and joins `roles` on every single authenticated page and API request.
9. **Unindexed Foreign Keys**: `rooms.floor_id` and `room_category_amenities.amenity_id` are foreign keys completely lacking database indexes.
10. **Projected Impact of Recommended Fixes**: Implementing server pagination/virtualization for rooms, lazy-loading report tabs, indexing `created_at`, and caching summary aggregates will reduce `/rooms` total load from **7.9 s to < 0.3 s**, `/reports` from **10.5 s to < 0.4 s**, and database query load by **> 90%**.

---

## 1. Stack and Architecture Snapshot

### 1.1 Runtime & Environment Versions
All measurements were captured on a production build (`NODE_ENV=production next build && next start` on port 3005) against a live PostgreSQL 15 database containing 1,870,000+ seeded records.
- **Node.js**: `v25.6.1`
- **Next.js**: `16.4.0` (App Router, Turbopack, `output: "standalone"`)
- **React**: `19.3.0`
- **Prisma Client**: `6.19.3`
- **PostgreSQL**: `15.15` (Homebrew, aarch64-apple-darwin25.2.0)
- **Host Machine**: macOS 15.2 (Darwin 25.2.0 arm64, Apple Silicon 8 cores, 16 GB RAM, PCIe SSD)

### 1.2 Component Architecture & Boundaries
- **Routing**: Next.js App Router exclusively (`src/app/`). All page routes are dynamically rendered (`ƒ Dynamic`) due to per-request cookie session authentication.
- **Server vs. Client Components**:
  - `src/app/page.tsx`: Server Component (`AppShell` client wrapper, stats rendered statically).
  - `src/app/rooms/page.tsx`: Server Component wrapper fetching data and passing 10,500 room records to `RoomManager` (`"use client"`).
  - `src/app/reservations/page.tsx`: Server Component wrapper fetching 20 records and passing to `ReservationList` (`"use client"`).
  - `src/app/billing/page.tsx`: Server Component wrapper fetching 25 records and passing to `InvoiceList` (`"use client"`).
  - `src/app/customers/page.tsx`: Server Component wrapper fetching 20 records and passing to `CustomerList` (`"use client"`).
  - `src/app/reports/page.tsx`: Server Component wrapper fetching 7 full reports and passing to `ReportsView` (`"use client"`).
  - Detail pages (`/reservations/[id]`, `/billing/[id]`, `/customers/[id]`): Server Component layouts delegating interaction to client action bars.
- **Data Fetching Paradigm**:
  - Initial page loads execute direct TypeScript domain service calls on the server (e.g. `RoomService.getRooms()`, `BillingService.getInvoices()`).
  - Interactive actions (pagination, filtering, tab switching, mutations) in Client Components use standard browser `fetch()` to `/api/*` endpoints with manual `useState` and `useEffect`.
  - No client-side caching libraries are present (neither SWR nor TanStack React Query).

### 1.3 Prisma Setup & Configuration
- **Singleton Pattern**: Managed via `src/lib/prisma.ts` ([lines 27-41](file:///Users/apple/Byten/byteInn/src/lib/prisma.ts#L27-L41)). In development, `globalForPrisma.prisma` prevents connection exhaustion on HMR. In production, a single `PrismaClient` is instantiated per Node process worker.
- **Connection Pooling**: Default Prisma connection pool (`num_physical_cpus * 2 + 1 = 17` connections). No custom pool size or connection timeouts are set in `DATABASE_URL`.
- **Logging**: Configured to `["error"]` in production, `["query", "error", "warn"]` in development.
- **Extensions / Middleware**: None. No `prisma.$extends` or `prisma.$use` hooks are active.

### 1.4 Caching Analysis
- **Next.js Fetch Cache**: Not utilized. Page components call domain services directly via module imports rather than invoking `fetch()`.
- **`unstable_cache` / React `cache`**: **0 instances** found across the codebase.
- **Route Segment `revalidate`**: **None**. All routes default to dynamic on-demand rendering.
- **In-Memory / Distributed Cache (Redis)**: **None**.
- **HTTP Cache Headers**: Route Handlers emit dynamic `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. Every navigation, filter change, or refresh hits the database.

---

## 2. Per-Page Breakdown

Each page was evaluated under production conditions with three consecutive runs; reported values represent the exact median of the three runs.

```
+--------------------------------------------------------------------------------------------------------------------+
| Page                | TTFB (ms) | FCP (ms) | LCP (ms) | Total (ms) | Payload Raw | Payload Gzip | DOM Nodes | Long Tasks|
+--------------------------------------------------------------------------------------------------------------------+
| / (Overview)        | 71 ms     | 152 ms   | 152 ms   | 684 ms     | 51.8 KB     | 9.6 KB       | 266       | 0         |
| /rooms              | 2,362 ms  | 2,572 ms | 2,572 ms | 7,930 ms   | 42,181.5 KB | 917.1 KB     | 311,712   | 3 (4.56s) |
| /reports            | 8,477 ms  | 8,784 ms | 8,784 ms | 10,465 ms  | 38,771.3 KB | 3,879.4 KB   | 33,501    | 2 (746ms) |
| /billing            | 827 ms    | 920 ms   | 920 ms   | 1,448 ms   | 154.9 KB    | 16.1 KB      | 1,172     | 0         |
| /reservations       | 123 ms    | 196 ms   | 196 ms   | 723 ms     | 138.0 KB    | 14.1 KB      | 1,105     | 0         |
| /customers          | 445 ms    | 536 ms   | 536 ms   | 1,039 ms   | 172.1 KB    | 16.4 KB      | 1,272     | 0         |
| /categories         | 32 ms     | 112 ms   | 112 ms   | 628 ms     | 485.2 KB    | 16.5 KB      | 2,377     | 0         |
| /reservations/new   | 14 ms     | 68 ms    | 68 ms    | 582 ms     | 52.9 KB     | 10.4 KB      | 394       | 0         |
| /reservations/[id]  | 14 ms     | 72 ms    | 72 ms    | 594 ms     | 50.8 KB     | 11.2 KB      | 374       | 0         |
| /billing/[id]       | 15 ms     | 64 ms    | 64 ms    | 588 ms     | 44.4 KB     | 9.1 KB       | 273       | 0         |
| /customers/[id]     | 9 ms      | 92 ms    | 92 ms    | 612 ms     | 63.0 KB     | 10.2 KB      | 488       | 0         |
+--------------------------------------------------------------------------------------------------------------------+
```

### 2.1 `/rooms` (Rooms Manager)
- **Call Chain & Flow**: `src/app/rooms/page.tsx` ([lines 31-35](file:///Users/apple/Byten/byteInn/src/app/rooms/page.tsx#L31-L35)) runs `Promise.all([RoomService.getRooms(), RoomCategoryService.getCategories(), PropertyService.getProperties()])`.
- **Query Waterfall**:
  1. `prisma.user.findUnique` (session auth verification, 1 query).
  2. `prisma.room.findMany` (no `take`, 4 joins: `category`, `building`, `floor`, `property`, 1 query).
  3. `prisma.roomCategory.findMany` (with `amenities` and `_count.rooms`, 1 query).
  4. `prisma.property.findMany` (with `buildings`, 1 query).
- **Time Split**:
  - Server DB Execution: ~177 ms (quicksort + joins on 10,500 rows).
  - Server JSON / RSC Serialization: ~2,100 ms (serializing 10,500 nested objects into HTML).
  - Wire Transfer (localhost): ~23 ms.
  - Client DOM Hydration & Layout: **4,564 ms main thread lock**.
- **Payload Size**: **42.2 MB raw HTML** (917.1 KB gzipped).
- **DOM Nodes**: **311,712 elements**. Every room card includes interactive status badges, dropdowns, and dialog triggers.
- **Pagination & Virtualization**: **None**. Zero pagination on server or client. No list virtualization (`react-window` or `@tanstack/react-virtual` not installed).
- **UX & Loading State**: No `loading.tsx` or skeleton. Browser locks completely while parsing the 42.2 MB payload.

### 2.2 `/reports` (Monolithic Multi-Report Dashboard)
- **Call Chain & Flow**: `src/app/reports/page.tsx` ([lines 28-53](file:///Users/apple/Byten/byteInn/src/app/reports/page.tsx#L28-L53)) executes 7 heavy reporting modules concurrently in `Promise.all`.
- **Queries Triggered**: **20 database queries** across 7 domain modules:
  1. `getOccupancyReport`: 3 queries (date range reservation rooms, rooms count, room categories).
  2. `getRevenueReport`: 2 queries (invoice items by date, payments by date).
  3. `getReservationStatusReport`: 2 queries (status group counts).
  4. `getDailyOperations`: 3 queries (arrivals, departures, stay-overs).
  5. `getAvailabilityGrid`: 2 queries (all 10,500 rooms + all overlapping allocations across 351k rows).
  6. `getShiftCollections`: 2 queries (recorded payments with invoices and creators).
  7. `getReceivablesReport`: 2 queries (all 24,664 unpaid invoices with payments and customers).
- **Time Split**:
  - Server DB Execution: 2,896 ms – 7,497 ms.
  - Server Serialization: ~1,200 ms.
  - Wire Transfer: ~120 ms.
  - Client Render: ~1,500 ms (746 ms main thread long task).
- **Payload Size**: **38.8 MB raw** (3.88 MB gzipped).
- **DOM Nodes**: **33,501 elements**.
- **Loading State**: Force-dynamic server rendering; user sees a blank screen for 8.5 seconds before any UI appears.

### 2.3 `/billing` (Invoices & Receivables)
- **Call Chain & Flow**: `src/app/billing/page.tsx` ([line 16](file:///Users/apple/Byten/byteInn/src/app/billing/page.tsx#L16)) calls `BillingService.getInvoices({ page: 1, limit: 25 })`.
- **Query Waterfall**: `src/modules/billing/billing.service.ts` ([lines 424-454](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L424-L454)) runs `Promise.all`:
  1. `prisma.invoice.count({ where })` (351,692 rows): 88 ms.
  2. `prisma.invoice.findMany({ skip: 0, take: 25, orderBy: { createdAt: "desc" } })`: 34 ms (sequential scan due to missing index).
  3. `prisma.invoice.aggregate({ _sum: { grandTotal: true }, where: { status: { not: VOID } } })`: 98 ms (parallel seq scan on 351k rows).
  4. `prisma.payment.aggregate({ _sum: { amount: true }, where: { status: RECORDED, invoice: { status: { not: VOID } } } })`: **246 ms** (parallel hash join spilling to temp disk).
- **Time Split**:
  - Total DB Time: ~460 ms.
  - Serialization: ~15 ms.
  - TTFB: 827 ms.
  - Client Render: 93 ms.
- **Payload Size**: 154.9 KB raw (16.1 KB gzipped), 25 rows returned.
- **DOM Nodes**: 1,172 elements.

### 2.4 `/reservations` (Reservation Register)
- **Call Chain & Flow**: `src/app/reservations/page.tsx` ([line 16](file:///Users/apple/Byten/byteInn/src/app/reservations/page.tsx#L16)) calls `ReservationService.getReservations({ page: 1, limit: 20 })`.
- **Query Waterfall**: `src/modules/reservations/reservation.service.ts` ([lines 538-568](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts#L538-L568)):
  1. `prisma.reservation.findMany`: 38 ms (parallel seq scan on 351,692 rows to sort by unindexed `created_at`).
  2. `prisma.reservation.count()`: 113 ms (full index/heap scan).
- **Time Split**: Total DB time 186 ms; TTFB 123 ms; Total load 723 ms.
- **Payload Size**: 138.0 KB raw (14.1 KB gzipped).
- **DOM Nodes**: 1,105 elements.

### 2.5 `/customers` (Customer Directory)
- **Call Chain & Flow**: `src/app/customers/page.tsx` calls `CustomerService.getCustomers({ page: 1, limit: 20 })`.
- **Query Waterfall**: `src/modules/customers/customer.service.ts` ([lines 81-107](file:///Users/apple/Byten/byteInn/src/modules/customers/customer.service.ts#L81-L107)):
  1. `prisma.customer.findMany` (20 customers).
  2. `prisma.reservation.groupBy` (calculating `_count.reservations` for 20 customers).
  3. `prisma.reservation.findMany` (fetching last 5 reservations per customer).
  4. `prisma.customer.count()`: 15,000 rows.
- **Time Split**: Total DB time 128 ms; TTFB 445 ms; Total load 1,039 ms.
- **Payload Size**: 172.1 KB raw (16.4 KB gzipped).
- **DOM Nodes**: 1,272 elements.

### 2.6 `/` (Reception Overview)
- **Call Chain & Flow**: `src/app/page.tsx` ([lines 47-70](file:///Users/apple/Byten/byteInn/src/app/page.tsx#L47-L70)) issues 10 database queries via `Promise.all`:
  - 6 separate `prisma.room.count()` queries (one for each `RoomStatus` enum).
  - 2 `prisma.reservation.count()` queries (unfiltered 351k count: 687 ms; confirmed count: 348 ms).
  - `CheckInOutService.getDailyArrivals(today)`.
  - `CheckInOutService.getDailyDepartures(today)`.
- **Time Split**: Total DB time ~1,036 ms – 2,191 ms; TTFB 71 ms (warm) / 1,096 ms (cold); Total load 684 ms.
- **Payload Size**: 51.8 KB raw (9.6 KB gzipped).
- **DOM Nodes**: 266 elements.

---

## 3. Database Layer Analysis

### 3.1 Prisma Query Anti-Patterns Identified

| Anti-Pattern | File & Line Reference | Details & Impact |
| :--- | :--- | :--- |
| **`findMany` without `take`** | [src/modules/rooms/room.service.ts#L287](file:///Users/apple/Byten/byteInn/src/modules/rooms/room.service.ts#L287) | Pulls all 10,500 rooms with 4 joined tables into server memory on every room page view. |
| **`findMany` without `take`** | [src/modules/reports/reports.service.ts#L917](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L917) | Fetches all 10,500 rooms into memory for availability calculation. |
| **`findMany` without `take`** | [src/modules/reports/reports.service.ts#L1302](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L1302) | Fetches all 24,664 unpaid invoices with payments and customers for the receivables report. |
| **Unindexed `ORDER BY created_at`** | [src/modules/reservations/reservation.service.ts#L541](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts#L541) | Top-N heapsort over 351,692 reservations on every list page view. |
| **Unindexed `ORDER BY created_at`** | [src/modules/billing/billing.service.ts#L439](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L439) | Top-N heapsort over 351,692 invoices on every billing page view. |
| **Computed Table Aggregates** | [src/modules/billing/billing.service.ts#L443-L454](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L443-L454) | Parallel Hash Join over 331k payments + 351k invoices spilling to disk on every invoice query. |
| **Unfiltered `count()` on 351k rows** | [src/app/page.tsx#L65](file:///Users/apple/Byten/byteInn/src/app/page.tsx#L65) | `prisma.reservation.count()` scans 351,692 rows every time a user visits the homepage. |
| **Multiple Status Counts vs `groupBy`** | [src/app/page.tsx#L59-L64](file:///Users/apple/Byten/byteInn/src/app/page.tsx#L59-L64) | 6 sequential/parallel `count()` queries on `rooms` instead of a single `groupBy({ by: ['status'] })`. |
| **Case-Insensitive Substring `ILIKE`** | [src/modules/reservations/reservation.service.ts#L529-L535](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts#L529-L535) | `contains: q, mode: 'insensitive'` produces unindexable `ILIKE '%q%'` scanning 351k rows. |
| **Over-fetching Nested Joins** | [src/modules/rooms/room.service.ts#L289-L298](file:///Users/apple/Byten/byteInn/src/modules/rooms/room.service.ts#L289-L298) | Deep join graph `category.amenities.amenity` + `building` + `floor` + `property` serialized repeatedly. |

### 3.2 Database Schema & Missing Index Audit

An inspection of `prisma/schema.prisma` against PostgreSQL foreign keys revealed critical index gaps:

#### Existing Indexes
- **`Role`**: `@id`, `name @unique`
- **`User`**: `@id`, `email @unique`, `@@index([roleId])`
- **`Property`**: `@id`
- **`Building`**: `@id`, `@@index([propertyId])`
- **`Floor`**: `@id`, `@@index([buildingId])`
- **`RoomCategory`**: `@id`, `@@index([propertyId])`
- **`Amenity`**: `@id`, `name @unique`
- **`RoomCategoryAmenity`**: `@@id([roomCategoryId, amenityId])`
- **`Room`**: `@id`, `@@unique([buildingId, roomNo])`, `@@index([propertyId])`, `@@index([roomCategoryId])`, `@@index([status])`
- **`Customer`**: `@id`, `@@index([phone])`, `@@index([email])`
- **`Reservation`**: `@id`, `reservationNo @unique`, `@@index([customerId])`, `@@index([status])`, `@@index([createdBy])`
- **`ReservationRoom`**: `@id`, `@@index([reservationId])`, `@@index([roomId])`, `@@index([roomCategoryId])`, `@@index([arrivalDate, departureDate])`, `@@index([status])`
- **`Invoice`**: `@id`, `invoiceNumber @unique`, `@@index([reservationId])`, `@@index([status])`
- **`InvoiceItem`**: `@id`, `@@index([invoiceId])`, `@@index([reservationRoomId])`
- **`Payment`**: `@id`, `idempotencyKey @unique`, `@@index([invoiceId])`, `@@index([createdBy])`, `@@index([voidedBy])`, `@@index([voidedAt])`
- **`AuditLog`**: `@id`, `@@index([userId])`, `@@index([entityType, entityId])`

#### Missing Indexes (Identified Bottlenecks)
1. **`reservations(created_at DESC)`**: **MISSING**. Causes parallel sequential scan on 351k rows for default reservation lists.
2. **`invoices(created_at DESC)`**: **MISSING**. Causes parallel sequential scan on 351k rows for default invoice lists.
3. **`rooms(floor_id)`**: **MISSING**. Foreign key relation `Floor.rooms` lacks an index.
4. **`room_category_amenities(amenity_id)`**: **MISSING**. Looking up categories by amenity requires a full table scan.
5. **`reservation_rooms(departure_date)`**: **MISSING**. The compound index is `(arrivalDate, departureDate)`. Queries filtering exclusively by `departure_date` (e.g. daily departures) cannot use the leading edge of the index and fall back to status scanning.
6. **`payments(status)` / `payments(invoice_id, status)`**: **MISSING**. The aggregation query `SUM(amount) WHERE status = 'RECORDED'` requires full table scans of `payments`.
7. **`customers(created_at DESC)`**: **MISSING**. Sorting customers requires in-memory heapsort.

### 3.3 Query Execution Plans (`EXPLAIN ANALYZE BUFFERS`)

Twelve representative production queries were evaluated directly against PostgreSQL 15. Key plans are detailed below.

#### Plan 1: Billing Payment Aggregate (The Slowest Single Query)
```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT SUM(p."amount") AS "totalCollected"
FROM "payments" p
JOIN "invoices" i ON p."invoice_id" = i."id"
WHERE p."status" = 'RECORDED' AND i."status" != 'VOID';
```
```
Finalize Aggregate  (cost=24182.45..24182.46 rows=1 width=32) (actual time=172.347..189.655 rows=1 loops=1)
  Buffers: shared hit=1796 read=11643, temp read=3521 written=3552
  ->  Gather  (cost=24182.22..24182.43 rows=2 width=32) (actual time=171.980..189.643 rows=3 loops=1)
        Workers Planned: 2, Workers Launched: 2
        Buffers: shared hit=1796 read=11643, temp read=3521 written=3552
        ->  Partial Aggregate  (cost=23182.22..23182.23 rows=1 width=32) (actual time=170.139..170.143 rows=1 loops=3)
              ->  Parallel Hash Join  (cost=10988.84..22846.80 rows=134168 width=6) (actual time=148.026..165.018 rows=110385 loops=3)
                    Hash Cond: (p.invoice_id = i.id)
                    Buffers: shared hit=1796 read=11643, temp read=3521 written=3552
                    ->  Parallel Seq Scan on public.payments p  (cost=0.00..8632.76 rows=137981 width=31)
                    ->  Parallel Hash  (cost=8232.73..8232.73 rows=142489 width=25) (actual time=79.073..79.073 rows=113993 loops=3)
                          Buckets: 131072  Batches: 4  Memory Usage: 6432kB
                          Buffers: shared hit=1068 read=5333, temp written=1420
                          ->  Parallel Seq Scan on public.invoices i  (cost=0.00..8232.73 rows=142489 width=25)
Execution Time: 189.710 ms
```
> **Plan Finding**: The hash table cannot fit into `work_mem` (6.4 MB memory usage across 4 batches), writing **3,552 temp blocks (~28.4 MB)** to disk and reading them back. Executing this on every pagination request of `/billing` severely degrades I/O.

#### Plan 2: Unindexed Reservation Pagination
```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT id, reservation_no, customer_id, status, created_by, special_requests, created_at
FROM "reservations"
ORDER BY "created_at" DESC
LIMIT 20 OFFSET 0;
```
```
Limit  (cost=14097.73..14100.06 rows=20 width=161) (actual time=37.773..38.655 rows=20 loops=1)
  Buffers: shared hit=2194 read=5613
  ->  Gather Merge  (cost=14097.73..48292.32 rows=293076 width=161) (actual time=37.772..38.646 rows=20 loops=1)
        Workers Planned: 2, Workers Launched: 2
        ->  Sort  (cost=13097.71..13464.05 rows=146538 width=161) (actual time=36.480..36.484 rows=19 loops=3)
              Sort Key: reservations.created_at DESC
              Sort Method: top-N heapsort  Memory: 34kB
              ->  Parallel Seq Scan on public.reservations  (cost=0.00..9198.38 rows=146538 width=161)
Execution Time: 38.677 ms
```
> **Plan Finding**: Reading 20 rows requires a full parallel sequential scan of all 351,692 rows (`read=5,613 blocks = 44.9 MB`) and an in-memory top-N heapsort because `created_at` lacks an index.

#### Plan 3: Case-Insensitive Multi-Field Search (`ILIKE`)
```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT r.id, r.reservation_no, c.first_name, c.last_name, c.phone, c.email
FROM "reservations" r
JOIN "customers" c ON r.customer_id = c.id
WHERE (r.reservation_no ILIKE '%RES-2026%' OR c.first_name ILIKE '%Alice%' OR c.phone ILIKE '%987%')
ORDER BY r.created_at DESC
LIMIT 20 OFFSET 0;
```
```
Limit  (cost=15238.71..15241.04 rows=20 width=114) (actual time=93.067..94.183 rows=20 loops=1)
  Buffers: shared hit=1436 read=7730
  ->  Gather Merge  (cost=15238.71..49430.03 rows=293048 width=114) (actual time=93.066..94.182 rows=20 loops=1)
        ->  Hash Join  (cost=756.50..10339.73 rows=146524 width=114) (actual time=4.673..74.135 rows=117231 loops=3)
              Join Filter: ((r.reservation_no ~~* '%RES-2026%') OR (c.first_name ~~* '%Alice%') OR (c.phone ~~* '%987%'))
              ->  Parallel Seq Scan on public.reservations r  (cost=0.00..9198.38 rows=146538 width=75)
              ->  Hash  (cost=569.00..569.00 rows=15000 width=91)
Execution Time: 94.246 ms
```
> **Plan Finding**: Substring searches cannot leverage B-Tree indexes, scanning 7,730 disk buffers (61.8 MB) and executing 117,231 regex joins per worker.

### 3.4 PostgreSQL Engine Health & Statistics
- **PostgreSQL Version**: `15.15 (Homebrew) on aarch64-apple-darwin25.2.0`
- **Buffer Cache Hit Ratio**: **90.41%** (`heap_hit: 17,287,659`, `heap_read: 1,833,482`). Acceptable, but disk reads spike during billing and report joins.
- **Table Maintenance & Tuple Counts**:
  - `invoice_items`: 456,774 live tuples, 0 dead tuples. Last autoanalyze: 14:23:48.
  - `reservations`: 351,692 live tuples, 0 dead tuples. Last autoanalyze: 14:21:37.
  - `invoices`: 351,692 live tuples, 0 dead tuples. Last autoanalyze: 14:23:51.
  - `reservation_rooms`: 351,692 live tuples, 0 dead tuples. Last autoanalyze: 14:22:47.
  - `payments`: 331,154 live tuples, 0 dead tuples. Last autoanalyze: 14:24:41.
  - `customers`: 15,000 live tuples.
  - `rooms`: 10,500 live tuples.
- **`pg_stat_statements` Extension Status**: **Not installed** in the database cluster (`0 rows` returned from `pg_extension`).

---

## 4. Backend & API Layer Performance

### 4.1 Heavy Synchronous Endpoints

| Endpoint | Method | Measured Payload | Server Execution Time | Root Cause |
| :--- | :--- | :--- | :--- | :--- |
| `/api/rooms` | `GET` | **33.3 MB raw** | 220 ms DB + 1,800 ms serialization | Returns all 10,500 rooms with 4 nested joins in a single JSON array. |
| `/api/reports/availability-grid` | `GET` | **16.3 MB raw** | 1,740 ms | Computes 73,500 day cells across 10,500 rooms in a single request. |
| `/api/reports/receivables` | `GET` | **12.9 MB raw** | 1,420 ms | Returns all 24,664 unpaid invoices with customers and payments. |
| `/api/reports/daily-operations` | `GET` | **3.8 MB raw** | 380 ms | Computes arrivals, departures, and stay-overs for all rooms. |
| `/api/invoices` | `GET` | 154.9 KB | 460 ms | Performs table-wide `SUM` across 351k invoices and 331k payments. |

### 4.2 Serialization & DTO Transformation Overhead
In Next.js Route Handlers and Server Components, all Prisma `Decimal` instances must be converted to strings (`.toString()`) and `Date` instances to ISO strings (`.toISOString()`) to avoid React serialization errors.
- On `/rooms`, the server executes `.map()` transformations over **10,500 objects**, formatting 4 nested objects per room. This consumes **~2,100 ms of pure V8 JavaScript execution time** on the Node.js server before the first byte can be sent to the wire.
- In `BillingService.formatInvoiceDetail`, formatting 25 items takes < 2 ms; however, in `ReportsService.getReceivablesReport`, formatting 24,664 items takes **~950 ms**.

### 4.3 Authentication Overhead per Request
- **Implementation**: Defined in `src/lib/auth-guard.ts` ([lines 39-42](file:///Users/apple/Byten/byteInn/src/lib/auth-guard.ts#L39-L42)).
- **Mechanism**: On every authenticated request, `getSession()` reads the JWT, verifies the HMAC signature with `jose`, and then executes:
  ```ts
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: true },
  });
  ```
- **Measured Impact**:
  - Adds **1 mandatory DB round-trip** (~1.2 ms to 2.5 ms) to every single API and page request.
  - If a page makes 4 background API requests on mount (e.g. `/api/auth/me`, `/api/notifications`, etc.), each independent request performs this query redundantly.
  - While necessary for immediate token revocation (`tokenVersion`), the result is never cached even for a 30-second TTL.

---

## 5. Frontend & UI Layer Performance

### 5.1 Bundle Size & Asset Distribution
From the production Turbopack build analysis:
- **Shared JavaScript Framework Chunk**: ~229.5 KB (React 19 runtime, Next.js App Router scheduler).
- **Vendor Core Chunk**: ~158.4 KB (Base UI primitives, Lucide icons, date-fns utilities).
- **Global CSS**: ~126.9 KB (Tailwind CSS v4 tokens and component styles).
- **Client Route Bundles**: Between 25 KB and 80 KB per page.
> **Finding**: Total JavaScript downloaded across the wire is modest (~450 KB gzipped). The frontend bottleneck is **not bundle weight**; it is **RSC data payload volume** and **DOM node explosion**.

### 5.2 Client vs. Server Component Architecture
- In `/rooms`, `src/app/rooms/page.tsx` (Server) passes the 10,500 room array as a single prop to `RoomManager` (Client). Next.js embeds this entire array in the HTML as a `self.__next_f.push(...)` script tag.
- As a consequence, the initial document download is **42.2 MB**. The browser must download 42.2 MB, parse 42.2 MB of JSON, construct 311,712 React Fiber nodes, and mount them into the real DOM.

### 5.3 DOM Node Count & Main Thread Freezes

```
+-----------------------------------------------------------------------------------------+
| Route               | DOM Node Count | Main Thread Long Tasks | Longest Task Duration   |
+-----------------------------------------------------------------------------------------+
| /rooms              | 311,712 nodes  | 3 tasks                | 4,564 ms (Frozen UI)    |
| /reports            | 33,501 nodes   | 2 tasks                | 746 ms                  |
| /categories         | 2,377 nodes    | 0 tasks                | < 50 ms                 |
| /customers          | 1,272 nodes    | 0 tasks                | < 50 ms                 |
| /billing            | 1,172 nodes    | 0 tasks                | < 50 ms                 |
| /reservations       | 1,105 nodes    | 0 tasks                | < 50 ms                 |
| / (Overview)        | 266 nodes      | 0 tasks                | < 20 ms                 |
+-----------------------------------------------------------------------------------------+
```

> **Google Web Vitals Threshold**: Google recommends keeping DOM trees below **1,500 nodes** and warns when trees exceed **3,000 nodes**. At **311,712 nodes**, `/rooms` exceeds the recommended threshold by **207x**, inducing immediate browser stutter, high memory consumption (~650 MB tab footprint in Chromium), and input latency exceeding 4 seconds.

---

## 6. Baseline Metrics Table

Comprehensive summary table across all evaluated routes under production load:

| Page / Route | Primary Queries / Services | DB Queries | DB Time (ms) | Payload Raw (KB) | Payload Gzip (KB) | TTFB (ms) | FCP (ms) | LCP (ms) | Total Load (ms) | DOM Nodes |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`/` (Overview)** | 6x Room count, 2x Res count, Daily arr/dep | 10 | 1,036 ms | 51.8 KB | 9.6 KB | 71 ms | 152 ms | 152 ms | 684 ms | 266 |
| **`/rooms`** | `RoomService.getRooms()` (All 10,500) | 3 | 177 ms | 42,181.5 KB | 917.1 KB | 2,362 ms | 2,572 ms | 2,572 ms | 7,930 ms | 311,712 |
| **`/reports`** | 7 concurrent reporting services | 20 | 2,896 ms | 38,771.3 KB | 3,879.4 KB | 8,477 ms | 8,784 ms | 8,784 ms | 10,465 ms | 33,501 |
| **`/billing`** | `BillingService.getInvoices({limit: 25})` | 4 | 460 ms | 154.9 KB | 16.1 KB | 827 ms | 920 ms | 920 ms | 1,448 ms | 1,172 |
| **`/reservations`** | `ReservationService.getReservations({limit: 20})` | 2 | 186 ms | 138.0 KB | 14.1 KB | 123 ms | 196 ms | 196 ms | 723 ms | 1,105 |
| **`/customers`** | `CustomerService.getCustomers({limit: 20})` | 4 | 128 ms | 172.1 KB | 16.4 KB | 445 ms | 536 ms | 536 ms | 1,039 ms | 1,272 |
| **`/categories`** | `RoomCategoryService.getCategories()` | 2 | 22 ms | 485.2 KB | 16.5 KB | 32 ms | 112 ms | 112 ms | 628 ms | 2,377 |
| **`/reservations/new`** | `RoomCategoryService.getCategories()` | 2 | 14 ms | 52.9 KB | 10.4 KB | 14 ms | 68 ms | 68 ms | 582 ms | 394 |
| **`/reservations/[id]`** | `getReservationById` + `getInvoiceByReservationId` | 3 | 18 ms | 50.8 KB | 11.2 KB | 14 ms | 72 ms | 72 ms | 594 ms | 374 |
| **`/billing/[id]`** | `BillingService.getInvoiceById` | 2 | 12 ms | 44.4 KB | 9.1 KB | 15 ms | 64 ms | 64 ms | 588 ms | 273 |
| **`/customers/[id]`** | `CustomerService.getCustomerById` | 2 | 11 ms | 63.0 KB | 10.2 KB | 9 ms | 92 ms | 92 ms | 612 ms | 488 |

---

## 7. Prioritized Findings & Action Plan

Ranked by **Impact / Effort**:

### 7.1 High Impact, Low Effort (Immediate Quick Wins)

#### Finding 1: Add Missing Indexes on `created_at` for Reservations and Invoices
- **What is slow & why**: Default sorting on `/reservations` ([src/modules/reservations/reservation.service.ts#L541](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts#L541)) and `/billing` ([src/modules/billing/billing.service.ts#L439](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L439)) uses `ORDER BY created_at DESC`. Both tables lack an index on `created_at`, forcing 351k-row parallel sequential scans and heapsorts.
- **Measured Cost vs. Expected Cost**: 38 ms execution time + 45 MB buffer scan drops to **< 1 ms execution time + 2 buffer hits** via B-Tree index scan.
- **Concrete Fix**:
  Add `@@index([createdAt(sort: Desc)])` to `model Reservation` and `model Invoice` in `prisma/schema.prisma` and generate a migration.
- **Risk / Breaking Potential**: **Zero risk**. Pure additive database index.

#### Finding 2: Add Missing Foreign Key Indexes on `rooms(floor_id)` and `room_category_amenities(amenity_id)`
- **What is slow & why**: Joins from `floors` to `rooms` or reverse lookups on `amenity_id` perform table scans.
- **Concrete Fix**: Add `@@index([floorId])` to `model Room` and `@@index([amenityId])` to `model RoomCategoryAmenity`.
- **Risk**: **Zero risk**.

#### Finding 3: Replace 6 Separate Room Count Queries with Single `groupBy` on Overview
- **What is slow & why**: `src/app/page.tsx` ([lines 59-64](file:///Users/apple/Byten/byteInn/src/app/page.tsx#L59-L64)) issues 6 sequential/parallel `prisma.room.count({ where: { status } })` queries.
- **Measured Cost vs. Expected Cost**: 6 queries (~25 ms) drops to 1 query (~3 ms) using `prisma.room.groupBy({ by: ['status'], _count: { id: true } })`.
- **Risk**: **Zero risk**. Pure refactor within page data mapping.

#### Finding 4: Remove or Cache Total Reservation Count on Overview
- **What is slow & why**: `src/app/page.tsx` ([line 65](file:///Users/apple/Byten/byteInn/src/app/page.tsx#L65)) executes `prisma.reservation.count()` on 351,692 rows every time any user loads the dispatch homepage, taking **687 ms**.
- **Measured Cost vs. Expected Cost**: 687 ms server execution drops to **0 ms**.
- **Concrete Fix**: Either remove the total historical reservation count from the reception dashboard (receptionists only care about daily arrivals/departures and current occupancy) or wrap with `unstable_cache` with a 10-minute revalidation window.
- **Risk**: Minimal; requires verifying UI requirement for historical reservation tally.

---

### 7.2 High Impact, Medium Effort

#### Finding 5: Paginate or Lazy-Load `/rooms` by Property/Building/Floor
- **What is slow & why**: `RoomService.getRooms()` ([src/modules/rooms/room.service.ts#L271-L301](file:///Users/apple/Byten/byteInn/src/modules/rooms/room.service.ts#L271-L301)) returns all 10,500 rooms without a `take` limit. Serializing and rendering 10,500 cards creates 311,712 DOM nodes, transferring 42.2 MB and freezing the browser for 4.56 seconds.
- **Measured Cost vs. Expected Cost**: Total load time drops from **7,930 ms to < 250 ms**; payload drops from **42.2 MB to < 100 KB**; DOM nodes drop from **311,712 to < 1,500**.
- **Concrete Fix**:
  1. Default `/rooms` to load rooms filtered by the first building or active floor, OR implement server pagination (`take: 50, skip`).
  2. Implement window virtualization in `RoomManager` using `@tanstack/react-virtual` so only visible room cards are mounted in the DOM.
- **Risk**: UI behavior change. Requires user approval on whether receptionists require all 10,500 rooms on one infinite screen or prefer building/floor tabs.

#### Finding 6: Split `/reports` into Lazy-Loaded Tab Components
- **What is slow & why**: `src/app/reports/page.tsx` ([lines 28-53](file:///Users/apple/Byten/byteInn/src/app/reports/page.tsx#L28-L53)) fetches 7 reports concurrently on initial page load, running 20 SQL queries, generating 38.8 MB, and causing an 8.5s TTFB. The user only looks at one tab at a time.
- **Measured Cost vs. Expected Cost**: Initial load TTFB drops from **8,477 ms to ~180 ms**; payload drops from **38.8 MB to ~35 KB**.
- **Concrete Fix**:
  1. Initial page load renders the reports shell and loads ONLY the first active tab (e.g. `OccupancyReport`).
  2. The remaining 6 tabs fetch their respective API routes (`/api/reports/...`) on demand only when the user clicks that tab.
  3. Add pagination or date-window constraints to `getAvailabilityGrid` and `getReceivablesReport`.
- **Risk**: Minor UX transition (tabs show brief skeleton loaders on first click instead of instant preloaded switching).

#### Finding 7: Separate Billing Summary Aggregation from Invoice List Query
- **What is slow & why**: `BillingService.getInvoices` ([src/modules/billing/billing.service.ts#L443-L454](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L443-L454)) re-runs full table aggregations across 351k invoices and 331k payments on every page navigation, taking 246 ms and spilling to temp disk.
- **Measured Cost vs. Expected Cost**: `/billing` TTFB drops from **827 ms to < 90 ms**.
- **Concrete Fix**:
  1. Decouple summary metrics (`totalInvoiced`, `totalCollected`, `totalOutstanding`) from pagination.
  2. Cache the three summary totals using `unstable_cache` with tag-based revalidation (`revalidateTag('billing-summary')`) triggered only when payments or invoices are created/modified.
- **Risk**: Low. Invoices list pagination becomes lightning fast.

---

### 7.3 Architectural & Long-Term Effort

#### Finding 8: Full-Text Search with PostgreSQL Trigram Indexes (`pg_trgm`)
- **What is slow & why**: Searching reservations ([src/modules/reservations/reservation.service.ts#L529-L535](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts#L529-L535)) and customers ([src/modules/customers/customer.service.ts#L70-L78](file:///Users/apple/Byten/byteInn/src/modules/customers/customer.service.ts#L70-L78)) uses `contains` with `mode: 'insensitive'`, generating unindexed `ILIKE '%q%'` table scans.
- **Concrete Fix**: Enable `pg_trgm` extension in PostgreSQL and add GIN trigram indexes on `customers(first_name, last_name, phone, email)` and `reservations(reservation_no)`.
- **Risk**: Requires PostgreSQL superuser extension permissions and migration testing.

#### Finding 9: Session Authentication DB Hit Reduction (In-Memory / Redis Cache)
- **What is slow & why**: Every request hits `prisma.user.findUnique` in `getSession()` ([src/lib/auth-guard.ts#L39-L42](file:///Users/apple/Byten/byteInn/src/lib/auth-guard.ts#L39-L42)) to verify account status and `tokenVersion`.
- **Concrete Fix**: Cache active user sessions in an in-memory LRU cache or Redis for 30–60 seconds, invalidating immediately on logout or password change.
- **Risk**: Small delay in account disabling if cache invalidation is bypassed.

---

## 8. Constraints, Unknowns & Hardware Details

1. **`pg_stat_statements` Extension**:
   - `pg_stat_statements` is not currently enabled in the local PostgreSQL instance. Query timings and buffer analyses were captured directly via `EXPLAIN (ANALYZE, BUFFERS)` and application-level Prisma query logging.
2. **Database State & Scale**:
   - Tested against a single node PostgreSQL 15.15 instance with 1.87M rows. On production multi-tenant or cloud-hosted DBs (e.g. AWS RDS / Supabase), network round-trip latencies will multiply the impact of unindexed queries and waterfalls by 5x–10x.
3. **Decisions Requiring Product / Reception Alignment**:
   - **`/rooms` Display Preference**: Does reception truly need all 10,500 rooms on a single scrollable screen, or is a hierarchical Building/Floor tabbed navigation with search preferable?
   - **`/reports` Availability Grid Window**: The current grid renders all 10,500 rooms across 7 days. Limiting the view to selected buildings/floors or paginating physical rooms will reduce payload from 16.3 MB to < 200 KB.
