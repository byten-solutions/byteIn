-- ==============================================================================
-- BYTEINN PRODUCTION REPORT PERFORMANCE & DATABASE DIAGNOSTIC SCRIPT (READ-ONLY)
-- ==============================================================================
-- 5-LINE USAGE GUIDE:
-- 1. Open Supabase Dashboard -> SQL Editor (or connect via read-only psql session).
-- 2. Paste and run this script to inspect database index health, row counts, and plan costs.
-- 3. If any critical index in Section 2 is marked 'MISSING', deploy pending Prisma migrations.
-- 4. Check Section 4 EXPLAIN plans for 'Seq Scan' on large tables; verify Index Cond usage.
-- 5. Safe: Contains 100% read-only SELECT queries; will NOT modify, lock, or delete any data.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. APPLIED PRISMA MIGRATIONS
-- ------------------------------------------------------------------------------
SELECT
  migration_name,
  finished_at,
  applied_steps_count,
  rolled_back_at
FROM _prisma_migrations
ORDER BY finished_at DESC;

-- ------------------------------------------------------------------------------
-- 2. CRITICAL REPORT INDEX INTEGRITY CHECK
-- ------------------------------------------------------------------------------
WITH expected_indexes AS (
  SELECT unnest(ARRAY[
    'rooms_property_id_room_category_id_idx',
    'rooms_property_id_idx',
    'reservations_property_id_idx',
    'reservation_rooms_property_id_idx',
    'reservation_rooms_arrival_date_departure_date_idx',
    'reservation_rooms_room_id_arrival_date_departure_date_idx',
    'invoices_property_id_idx',
    'payments_property_id_idx',
    'payments_property_id_paid_at_idx',
    'payments_recorded_by_id_paid_at_idx',
    'payments_paid_at_idx'
  ]) AS index_name
)
SELECT
  e.index_name,
  CASE
    WHEN i.indexname IS NOT NULL THEN 'PRESENT'
    ELSE 'MISSING (Run prisma migrate deploy)'
  END AS status,
  i.tablename,
  i.indexdef
FROM expected_indexes e
LEFT JOIN pg_indexes i ON i.indexname = e.index_name AND i.schemaname = 'public'
ORDER BY e.index_name;

-- ------------------------------------------------------------------------------
-- 3. PRODUCTION TABLE ESTIMATED ROW COUNTS & SIZES
-- ------------------------------------------------------------------------------
SELECT
  relname AS table_name,
  n_live_tup AS estimated_row_count,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
  pg_size_pretty(pg_indexes_size(c.oid)) AS index_size
FROM pg_stat_user_tables s
JOIN pg_class c ON c.relname = s.relname
WHERE s.schemaname = 'public'
  AND s.relname IN (
    'properties', 'room_categories', 'buildings', 'floors', 'rooms',
    'users', 'roles', 'customers', 'reservations', 'reservation_rooms',
    'invoices', 'invoice_items', 'payments', 'audit_logs'
  )
ORDER BY n_live_tup DESC;

-- ------------------------------------------------------------------------------
-- 4. EXPLAIN (ANALYZE, BUFFERS) PLANS FOR OPTIMIZED COMPOSITE QUERIES
-- ------------------------------------------------------------------------------

-- 4a. Daily Operations Counts Plan (Target: 1 query, Index Scan on arrival/departure dates)
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  COUNT(*) FILTER (WHERE arrival_date = CURRENT_DATE AND status IN ('CONFIRMED', 'CHECKED_IN'))::int AS arrivals_expected,
  COUNT(*) FILTER (WHERE arrival_date = CURRENT_DATE AND status = 'CHECKED_IN')::int AS arrivals_checked_in,
  COUNT(*) FILTER (WHERE departure_date = CURRENT_DATE AND status = 'CHECKED_IN')::int AS departures_pending,
  COUNT(*) FILTER (WHERE departure_date = CURRENT_DATE AND status = 'CHECKED_OUT')::int AS departures_completed,
  COUNT(*) FILTER (WHERE status = 'CHECKED_IN')::int AS in_house_current
FROM reservation_rooms
WHERE (arrival_date = CURRENT_DATE OR departure_date = CURRENT_DATE OR status = 'CHECKED_IN');

-- 4b. Occupancy Report CTE Aggregation Plan
EXPLAIN (ANALYZE, BUFFERS)
WITH total_rooms_cte AS (
  SELECT COUNT(*)::int as count FROM rooms
),
daily_alloc AS (
  SELECT
    d.dt::date as day,
    COUNT(DISTINCT rr.room_id) FILTER (WHERE (
      rr.status IN ('CHECKED_IN', 'CHECKED_OUT')
      OR (rr.status = 'CONFIRMED' AND d.dt::date >= CURRENT_DATE)
    ))::int as occupied_rooms,
    COALESCE(SUM(rr.booked_nightly_rate) FILTER (WHERE (
      rr.status IN ('CHECKED_IN', 'CHECKED_OUT')
      OR (rr.status = 'CONFIRMED' AND d.dt::date >= CURRENT_DATE)
    )), 0) as room_revenue
  FROM reservation_rooms rr
  JOIN rooms rm ON rm.id = rr.room_id
  CROSS JOIN LATERAL generate_series(
    GREATEST(rr.arrival_date, CURRENT_DATE - 30),
    LEAST(COALESCE(rr.actual_checkout_date, rr.departure_date) - 1, CURRENT_DATE),
    '1 day'::interval
  ) d(dt)
  WHERE rr.arrival_date <= CURRENT_DATE
    AND COALESCE(rr.actual_checkout_date, rr.departure_date) > (CURRENT_DATE - 30)
    AND rr.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
  GROUP BY d.dt::date
)
SELECT
  (SELECT count FROM total_rooms_cte)::int as total_rooms,
  cal.dt::date as day,
  COALESCE(da.occupied_rooms, 0)::int as occupied_rooms,
  COALESCE(da.room_revenue, 0) as room_revenue
FROM generate_series((CURRENT_DATE - 30)::date, CURRENT_DATE::date, '1 day'::interval) cal(dt)
LEFT JOIN daily_alloc da ON da.day = cal.dt::date
ORDER BY cal.dt::date ASC;
