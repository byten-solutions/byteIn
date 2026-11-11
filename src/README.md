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
│   │   ├── rooms/         # Room inventory & status endpoints (/api/rooms, /api/rooms/[id]/status)
│   │   ├── reservations/  # Reservation endpoints (/api/reservations, /api/reservations/[id])
│   │   ├── room-allocations/# Allocation check-in and check-out endpoints
│   │   ├── invoices/      # Billing & payment endpoints (/api/invoices, items, payments, void)
│   │   ├── financial-accounts/# Financial account endpoints (/api/financial-accounts, statements)
│   │   ├── account-transfers/# Fund transfer endpoints (/api/account-transfers)
│   │   ├── payment-methods/  # Payment method endpoints (/api/payment-methods)
│   │   ├── income-heads/     # Income category endpoints (/api/income-heads, seed)
│   │   ├── incomes/          # Direct income & receipts endpoints (/api/incomes, receipts, void)
│   │   ├── expense-heads/    # Expense category endpoints (/api/expense-heads, seed)
│   │   ├── expenses/         # Expense & disbursement endpoints (/api/expenses, payments, void)
│   │   ├── reports/       # Operational & financial reports (/api/reports/occupancy, revenue, reservations, etc.)
│   │   ├── users/         # Staff & user management endpoints (/api/users, /api/users/[id])
│   │   ├── roles/         # Role listing endpoint filtered by actor hierarchy (/api/roles)
│   │   └── health/        # Public container & database healthcheck probe (/api/health)
│   ├── categories/        # Room Categories & Setup view (/categories)
│   ├── rooms/             # Room Inventory & Status Board (/rooms)
│   ├── reservations/      # Reservation list, detail, and booking view (/reservations)
│   ├── billing/           # Invoices, payments, receipts, and print views (/billing)
│   ├── finance/           # Financial Management: Accounts, Transfers, Income, Expenses (/finance)
│   ├── reports/           # Dedicated Operational & Financial Reports view (/reports)
│   ├── users/             # Staff & User Management view (/users)
│   ├── login/             # Login view (/login)
│   ├── globals.css        # Tailwind CSS v4 styling & shadcn design tokens
│   ├── layout.tsx         # Root HTML layout and font definitions
│   └── page.tsx           # Role-based dashboard (Platform overview for Super Admin, Reception Dispatch for Hotel Staff)
├── components/            # UI Components
│   ├── app-shell.tsx      # Application layout shell (desktop sidebar + mobile drawer)
│   ├── app-sidebar.tsx    # Collapsible sidebar with role-aware navigation groups
│   ├── app-header.tsx     # Top header bar with hotel context badge and quick stats
│   ├── logo.tsx           # Brand Logo component
│   ├── nav-user.tsx       # User profile dropdown with role badge & hotel assignment
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
│   ├── users/             # UserService, user management, and validation schemas
│   ├── properties/        # PropertyService, validations, and types
│   ├── rooms/             # RoomService, RoomCategoryService, AmenityService, and validations
│   ├── reservations/      # ReservationService, validations, and types
│   ├── billing/           # BillingService, invoice calculation, receipts, and validations
│   ├── financial-accounts/# FinancialAccountService, AccountTransferService, types, validations
│   ├── income/            # IncomeService, IncomeHeadService, types, validations
│   ├── expenses/          # ExpenseService, ExpenseHeadService, types, validations
│   ├── payment-methods/   # PaymentMethodService, types, validations
│   └── reports/           # ReportsService (Daily Operations, Availability Tape Chart, Shift Collections, Receivables Aging, Occupancy, ADR, RevPAR, Revenue)
└── README.md              # Source architecture guide
```

---

## 2. API Architecture & Routing Conventions

The backend API is implemented as **Next.js App Router Route Handlers** within the unified application:

- **Route Location**: `src/app/api/<feature>/route.ts` (e.g., `src/app/api/reservations/route.ts`).
- **Reports Endpoints**:
  - `GET /api/reports/daily-operations?date=YYYY-MM-DD`: Arrivals (with balances), Departures (balance due), In-House guests, Overdue check-ins.
  - `GET /api/reports/availability-grid?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`: Room-by-date tape chart matrix with booked/vacant/maintenance slots.
  - `GET /api/reports/collections?date=YYYY-MM-DD&staffUserId=...`: Cash drawer and shift collection reconciliation split by payment method and staff.
  - `GET /api/reports/receivables?filter=all|in_house|departed`: Outstanding balances with 0-7d, 8-30d, 31-60d, 60d+ aging buckets and debtor list.
  - `GET /api/reports/occupancy?startDate=...&endDate=...`: Occupancy %, total room revenue, ADR, RevPAR, and room category performance.
  - `GET /api/reports/revenue?startDate=...&endDate=...`: Room charges, extra charges, taxes, discounts, net invoiced vs collected.
  - `GET /api/reports/reservations?startDate=...&endDate=...`: Status distribution, total allocations, and average stay length.
- **Financial Management Endpoints**:
  - `GET, POST /api/financial-accounts`: List accounts (with dynamic balances) and create new liquid accounts.
  - `GET /api/financial-accounts/[id]/statement?startDate=...&endDate=...`: Itemized account ledger statement.
  - `GET, POST /api/account-transfers`: List and execute double-entry atomic internal fund transfers.
  - `GET, POST /api/payment-methods`: List and manage payment methods with default account mappings.
  - `GET, POST /api/income-heads`, `POST /api/income-heads/seed`: Income category heads and seeding defaults.
  - `GET, POST /api/incomes`: List and record direct hotel revenue items.
  - `POST /api/incomes/[id]/receipts`: Record inward payment receipts against direct income with idempotency.
  - `POST /api/incomes/[id]/receipts/[receiptId]/void`: Void individual receipts and reverse account balances.
  - `POST /api/incomes/[id]/void`: Void direct income (guarded by zero-active-receipts rule).
  - `GET, POST /api/expense-heads`, `POST /api/expense-heads/seed`: Expense category heads and seeding 6 approved defaults.
  - `GET, POST /api/expenses`: List and record operational expenses.
  - `POST /api/expenses/[id]/payments`: Disburse expense payments with overdraft protection and idempotency race recovery.
  - `POST /api/expenses/[id]/payments/[paymentId]/void`: Void individual disbursement and restore account balance.
  - `POST /api/expenses/[id]/void`: Void expense (guarded by zero-active-payments rule).
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
