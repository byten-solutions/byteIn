# Source Code Architecture & Guidelines

This directory contains the primary application codebase for **byteInn**.

---

## 1. Directory Structure

```text
src/
├── app/                   # Next.js App Router (Pages, Layouts, API Route Handlers)
│   ├── api/               # REST API Route Handlers
│   │   ├── auth/          # Authentication endpoints (/api/auth/login, /logout, /me, /verify-role)
│   │   ├── properties/    # Property & building endpoints (/api/properties, /api/properties/[id]/buildings)
│   │   ├── buildings/     # Building & floor endpoints (/api/buildings/[id]/floors)
│   │   ├── room-categories/# Category endpoints (/api/room-categories, /api/room-categories/[id])
│   │   ├── amenities/     # Amenity endpoints (/api/amenities)
│   │   └── rooms/         # Room inventory & status endpoints (/api/rooms, /api/rooms/[id]/status)
│   ├── categories/        # Room Categories & Setup view (/categories)
│   ├── rooms/             # Room Inventory & Status Board (/rooms)
│   ├── login/             # Login view (/login)
│   ├── globals.css        # Tailwind CSS v4 styling & shadcn design tokens
│   ├── layout.tsx         # Root HTML layout and font definitions
│   └── page.tsx           # Application reception dashboard view
├── components/            # UI Components
│   ├── app-shell.tsx      # Application layout shell (desktop sidebar + mobile drawer)
│   ├── app-sidebar.tsx    # Collapsible sidebar with navigation groups
│   ├── app-header.tsx     # Top header bar with quick stats and theme toggle
│   ├── logo.tsx           # Brand Logo component
│   ├── sign-out-button.tsx# Client sign-out button component
│   ├── ui-kit/            # Reusable UI kit (PageHeader, StatusBadge, DataTableShell, EmptyState, etc.)
│   └── ui/                # Installed shadcn/ui primitives (button, card, input, label, badge, dialog, etc.)
├── lib/                   # Shared singletons and low-level helpers
│   ├── auth-guard.ts      # Server authentication and role authorization guards
│   ├── prisma.ts          # Global PrismaClient singleton instance
│   ├── session.ts         # Session cookie serialization and parsing helpers
│   └── utils.ts           # Class merge helper (cn)
├── modules/               # Domain services and business logic
│   ├── auth/              # AuthService, validation schemas, and types
│   ├── properties/        # PropertyService, validations, and types
│   └── rooms/             # RoomService, RoomCategoryService, AmenityService, and validations
└── README.md              # Source architecture guide
```

---

## 2. API Architecture & Routing Conventions

The backend API is implemented as **Next.js App Router Route Handlers** within the unified application:

- **Route Location**: `src/app/api/<feature>/route.ts` (e.g., `src/app/api/reservations/route.ts`).
- **Thin Route Handlers**: Route handlers are strictly responsible for:
  1. Extracting and validating request parameters / JSON payloads.
  2. Verifying user authentication and role authorization (`ADMIN` vs `RECEPTIONIST`).
  3. Delegating business logic to domain service functions.
  4. Returning standard HTTP status codes and JSON responses.
- **Domain Services (`src/modules/<feature>/`)**: All business rules, transaction orchestration, status transition logic, and database operations belong in service functions, not inside route handler files.

---

## 3. Next.js Client vs Server Component Boundaries

- **Server Components by Default**: All components in `src/app/` are React Server Components unless explicitly marked otherwise. Use Server Components for data fetching, static presentation, and non-interactive layout structures.
- **Client Components (`"use client"`)**: Apply `"use client"` at the top of the file only when client-side interactivity is strictly required:
  - Interactive event handlers (`onClick`, `onSubmit`, `onChange`).
  - React client hooks (`useState`, `useEffect`, `useReducer`, `useRef`).
  - Form state management and browser-only APIs.
- Keep Client Components as leaf nodes to preserve Server Component streaming and performance benefits.

---

## 4. Backend-First Data Operations

All data query operations must be **database-first**:

- **Pagination**: Use Prisma `skip` and `take` in the API service. Never fetch the entire dataset to paginate on the frontend.
- **Filtering & Search**: Pass search terms and filter criteria (guest name, room number, date range) directly to Prisma `where` clauses.
- **Sorting**: Execute sorting via Prisma `orderBy` in the database query.
- **Date Ranges**: Reservation date checks (`arrival_date` inclusive, `departure_date` exclusive) must be evaluated in PostgreSQL query logic.

---

## 5. Verification & Testing

Run these verification commands before completing any code changes:

```bash
# 1. Type-check all TypeScript files
npx tsc --noEmit

# 2. Run ESLint checks
npm run lint

# 3. Verify production Next.js build
npm run build
```

---

## 6. Cross-Module Change Protocol

Before modifying any shared component, utility (`src/lib`), API route, or service:

1. **Inspect Callers**: Search across the codebase for all references to the affected function, type, or component.
2. **Preserve Contracts**: Maintain backwards compatibility for existing API endpoints and request/response shapes.
3. **Update Living Documentation**: If a change modifies public interfaces, contracts, or data flow, update the relevant section in [docs/byteInn_Low_Level_Architecture_v1.md](file:///Users/apple/Byten/byteInn/docs/byteInn_Low_Level_Architecture_v1.md) or this README.
