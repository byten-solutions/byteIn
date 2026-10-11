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
| **Coding Standards & Quality Foundation** | [docs/CODING_STANDARDS.md](file:///Users/apple/Byten/byteInn/docs/CODING_STANDARDS.md) |
| **UI/UX Design System & Shell Guidelines** | [docs/UI_UX_GUIDELINES.md](file:///Users/apple/Byten/byteInn/docs/UI_UX_GUIDELINES.md) |
| **Agent System Workflow & Lifecycle** | [docs/AGENT_WORKFLOW.md](file:///Users/apple/Byten/byteInn/docs/AGENT_WORKFLOW.md) |
| **Database Operations & Migrations** | [prisma/README.md](file:///Users/apple/Byten/byteInn/prisma/README.md) |
| **Source Organization & API Patterns** | [src/README.md](file:///Users/apple/Byten/byteInn/src/README.md) |

---

## 5. Five-Layer Context Hierarchy & Native Specialist Skills

To prevent token waste and architectural drift, project context is structured into 5 layers:
1. **Layer 1: Global Rules (`AGENTS.md`)**: Mandatory invariants, orchestrator behavior, git safety.
2. **Layer 2: Product Specifications (`docs/`)**: Architecture, database design, API flows, coding standards.
3. **Layer 3: Design System (`docs/UI_UX_GUIDELINES.md`)**: Visual tokens, application shell, component patterns.
4. **Layer 4: Specialist Skills (`.agents/skills/`)**: On-demand procedural runbooks:
   - [`design-system`](file:///Users/apple/Byten/byteInn/.agents/skills/design-system/SKILL.md): Visual design, layout, theme parity, accessibility.
   - [`implement-spec`](file:///Users/apple/Byten/byteInn/.agents/skills/implement-spec/SKILL.md): Spec implementation, modular monolith boundaries, thin route handlers.
   - [`code-review`](file:///Users/apple/Byten/byteInn/.agents/skills/code-review/SKILL.md): Independent diff inspection, severity ranking, invariant checks.
   - [`testing`](file:///Users/apple/Byten/byteInn/.agents/skills/testing/SKILL.md): Node test runner, database fixtures, adversarial coverage.
   - [`diagnosing-bugs`](file:///Users/apple/Byten/byteInn/.agents/skills/diagnosing-bugs/SKILL.md): Minimal reproduction, root-cause isolation, regression prevention.
   - [`security-review`](file:///Users/apple/Byten/byteInn/.agents/skills/security-review/SKILL.md): Auth guards, token cryptography, rate limiting, error masking.
   - [`context-maintenance`](file:///Users/apple/Byten/byteInn/.agents/skills/context-maintenance/SKILL.md): Living documentation synchronization.
   - [`handoff`](file:///Users/apple/Byten/byteInn/.agents/skills/handoff/SKILL.md): Structured engineering summaries for multi-turn sessions.
5. **Layer 5: Task-Specific Context**: Specific files, DTOs, and test suites inspected for the active task.

*Precedence*: Layer 1 (`AGENTS.md`) > Layer 2 (`docs/*`) > Layer 3 (`UI_UX_GUIDELINES.md`) > Layer 4 (`skills/*`) > Layer 5. Approved V1 specifications govern business rules and boundaries.

---

## 6. Design & Implementation Orchestrator Protocol

Every AI agent acts as a senior lead engineer responsible for delivering complete, verified work:
1. **Understand & Inspect**: Review acceptance criteria, inspect relevant files, schemas, and git status.
2. **Map Impact & Invariants**: Trace routes, components, APIs, database models, permissions, and tests.
3. **Plan Non-Trivial Work**: Formulate a concise plan and obtain user approval before modifying code.
4. **Implement in Stages**: Make minimal, coherent edits following modular monolith patterns.
5. **Enforce Gate Verification**: Execute `npm run validate` (`tsc --noEmit`, `eslint`, `npm test`) and `npm run build`. Never claim success without command output.
6. **Produce Concise Handoffs**: Detail what changed, files affected, commands run, and git status.

---

## 7. Living Documentation Protocol
Whenever working on the codebase, follow this engineering loop:

1. **Understand Scope**: Identify task acceptance criteria and verify boundaries against V1 rules.
2. **Consult Authority**: Read the relevant sections of `AGENTS.md` and the designated `docs/*.md` file before coding.
3. **Inspect Active Implementation**: Inspect real files, active types, and schemas rather than assuming docs are always fully up to date.
4. **Make Minimal Changes**: Implement the smallest correct change that satisfies the requirement (minimal diff principle). Never refactor unrelated files.
5. **Update Living Documentation**: Update relevant documentation (`docs/`, `src/README.md`, `prisma/README.md`) when a change alters contracts, schemas, business logic, or implementation phase status. Never claim a feature exists in docs if it is not yet implemented.
6. **Validate Changes**: Run relevant validation checks (`npx prisma validate`, `npx tsc --noEmit`, `npm run build`, `npm run lint`) and inspect the final diff.
7. **Report Accurately**: State what changed, what documentation was updated, what was verified, and any unresolved questions.

---

## 8. Architectural Safeguards & Git Discipline
- **Ambiguities & Conflicts**: If documentation conflicts with active code or requirements are ambiguous, **stop and ask the user** rather than silently inventing business rules or architectural patterns.
- **Git Safety**: Never run destructive Git commands (`git reset --hard`, `git clean -fd`, destructive checkout) that modify git history or discard uncommitted user changes. Never commit, push, merge, or deploy without explicit user approval. Always inspect `git status` before and after operations.
- **Database Rules**: Never use `prisma db push` as a substitute for migrations. Always create and apply versioned Prisma migrations. Always use PostgreSQL `numeric` / Prisma `Decimal` for financial values.
- **Data Operations**: Search, sorting, filtering, and pagination must be handled **backend-first** in the database query via Prisma, never in frontend client memory.

---

## 9. Actionable Coding Standards & Quality Foundation

Every AI agent and software engineer must adhere strictly to the conventions detailed in [docs/CODING_STANDARDS.md](file:///Users/apple/Byten/byteInn/docs/CODING_STANDARDS.md):

1. **Required Verification Command**:
   - Before completing any task, execute:
     ```bash
     npm run validate
     ```
   - This verifies strict TypeScript (`tsc --noEmit`), ESLint rules (`eslint`), and the test suite (`npm test`). All checks must pass with zero errors.

2. **TypeScript & Type Safety**:
   - `any` is strictly prohibited (`@typescript-eslint/no-explicit-any: "error"`). Use explicit domain types, `unknown`, or type guards.
   - Avoid non-null assertions (`!`) and unsafe casts. Use runtime guards and early returns.
   - Explicitly type public API contracts, service signatures, and exported DTOs.
   - Never weaken compiler flags in `tsconfig.json` or rule severity in `eslint.config.mjs` to bypass type or lint errors.

3. **Naming & File Organization**:
   - Variables, functions, and properties: `camelCase`.
   - Components, classes, types, interfaces, enums: `PascalCase`.
   - Constants: `SCREAMING_SNAKE_CASE` (global limits/configs) or `camelCase` (locally scoped).
   - Booleans: descriptive positive prefixes (`isActive`, `hasPermission`, `canCheckOut`).
   - Domain modules strictly located in `src/modules/<feature>/` with standard triple files: `<feature>.service.ts`, `<feature>.types.ts`, `<feature>.validation.ts`.

4. **React & Next.js App Router**:
   - Server Components by default. Use `"use client"` only when interactive state, hooks, or browser APIs are required.
   - Keep UI components focused and thin; extract complex dialogs and table rows into separate focused components.
   - Preserve existing branding, theme tokens, Base UI primitives, and Tailwind CSS v4 styling.

5. **Backend Architecture & Service Boundaries**:
   - Thin Route Handlers: `NextRequest` → `requireAuth(roles)` → Zod validation → Domain Service method → `NextResponse.json()`.
   - Never query Prisma directly inside Route Handlers; keep all database operations in domain services.
   - Enforce authorization exclusively on the server with `requireAuth()`. Never rely on client-side hiding.
   - Never introduce unnecessary abstraction layers (generic repositories, CQRS, external microservices).

6. **Database Integrity & Monetary Precision**:
   - Use PostgreSQL `numeric(10, 2)` and Prisma `Decimal` for all financial figures. Never use JavaScript floating-point arithmetic for currency.
   - Enforce room availability, allocation dates, and double-booking prevention atomically at the database transaction level (`prisma.$transaction`).

7. **Error Handling & Security**:
   - Distinguish client validation (`ZodError` → 400), authentication/authorization (`AuthError` → 401/403), expected business domain errors (400/404), and unhandled server errors (500).
   - Never leak passwords, password hashes, secrets, JWT tokens, or internal stack traces in responses or logs.

8. **Scope Protection & Toolchain Constraints**:
   - Do NOT introduce tRPC, Redux, Zustand, message queues, microservices, or third-party payment gateways.
   - Do NOT install redundant dependencies or linters/formatters.
   - Always read the authoritative feature specification in `docs/` before beginning implementation.
   - Inspect git working state before starting work and preserve all unrelated user changes.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
