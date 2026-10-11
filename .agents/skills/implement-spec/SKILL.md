---
name: implement-spec
description: >-
  Implement an approved feature specification in byteInn without scope creep or
  architectural drift. Use when developing new endpoints, domain services,
  data models, or operational workflows.
---

# byteInn Feature Implementation Skill (`implement-spec`)

## 1. When to Use This Skill
Activate this skill whenever:
- Implementing an approved phase from [docs/byteInn_Implementation_Plan_v1.md](file:///Users/apple/Byten/byteInn/docs/byteInn_Implementation_Plan_v1.md).
- Adding new domain modules, route handlers, database queries, or server-side workflows.
- Translating requirements into production-ready modular-monolith Next.js code.

## 2. Context to Load
Before writing any code:
1. Architectural Boundaries: [docs/byteInn_Architecture_v1.md](file:///Users/apple/Byten/byteInn/docs/byteInn_Architecture_v1.md)
2. Data Contracts & Prisma Schema: [docs/byteInn_Database_Design_v1.md](file:///Users/apple/Byten/byteInn/docs/byteInn_Database_Design_v1.md) and `prisma/schema.prisma`
3. Request Flows & Module Logic: [docs/byteInn_Low_Level_Architecture_v1.md](file:///Users/apple/Byten/byteInn/docs/byteInn_Low_Level_Architecture_v1.md)
4. Coding Standards: [docs/CODING_STANDARDS.md](file:///Users/apple/Byten/byteInn/docs/CODING_STANDARDS.md)

## 3. Mandatory V1 Architectural Invariants
- **Modular Monolith**: All backend code resides in `src/modules/<feature>/` and `src/app/api/...`. No external microservices or background queues.
- **Thin Route Handlers**: NextRequest → `requireAuth(roles)` → Zod parse → Domain Service method → `NextResponse.json()`.
- **Database Encapsulation**: Route handlers MUST NEVER query `prisma` directly. Prisma operations belong strictly in domain services.
- **Monetary Precision**: All currencies use PostgreSQL `numeric(10, 2)` / Prisma `Decimal`. Never use floating-point math.
- **Inclusive/Exclusive Dates**: Stay nights are strictly `[arrivalDate, departureDate)`.
- **Atomic Operations**: Double-booking prevention, room allocation changes, and payments must be enclosed in `prisma.$transaction`.

## 4. Step-by-Step Implementation Flow
1. **Module Scaffolding**:
   Inside `src/modules/<feature>/`:
   - `<feature>.types.ts`: Domain models, DTOs, and interfaces.
   - `<feature>.validation.ts`: Zod schemas with sanitization.
   - `<feature>.service.ts`: Business logic and Prisma transactional execution.
2. **API Route Handler**:
   Inside `src/app/api/<feature>/route.ts`:
   - Authenticate with `await requireAuth([RoleName.RECEPTIONIST, RoleName.ADMIN])`.
   - Validate inputs using Zod schema.
   - Invoke domain service method.
   - Wrap error responses with `handleApiError(error)`.
3. **Frontend Integration**:
   - Create or update thin UI components consuming the API.
   - Ensure backend-first pagination (`paginationQuerySchema`), search, and filtering.
4. **Verification**:
   - Write automated tests in `tests/<feature>.test.ts`.
   - Run `npm run validate`.

## 5. Scope & Safety Constraints
- ❌ Do NOT implement V1.1 features (multi-tenancy, dynamic pricing engines, customer booking portal, payment gateways).
- ❌ Do NOT invent new architectural patterns (generic repositories, Redux, CQRS).
- ❌ Do NOT use `prisma db push` in production-oriented workflows; use versioned migrations.

## 6. Stop & Ask Conditions
Stop and ask for clarification if:
- A specification requirement contradicts existing database invariants.
- A proposed change requires altering established API data contracts consumed across multiple pages.
- Business rules are ambiguous or missing for unexpected edge cases.
