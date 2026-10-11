# byteInn — Coding Standards & Quality Foundation

This document defines the enforceable engineering standards and quality foundations for the byteInn Property Management System (PMS). Inspired by the simplicity and type safety of [create-t3-app](https://github.com/t3-oss/create-t3-app), the maintainability of the [Vercel Style Guide](https://github.com/vercel/style-guide), and idiomatic [Next.js App Router patterns](https://github.com/vercel/next.js).

---

## 1. Guiding Principles

1. **Simplicity Over Abstraction**: Prefer direct, transparent TypeScript and idiomatic Next.js patterns over premature abstractions, generic repository layers, or complex state libraries.
2. **Lean Dependency Footprint**: Rely on the approved, existing toolchain (Next.js 16, React 19, Tailwind CSS v4, Base UI / shadcn/ui, Prisma, Zod, Jose, bcryptjs). Do not introduce tRPC, Redux, Zustand, external state managers, or new runtime dependencies without explicit approval.
3. **End-to-End Type Safety**: Treat types as reliable contracts from database schema to API routes to frontend presentation.
4. **Data Integrity First**: Database constraints, atomic transactions, fixed-precision monetary decimals, and server-side authorization guarantee business invariants—never client-side code alone.
5. **Proportional Changes**: Follow the minimal-diff principle. Never rewrite or refactor working modules merely to satisfy stylistic preferences.

---

## 2. Toolchain & Enforceable Commands

Code quality is enforced programmatically via package scripts:

| Command | Purpose | When to Run |
| :--- | :--- | :--- |
| `npm run typecheck` | Strict TypeScript compiler validation (`tsc --noEmit`) | Pre-commit / Pre-completion |
| `npm run lint` | ESLint rules check (`eslint`) | Pre-commit / Pre-completion |
| `npm run format:check`| Verifies Prettier code formatting without writing | CI / Quality checks |
| `npm run format` | Applies Prettier code formatting to staged/targeted files | Code authoring |
| `npm test` | Runs the test suite via Node test runner (`tsx --test tests/**/*.test.ts`) | Pre-completion |
| `npm run validate` | Runs `typecheck`, `lint`, and `test` sequentially | **Mandatory** before concluding any task |
| `npm run build` | Builds the Next.js production bundle | Pre-deployment verification |

---

## 3. TypeScript Standards

The project uses `"strict": true` in `tsconfig.json`.

### 3.1 Strict Typing & No `any`
- Explicit `any` is strictly banned (`@typescript-eslint/no-explicit-any: "error"`).
- Use proper domain types, Prisma-generated types, explicit interfaces, or `unknown` when types are truly unverified.
- When catching errors, use `catch (error: unknown)` and narrow the type before accessing properties:
  ```typescript
  // ✅ DO: Type narrowing for unknown errors
  try {
    // ...
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // ❌ DON'T: Cast to any
  try {
    // ...
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  ```

### 3.2 Avoid Unsafe Assertions
- Avoid non-null assertions (`!`) and double assertions (`as unknown as T`).
- Verify presence with explicit runtime guards or early returns:
  ```typescript
  // ✅ DO: Explicit guard
  const allocation = reservation.rooms[0];
  if (!allocation) {
    throw new Error("Reservation has no room allocations");
  }

  // ❌ DON'T: Non-null assertion
  const allocation = reservation.rooms[0]!;
  ```

### 3.3 Explicit Boundaries, Inferred Locals
- Public API request/response types, service method signatures, and exported utility functions must have explicit return and parameter types.
- Local variables within function bodies should leverage TypeScript's type inference to reduce visual clutter.

### 3.4 Discriminated Unions & Result Types
- Use discriminated unions for modeling multi-state operations (e.g., invoice statuses, allocation states, or service operation results):
  ```typescript
  // ✅ DO: Discriminated union for operation results
  export type AllocationResult =
    | { success: true; allocation: RoomAllocationDTO }
    | { success: false; reason: "CONFLICT" | "NOT_FOUND" | "INVALID_STATUS"; message: string };
  ```

---

## 4. Naming & Code Organization

### 4.1 Naming Conventions
- **Variables, functions, object properties, and methods**: `camelCase` (e.g., `calculateNights`, `bookedNightlyRate`).
- **React components, types, interfaces, enums, classes**: `PascalCase` (e.g., `InvoiceDetailView`, `SessionPayload`, `RoomService`).
- **Constants**: `SCREAMING_SNAKE_CASE` for global constants/configuration limits (e.g., `SESSION_DURATION_SECONDS`, `DEFAULT_PAGE_SIZE`).
- **Boolean variables**: Must use positive, natural phrasing (e.g., `isActive`, `hasPermission`, `canCheckOut`, `isDirty`). Avoid double negatives like `isNotAvailable`.
- **Descriptive Names**: Prefer clear domain terms over abbreviations (e.g., `reservation`, `allocation`, `customer` rather than `res`, `alloc`, `cust`).

### 4.2 File & Directory Structure
```
src/
├── app/                        # Next.js App Router (pages and API routes)
│   ├── api/                    # Thin HTTP route handlers (GET, POST, PATCH, etc.)
│   │   ├── auth/
│   │   ├── reservations/
│   │   └── ...
│   ├── reservations/           # Page routes (layout.tsx, page.tsx, client views)
│   └── ...
├── components/                 # Reusable UI components
│   ├── ui/                     # shadcn/ui & Base UI primitives (button, dialog, card)
│   └── navbar.tsx              # Application shell components
├── lib/                        # Core infrastructural utilities
│   ├── auth-guard.ts           # Route authentication & role enforcement
│   ├── prisma.ts               # Prisma ORM singleton instance
│   ├── session.ts              # Stateless JWT cookie management
│   └── utils.ts                # Styling utilities (cn)
└── modules/                    # Modular Monolith Domain Services
    ├── auth/                   # auth.service.ts, auth.types.ts, auth.validation.ts
    ├── billing/                # billing.service.ts, billing.types.ts, billing.validation.ts
    ├── check-in-out/
    ├── customers/
    ├── properties/
    ├── reservations/
    └── rooms/
```

- Each domain module in `src/modules/<name>/` strictly groups:
  - `<name>.service.ts`: Business logic, transactional workflows, Prisma operations.
  - `<name>.types.ts`: DTOs, domain models, enum aliases, input/output types.
  - `<name>.validation.ts`: Zod schemas for input validation.

---

## 5. React & Next.js App Router Conventions

### 5.1 Server Components by Default
- In Next.js App Router, pages (`page.tsx`) and layouts (`layout.tsx`) are Server Components by default.
- Keep them as Server Components whenever possible. They can fetch initial data, read session cookies, or set up page structure.
- Only mark components with `"use client"` when they require:
  - Browser APIs (window, localStorage, history).
  - React hooks (`useState`, `useEffect`, `useCallback`, `useTransition`).
  - Interactive event handlers (`onClick`, `onSubmit`, `onChange`).

### 5.2 Component Separation of Concerns
- Page components (`page.tsx`) act as route coordinators.
- Interactive client components (e.g., `new-reservation-form.tsx`, `room-manager.tsx`) encapsulate user interactions and local UI state.
- Keep components focused and readable (typically < 350 lines). Extract self-contained dialogs, rows, or summary cards into separate component files within the feature folder.
- Keep business invariants and domain rules on the server—frontend validation is strictly for user feedback, never system enforcement.

### 5.3 UI Styling & Design Tokens
- Style using Tailwind CSS v4 and the established design tokens (`var(--background)`, `var(--primary)`, `var(--border)`, etc.).
- Use the `cn(...)` utility (`clsx` + `tailwind-merge`) for conditional class composition.
- Preserve the existing warm, professional hospitality aesthetic and brand tokens.

---

## 6. Backend & Application Architecture

byteInn strictly adheres to a **Modular Monolith** architecture within Next.js:

```
[HTTP Request]
       │
       ▼
[Next.js Route Handler]  (src/app/api/.../route.ts)
  • requireAuth(allowedRoles)
  • Zod schema validation
  • Call domain service
       │
       ▼
[Domain Service]         (src/modules/.../*.service.ts)
  • Business invariants
  • Atomic transactions (tx)
  • Decimal financial math
       │
       ▼
[Prisma ORM Client]      (src/lib/prisma.ts)
       │
       ▼
[PostgreSQL Database]
```

### 6.1 Thin Route Handlers
Route handlers MUST remain thin. Their sole responsibilities are:
1. Verify authentication and role authorization via `await requireAuth(...)`.
2. Parse and validate the incoming request using the appropriate Zod schema.
3. Call the domain service method.
4. Catch errors and return standardized JSON responses.

```typescript
// ✅ DO: Thin Route Handler pattern
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth([RoleName.ADMIN, RoleName.RECEPTIONIST]);
    const body = await req.json();
    const validated = createReservationSchema.parse(body);

    const reservation = await ReservationService.createReservation(validated, session.userId);
    return NextResponse.json({ success: true, reservation }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to create reservation";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

### 6.2 Domain Services Contain All Business Logic
- Never query Prisma directly inside Route Handlers or Server Actions.
- Place all database access, queries, transactions, and domain rules inside `src/modules/<feature>/<feature>.service.ts`.
- Avoid creating generic repositories, arbitrary abstraction layers, or microservice adapters.

### 6.3 Server-Side Authorization
- Authorization must ALWAYS be enforced on the server via `requireAuth([RoleName.ADMIN, ...])`.
- Never rely on hiding buttons or conditional UI rendering as a security control.

---

## 7. Database & Monetary Integrity

### 7.1 Monetary Precision (Prisma Decimal)
- **Zero Floating-Point Financials**: Floating-point math (`0.1 + 0.2 !== 0.3`) causes rounding discrepancies and financial corruption.
- All monetary fields in PostgreSQL use `numeric(10, 2)` and in Prisma use `Prisma.Decimal`.
- In services, perform all calculations using Prisma Decimal methods:
  ```typescript
  // ✅ DO: Fixed-precision decimal arithmetic
  const unitPrice = new Prisma.Decimal(alloc.bookedNightlyRate);
  const lineTotal = unitPrice.mul(nights);
  subtotal = subtotal.add(lineTotal);
  const grandTotal = Prisma.Decimal.max(new Prisma.Decimal(0), subtotal.sub(discount).add(tax));

  // ❌ DON'T: Floating-point arithmetic
  const lineTotal = alloc.bookedNightlyRate * nights;
  ```

### 7.2 Concurrency & Double-Booking Prevention
- Overlapping room allocation conflicts must be checked and committed atomically inside a Prisma transaction (`prisma.$transaction(async (tx) => { ... })`).
- Frontend availability checks are convenience hints; the database transaction is the sole authoritative barrier.

### 7.3 Room Lifecycle Invariants
- Physical room statuses (`VACANT_CLEAN`, `VACANT_DIRTY`, `OCCUPIED`, `MAINTENANCE`, `OUT_OF_SERVICE`) model physical condition, not reservation dates.
- Check-in transitions room to `OCCUPIED`.
- Check-out strictly transitions room to `VACANT_DIRTY` (requiring housekeeping inspection before returning to `VACANT_CLEAN`).

### 7.4 Versioned Migrations
- Never run `prisma db push` on staging/production environments.
- Always generate and apply versioned migrations (`npx prisma migrate dev`).

---

## 8. Error Handling, Logging & Security

### 8.1 Error Classification
- **401 Unauthorized**: Missing or expired session cookie.
- **403 Forbidden**: Valid session, but user role lacks permission for the requested action.
- **400 Bad Request**: Validation failure (ZodError) or expected business rule violation (e.g., room occupied, dates inverted, invoice already issued).
- **404 Not Found**: Target resource does not exist.
- **500 Internal Server Error**: Unexpected runtime faults. Always log details internally; never expose stack traces or raw database queries to the client.

### 8.2 Structured Logging & Information Protection
- Production code must use `console.warn` or `console.error` for actionable operational events.
- Never log passwords, password hashes, JWT secrets, raw session tokens, or sensitive guest identifiers.
- CLI scripts (such as `prisma/seed.ts`) are exempted from standard web logging constraints.

---

## 9. Testing & Quality Verification

- Unit and integration tests reside in `tests/<feature>.test.ts`.
- Tests run via Node's native test runner (`tsx --test tests/**/*.test.ts`).
- Any PR or feature implementation must:
  1. Add tests covering both the happy path and critical boundary/error conditions.
  2. Maintain 100% passing tests across the entire test suite.
  3. Run `npm run validate` and verify zero errors before reporting completion.
