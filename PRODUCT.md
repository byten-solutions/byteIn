# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Receptionist (Primary)**: Operates the system continuously under high time pressure with guests standing at the front desk. Tasks: rapidly register walk-ins or reservations, verify guest IDs, allocate rooms, execute 1-click check-in and check-out, issue keycards, itemize stay charges, record payments (cash, card, UPI, bank transfer), and print folios.
- **Hotel Administrator (Secondary)**: Hotel owner or general manager managing property configuration, room inventory, building blocks, rate tiers, staff accounts, financial auditing, occupancy tracking, and daily night-audit reconciliation.

## Product Purpose

byteInn is an internal, reception-operated Property Management System (PMS) engineered for small-to-midsize hotels, boutique lodges, and inns. It eliminates operational friction, prevents double-booking at the database level, and provides calm front-desk ergonomics with zero unnecessary enterprise overhead or external portal bloat.

## Positioning

Unlike bloated legacy enterprise PMS suites or customer-facing booking aggregators, byteInn is laser-focused on reception-desk speed, transactional integrity, and front-desk ergonomics. Every operational action (check-in, check-out, room allocation, payment recording) is reachable in 1–2 clicks with backend-validated concurrency protection.

## Operating Context

- **Front-Desk Hardware**: Desktop computers and counter tablets running modern web browsers (Chrome, Safari, Edge, Firefox).
- **Physical Environment**: Hotel lobby desks subject to varied lighting (bright daylight during morning check-outs, low-lit warm ambient lighting during late-night arrivals).
- **Physical Rituals**: Inspecting room keycard racks, receiving guest identity documents, printing physical paper guest registration cards and billing receipts, coordinating with housekeeping via physical room statuses (`VACANT_CLEAN`, `VACANT_DIRTY`, `OCCUPIED`, `MAINTENANCE`, `OUT_OF_SERVICE`).

## Capabilities and Constraints

- **Single-Property Scope (V1)**: Reception-operated, single-property PMS. No customer-facing booking portal, no multi-tenancy (`tenant_id`), no microservices.
- **Transactional Invariants**:
  - Reservations hold multiple room allocations with snapshotted `booked_nightly_rate` and date ranges (`arrival_date` inclusive, `departure_date` exclusive).
  - Physical room status reflects physical readiness, not booking schedules. Check-out strictly transitions rooms to `VACANT_DIRTY`.
  - Concurrency & double-booking prevention is enforced at the database transaction level (`prisma.$transaction`).
  - Monetary values use exact PostgreSQL `numeric(10, 2)` / Prisma `Decimal(10, 2)` arithmetic; floating point is prohibited for money.
- **Tech Stack**: Next.js 16 (App Router), Tailwind CSS v4, Base UI / shadcn component primitives, PostgreSQL with Prisma ORM.

## Brand Commitments

- **Name**: byteInn
- **Tone & Atmosphere**: Warm Boutique Hospitality — refined warm terracotta and amber primary accents, rich tactile stone/slate surfaces, warm neutral borders, and calm, confident front-desk legibility.
- **Visual Personality**: Elevated, purposeful, warm, and highly functional. Not clinical white, not generic corporate blue, not frivolous or gamified.

## Evidence on Hand

- Authoritative architectural, database, and UX specifications: `docs/byteInn_Architecture_v1.md`, `docs/byteInn_Database_Design_v1.md`, `docs/byteInn_Low_Level_Architecture_v1.md`, `docs/UI_UX_GUIDELINES.md`.
- Active working modules and backend tests in `src/modules/` and `tests/`.

## Product Principles

1. **Receptionist-First Speed**: Front-desk operations must never be blocked by nested menus or sluggish interactions; critical data (room numbers, guest identity, balance due) must be legible at a glance.
2. **Transactional Integrity Over Optimism**: Never rely on frontend optimism for room availability or billing; all operations are strictly validated backend-first.
3. **Calm Hospitality Craft**: The interface should feel like an extension of a well-run boutique hotel — polished, welcoming, tactile, and clear under both daylight and night lobby conditions.
4. **Flawless Dark & Light Parity**: Seamless contrast and visual hierarchy across day and night reception shifts.

## Accessibility & Inclusion

- WCAG 2.1 AA compliance for color contrast across both light and dark themes.
- Clear tabular numeric alignment using tabular/monospace figures for currency and room codes.
- High-contrast operational status badges for quick, mistake-free scanning.
