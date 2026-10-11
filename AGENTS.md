# byteInn — Agent Instructions & Engineering Rules

## 1. System Overview & Core Goals
byteInn is an internal, reception-operated Property Management System (PMS) / room management application.
- **Primary Users**:
  - `ADMIN`: User account management and permitted system configuration.
  - `RECEPTIONIST`: Day-to-day guest registration, reservations, room allocations, check-in, check-out, billing, and payment recording.
- **Core Purpose**: Streamline reception desk operations with high transactional integrity. There is **no customer-facing booking portal in V1**.

---

## 2. Approved V1 Architecture & Scope Boundaries
- **Architecture**: Modular Monolith unified within Next.js.
  - **Frontend**: Next.js 16 (App Router) using the generated shadcn/ui preset conventions and Tailwind CSS v4.
  - **Backend API**: Next.js Route Handlers (`src/app/api/...`), keeping HTTP handlers thin and delegating business logic to domain services in `src/modules/`. Do not create a separate backend server process.
  - **Database**: Single PostgreSQL database accessed exclusively via Prisma ORM (`src/lib/prisma.ts`).
  - **Deployment**: One application and one PostgreSQL database.
- **Key Business Invariants**:
  - One reservation can contain multiple physical room allocations.
  - Each room allocation is assigned an explicit physical room at booking time with its own stay dates (`arrival_date` inclusive, `departure_date` exclusive) and snapshotted `booked_nightly_rate`.
  - Physical room statuses (`VACANT_CLEAN`, `VACANT_DIRTY`, `OCCUPIED`, `MAINTENANCE`, `OUT_OF_SERVICE`) represent physical state, not reservation schedules. Checkout strictly transitions the room to `VACANT_DIRTY`.
  - Concurrency and double-booking prevention must be safely enforced at the database/transaction level, never solely in frontend code.
  - Billing defaults to one invoice per reservation with itemized room charges and optional extra charges, supporting multiple and partial payments.
  - Monetary values use fixed-precision PostgreSQL `numeric` / Prisma `Decimal(10, 2)`.

---

## 3. Explicit V1 Exclusions (Scope Protection)
The following are **strictly out of scope** for V1 and must not be implemented or scaffolded:
- ❌ No customer-facing booking portal or guest public registration.
- ❌ No multi-tenancy or `tenant_id` fields (deferred until multi-property/tenant onboarding).
- ❌ No microservices, message queues (RabbitMQ, Kafka), or event streaming.
- ❌ No third-party payment gateway integrations (Stripe, PayPal webhooks), automated housekeeping scheduling, or maintenance ticket engines.
- ❌ No dynamic/variable day-by-day room pricing (each allocation preserves a single snapshotted nightly rate).
- ❌ No premature abstractions, speculative interfaces, or unrelated code refactoring.

---

## 4. Authoritative Documentation Index
The primary source of truth resides under `docs/`. Always consult the relevant document before proposing or making changes:

| Subject Domain | Authoritative Document |
| :--- | :--- |
| **System Architecture & Stack Boundaries** | [docs/byteInn_Architecture_v1.md](file:///Users/apple/Byten/byteInn/docs/byteInn_Architecture_v1.md) |
| **Database Schema, Models, Types & Indexes** | [docs/byteInn_Database_Design_v1.md](file:///Users/apple/Byten/byteInn/docs/byteInn_Database_Design_v1.md) |
| **Request Flow, Module Logic & API Endpoints** | [docs/byteInn_Low_Level_Architecture_v1.md](file:///Users/apple/Byten/byteInn/docs/byteInn_Low_Level_Architecture_v1.md) |
| **Phased Roadmap & Acceptance Criteria** | [docs/byteInn_Implementation_Plan_v1.md](file:///Users/apple/Byten/byteInn/docs/byteInn_Implementation_Plan_v1.md) |
| **Database Operations & Migrations** | [prisma/README.md](file:///Users/apple/Byten/byteInn/prisma/README.md) |
| **Source Organization & API Patterns** | [src/README.md](file:///Users/apple/Byten/byteInn/src/README.md) |

---

## 5. Living Documentation Protocol
Whenever working on the codebase, follow this engineering loop:

1. **Understand Scope**: Identify task acceptance criteria and verify boundaries against V1 rules.
2. **Consult Authority**: Read the relevant sections of `AGENTS.md` and the designated `docs/*.md` file before coding.
3. **Inspect Active Implementation**: Inspect real files, active types, and schemas rather than assuming docs are always fully up to date.
4. **Make Minimal Changes**: Implement the smallest correct change that satisfies the requirement (minimal diff principle). Never refactor unrelated files.
5. **Update Living Documentation**: Update relevant documentation (`docs/`, `src/README.md`, `prisma/README.md`) when a change alters contracts, schemas, business logic, or implementation phase status. Never claim a feature exists in docs if it is not yet implemented.
6. **Validate Changes**: Run relevant validation checks (`npx prisma validate`, `npx tsc --noEmit`, `npm run build`, `npm run lint`) and inspect the final diff.
7. **Report Accurately**: State what changed, what documentation was updated, what was verified, and any unresolved questions.

---

## 6. Architectural Safeguards & Git Discipline
- **Ambiguities & Conflicts**: If documentation conflicts with active code or requirements are ambiguous, **stop and ask the user** rather than silently inventing business rules or architectural patterns.
- **Git Safety**: Never run destructive Git commands (`git reset --hard`, `git clean -fd`, destructive checkout) that modify git history or discard uncommitted user changes. Never commit, push, merge, or deploy without explicit user approval.
- **Database Rules**: Never use `prisma db push` as a substitute for migrations. Always create and apply versioned Prisma migrations. Always use PostgreSQL `numeric` / Prisma `Decimal` for financial values.
- **Data Operations**: Search, sorting, filtering, and pagination must be handled **backend-first** in the database query via Prisma, never in frontend client memory.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
