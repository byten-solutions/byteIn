# byteInn PMS — Comprehensive UI/UX Frontend Audit

> **Document Version**: 1.0.0  
> **Target Audience**: UI/UX Designers, Product Architects, Lead Frontend Engineers  
> **Audit Type**: Read-Only Architecture, Interaction, Layout & Content Audit  
> **Application**: byteInn PMS (Internal Reception-Operated Property Management System)  
> **Output Target**: `/Users/apple/Byten/byteInn/UI_AUDIT.md`  

---

## Table of Contents

1. [PART 1: Tech and Design System](#part-1-tech-and-design-system)
   - [1.1 Frontend Framework and Library Versions](#11-frontend-framework-and-library-versions)
   - [1.2 Design Tokens and Styling Architecture](#12-design-tokens-and-styling-architecture)
   - [1.3 shadcn/ui Component Inventory](#13-shadcnui-component-inventory)
   - [1.4 Custom Shared Components](#14-custom-shared-components)
   - [1.5 Layout Architecture and Application Shell](#15-layout-architecture-and-application-shell)
   - [1.6 Theme Handling and Dark Mode Engine](#16-theme-handling-and-dark-mode-engine)
2. [PART 2: Routes and Pages](#part-2-routes-and-pages)
   - [2.1 Comprehensive Application Route Map](#21-comprehensive-application-route-map)
   - [2.2 Overview / Dashboard (`/`)](#22-overview--dashboard-)
   - [2.3 Staff Authentication (`/login`)](#23-staff-authentication-login)
   - [2.4 Reservations Registry (`/reservations`)](#24-reservations-registry-reservations)
   - [2.5 New Reservation Wizard (`/reservations/new`)](#25-new-reservation-wizard-reservationsnew)
   - [2.6 Reservation Details & Operations (`/reservations/[id]`)](#26-reservation-details--operations-reservationsid)
   - [2.7 Billing & Invoices Ledger (`/billing`)](#27-billing--invoices-ledger-billing)
   - [2.8 Invoice Details, Charges & Payments Hub (`/billing/[id]`)](#28-invoice-details-charges--payments-hub-billingid)
   - [2.9 Guest Directory (`/customers`)](#29-guest-directory-customers)
   - [2.10 Guest Profile & Booking History (`/customers/[id]`)](#210-guest-profile--booking-history-customersid)
   - [2.11 Room Inventory & Maintenance Board (`/rooms`)](#211-room-inventory--maintenance-board-rooms)
   - [2.12 Categories & Amenities Setup (`/categories`)](#212-categories--amenities-setup-categories)
3. [PART 3: Forms and Workflows](#part-3-forms-and-workflows)
   - [3.1 Staff Login Form](#31-staff-login-form)
   - [3.2 Multi-Room Reservation Booking Form](#32-multi-room-reservation-booking-form)
   - [3.3 Guest Registration Form](#33-guest-registration-form)
   - [3.4 Guest Profile Edit Form](#34-guest-profile-edit-form)
   - [3.5 Physical Room Creation / Edit Form](#35-physical-room-creation--edit-form)
   - [3.6 Operational Room Status Transition Form](#36-operational-room-status-transition-form)
   - [3.7 Add Extra Invoice Charge Form](#37-add-extra-invoice-charge-form)
   - [3.8 Record Invoice Payment Form](#38-record-invoice-payment-form)
   - [3.9 Room Category Creation / Edit Form](#39-room-category-creation--edit-form)
   - [3.10 Amenity Creation Form](#310-amenity-creation-form)
   - [3.11 Room Allocation Check-In Form](#311-room-allocation-check-in-form)
   - [3.12 Room Allocation Check-Out Form](#312-room-allocation-check-out-form)
   - [3.13 Deep-Dive: The Complete Multi-Room Booking Flow](#313-deep-dive-the-complete-multi-room-booking-flow)
4. [PART 4: Data and Business Rules](#part-4-data-and-business-rules)
   - [4.1 Prisma Schema Models and Domain Enums](#41-prisma-schema-models-and-domain-enums)
   - [4.2 Backend API Endpoint Index](#42-backend-api-endpoint-index)
   - [4.3 Enforced Invariants and Business Logic](#43-enforced-invariants-and-business-logic)
   - [4.4 Client-Side and UI-Derived Computations](#44-client-side-and-ui-derived-computations)
5. [PART 5: Content Inventory](#part-5-content-inventory)
6. [PART 6: UX Problems and Friction Points in the Code](#part-6-ux-problems-and-friction-points-in-the-code)
7. [PART 7: Assets, Configuration and Constraints](#part-7-assets-configuration-and-constraints)

---

# PART 1: TECH AND DESIGN SYSTEM

### 1.1 Frontend Framework and Library Versions

The frontend stack uses the Next.js 16 App Router, React 19, and Tailwind CSS v4.

| Capability | Package / Technology | Version | Location / Config File |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | `16.4.0` | [`package.json`](file:///Users/apple/Byten/byteInn/package.json) |
| **Core UI Runtime** | React & React DOM | `19.3.0` | [`package.json`](file:///Users/apple/Byten/byteInn/package.json) |
| **Language** | TypeScript (Strict Mode) | `^5` | [`tsconfig.json`](file:///Users/apple/Byten/byteInn/tsconfig.json) |
| **CSS Framework** | Tailwind CSS v4 with `@tailwindcss/postcss` | `^4` | [`package.json`](file:///Users/apple/Byten/byteInn/package.json), [`src/app/globals.css`](file:///Users/apple/Byten/byteInn/src/app/globals.css) |
| **Design System** | shadcn/ui CLI | `^4.21.4` | [`package.json`](file:///Users/apple/Byten/byteInn/package.json) |
| **Headless Primitives** | Base UI (`@base-ui/react`) | `^1.9.0` | Used in shadcn buttons, dialogs, inputs, tabs |
| **Class Composition** | `class-variance-authority` (cva) | `^0.7.1` | Used across `components/ui/*` |
| **Class Merging Utility** | `cn` package | `^0.4.0` | Re-exported via [`src/lib/utils.ts`](file:///Users/apple/Byten/byteInn/src/lib/utils.ts) |
| **Animations** | `tw-animate-css` | `^1.4.0` | Imported in [`src/app/globals.css`](file:///Users/apple/Byten/byteInn/src/app/globals.css) |
| **Icon Library** | `lucide-react` | `^1.55.0` | Exclusively used across all components and pages |
| **Form Library** | *None* (Native controlled inputs) | Native React state | Uncontrolled/controlled HTML `<form>`, `<input>`, `<select>` |
| **Validation Library** | `zod` | `^4.6.5` | Validates API inputs and DTO contracts |
| **State / Data Fetching** | *None* (Native `fetch` + `useState`/`useEffect`) | Browser Native | No React Query, SWR, Zustand, or Redux |
| **Table Library** | *None* (Custom shadcn HTML `<table>` wrapper) | Custom components | [`src/components/ui/table.tsx`](file:///Users/apple/Byten/byteInn/src/components/ui/table.tsx) |
| **Date Library** | *None* (Native JavaScript `Date` API) | Native JavaScript | ISO strings, `toLocaleDateString()`, UTC slicing |
| **Toast / Notification** | *None* (In-card inline alert banners) | Custom UI | Inline alerts (`bg-destructive/10`, `bg-emerald-500/10`) |
| **Theme Management** | `next-themes` | `^0.4.6` | [`src/components/theme-provider.tsx`](file:///Users/apple/Byten/byteInn/src/components/theme-provider.tsx) |

---

### 1.2 Design Tokens and Styling Architecture

#### Complete Global CSS Variables (`src/app/globals.css`)

All color tokens are declared in the modern OKLCH color space with inline Tailwind theme mapping:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
    --font-heading: var(--font-sans);
    --font-sans: var(--font-sans);
    --color-sidebar-ring: var(--sidebar-ring);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar: var(--sidebar);
    --color-chart-5: var(--chart-5);
    --color-chart-4: var(--chart-4);
    --color-chart-3: var(--chart-3);
    --color-chart-2: var(--chart-2);
    --color-chart-1: var(--chart-1);
    --color-ring: var(--ring);
    --color-input: var(--input);
    --color-border: var(--border);
    --color-destructive: var(--destructive);
    --color-accent-foreground: var(--accent-foreground);
    --color-accent: var(--accent);
    --color-muted-foreground: var(--muted-foreground);
    --color-muted: var(--muted);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-secondary: var(--secondary);
    --color-primary-foreground: var(--primary-foreground);
    --color-primary: var(--primary);
    --color-popover-foreground: var(--popover-foreground);
    --color-popover: var(--popover);
    --color-card-foreground: var(--card-foreground);
    --color-card: var(--card);
    --color-foreground: var(--foreground);
    --color-background: var(--background);
    --radius-sm: calc(var(--radius) * 0.6);
    --radius-md: calc(var(--radius) * 0.8);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) * 1.4);
    --radius-2xl: calc(var(--radius) * 1.8);
    --radius-3xl: calc(var(--radius) * 2.2);
    --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.555 0.163 48.998);
    --primary-foreground: oklch(0.987 0.022 95.277);
    --secondary: oklch(0.967 0.001 286.375);
    --secondary-foreground: oklch(0.21 0.006 285.885);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.708 0 0);
    --chart-1: oklch(0.879 0.169 91.605);
    --chart-2: oklch(0.769 0.188 70.08);
    --chart-3: oklch(0.666 0.179 58.318);
    --chart-4: oklch(0.555 0.163 48.998);
    --chart-5: oklch(0.473 0.137 46.201);
    --radius: 0.625rem;
    --sidebar: oklch(0.985 0 0);
    --sidebar-foreground: oklch(0.145 0 0);
    --sidebar-primary: oklch(0.666 0.179 58.318);
    --sidebar-primary-foreground: oklch(0.987 0.022 95.277);
    --sidebar-accent: oklch(0.97 0 0);
    --sidebar-accent-foreground: oklch(0.205 0 0);
    --sidebar-border: oklch(0.922 0 0);
    --sidebar-ring: oklch(0.708 0 0);
}

.dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.473 0.137 46.201);
    --primary-foreground: oklch(0.987 0.022 95.277);
    --secondary: oklch(0.274 0.006 286.033);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
    --chart-1: oklch(0.879 0.169 91.605);
    --chart-2: oklch(0.769 0.188 70.08);
    --chart-3: oklch(0.666 0.179 58.318);
    --chart-4: oklch(0.555 0.163 48.998);
    --chart-5: oklch(0.473 0.137 46.201);
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.769 0.188 70.08);
    --sidebar-primary-foreground: oklch(0.279 0.077 45.635);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  button:not(:disabled), [role="button"]:not(:disabled) {
    cursor: pointer;
  }
  html {
    @apply font-sans;
  }
}
```

#### Typography and Font Setup (`src/app/layout.tsx`)

The system loads Google Fonts through `next/font/google`:
- **Sans Serif / Body / Headings**: `Inter({ subsets: ["latin"], variable: "--font-sans" })`
- **Monospace / Financials / Codes**: `Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })`
- Base border radius: `var(--radius)` = `0.625rem` (10px).

---

### 1.3 shadcn/ui Component Inventory

All primitive components reside in `src/components/ui/` and leverage `@base-ui/react`:

| Component | File Path | Exported Primitives / Variants | Where Used in Codebase |
| :--- | :--- | :--- | :--- |
| **Badge** | [`src/components/ui/badge.tsx`](file:///Users/apple/Byten/byteInn/src/components/ui/badge.tsx) | `Badge`, `badgeVariants`: `default`, `secondary`, `destructive`, `outline`, `ghost`, `link` | Navigation, reservation lists, room status pills, guest stays count, invoice status |
| **Button** | [`src/components/ui/button.tsx`](file:///Users/apple/Byten/byteInn/src/components/ui/button.tsx) | `Button`, `buttonVariants`: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`. Sizes: `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg` | Forms, dialog headers, pagination bars, filter bars, theme switcher, actions |
| **Card** | [`src/components/ui/card.tsx`](file:///Users/apple/Byten/byteInn/src/components/ui/card.tsx) | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction` | KPI summary cards, overview widgets, forms, detail screens |
| **Dialog** | [`src/components/ui/dialog.tsx`](file:///Users/apple/Byten/byteInn/src/components/ui/dialog.tsx) | `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose` | Check-in dialog, check-out dialog, add/edit room dialog, category dialog, amenity dialog, register guest dialog |
| **Input** | [`src/components/ui/input.tsx`](file:///Users/apple/Byten/byteInn/src/components/ui/input.tsx) | `Input` (wraps Base UI input primitive with focus rings and disabled styling) | All search bars, text/number inputs, date pickers |
| **Label** | [`src/components/ui/label.tsx`](file:///Users/apple/Byten/byteInn/src/components/ui/label.tsx) | `Label` (accessible label with disabled peer styling) | All forms across reservations, customers, rooms, and categories |
| **Table** | [`src/components/ui/table.tsx`](file:///Users/apple/Byten/byteInn/src/components/ui/table.tsx) | `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption` | Reservations list, guest directory, guest detail reservation history |
| **Tabs** | [`src/components/ui/tabs.tsx`](file:///Users/apple/Byten/byteInn/src/components/ui/tabs.tsx) | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `tabsListVariants` | Scaffolded in ui directory (ready for sub-views) |
| **Textarea** | [`src/components/ui/textarea.tsx`](file:///Users/apple/Byten/byteInn/src/components/ui/textarea.tsx) | `Textarea` (autosizing with `field-sizing-content` fallback) | Special requests, guest notes, room maintenance remarks |

---

### 1.4 Custom Shared Components

Located in `src/components/`:

| Component | File Path | Props Signature | Purpose & Where Used |
| :--- | :--- | :--- | :--- |
| **AppShell** | [`src/components/app-shell.tsx`](file:///Users/apple/Byten/byteInn/src/components/app-shell.tsx) | `{ session: SessionPayload \| null; stats?: { cleanRooms?: number; dirtyRooms?: number }; children: ReactNode }` | Wraps all pages with the responsive desktop sidebar, mobile drawer, sticky header, and persistent layout container. |
| **AppSidebar** | [`src/components/app-sidebar.tsx`](file:///Users/apple/Byten/byteInn/src/components/app-sidebar.tsx) | `{ className?: string; onNavigate?: () => void; session?: SessionPayload \| null; forceExpanded?: boolean }` | Collapsible sidebar with navigation groups, station indicator, and bottom user account popover. |
| **AppHeader** | [`src/components/app-header.tsx`](file:///Users/apple/Byten/byteInn/src/components/app-header.tsx) | `{ session: SessionPayload \| null; stats?: { cleanRooms?: number; dirtyRooms?: number } }` | Top navigation bar with page title, sidebar toggle triggers, room status pill counters, and theme toggle. |
| **NavUser** | [`src/components/nav-user.tsx`](file:///Users/apple/Byten/byteInn/src/components/nav-user.tsx) | `{ session: SessionPayload; isCollapsed?: boolean }` | Bottom user menu in the sidebar following the shadcn NavUser pattern with role badge and sign-out button. |
| **ProfileMenu** | [`src/components/profile-menu.tsx`](file:///Users/apple/Byten/byteInn/src/components/profile-menu.tsx) | `{ session: SessionPayload }` | Legacy floating profile menu; retained as an alternative user widget. |
| **SidebarContext** | [`src/components/sidebar-context.tsx`](file:///Users/apple/Byten/byteInn/src/components/sidebar-context.tsx) | Provider children | Manages collapse state with `localStorage` key `byteinn_sidebar_collapsed` and shortcut `⌘B` / `Ctrl+B`. |
| **ThemeToggle** | [`src/components/theme-toggle.tsx`](file:///Users/apple/Byten/byteInn/src/components/theme-toggle.tsx) | None | Sun/Moon button toggling between light and dark modes (supports hotkey `D`). |
| **ThemeProvider** | [`src/components/theme-provider.tsx`](file:///Users/apple/Byten/byteInn/src/components/theme-provider.tsx) | `React.ComponentProps<typeof NextThemesProvider>` | Root theme wrapper using `next-themes` with global keydown listener for hotkey `D`. |
| **Logo** | [`src/components/logo.tsx`](file:///Users/apple/Byten/byteInn/src/components/logo.tsx) | `{ className?: string; size?: number; showWordmark?: boolean }` | Renders `/logo.png` with inverted dark-mode styling and brand wordmark. |
| **SignOutButton** | [`src/components/sign-out-button.tsx`](file:///Users/apple/Byten/byteInn/src/components/sign-out-button.tsx) | None | Standalone sign-out button triggering `POST /api/auth/logout`. |
| **Navbar** | [`src/components/navbar.tsx`](file:///Users/apple/Byten/byteInn/src/components/navbar.tsx) | None | Pre-redesign top navbar (retained for backward compatibility). |

---

### 1.5 Layout Architecture and Application Shell

```
┌────────────────────────────────────────────────────────────────────────┐
│ RootLayout (src/app/layout.tsx)                                        │
│  └─ ThemeProvider (attribute="class", defaultTheme="system")          │
│      └─ AppShell (src/components/app-shell.tsx)                        │
│          ├─ Desktop Sidebar (src/components/app-sidebar.tsx)           │
│          │   ├─ Brand: Logo + "byteInn PMS"                            │
│          │   ├─ Nav Group: Operations (Overview, Res, Billing, Guests) │
│          │   ├─ Nav Group: Property (Rooms & Status, Categories)       │
│          │   ├─ Station Status: "Reception Desk • v1.0"                │
│          │   └─ NavUser: User Initials, Name, Role, Sign Out           │
│          │                                                             │
│          ├─ Mobile Drawer (lg:hidden, slide-in from left with overlay) │
│          │                                                             │
│          └─ Main Viewport (flex-1 flex-col h-svh overflow-hidden)      │
│              ├─ AppHeader (sticky h-14, Breadcrumb, Stats, ThemeToggle)│
│              └─ <main className="flex-1 overflow-y-auto">             │
│                  └─ Page Content (Container max-w-7xl)                 │
└────────────────────────────────────────────────────────────────────────┘
```

#### Sidebar Navigation Details

- **Collapse Behavior**:
  - Desktop width: `w-64` expanded $\leftrightarrow$ `w-16` collapsed.
  - State persisted via `localStorage.getItem("byteinn_sidebar_collapsed")`.
  - Global toggle keyboard shortcut: `Cmd+B` / `Ctrl+B` (ignored when typing in inputs/textareas).
- **Mobile Drawer Behavior**:
  - Hidden by default on screens $< 1024\text{px}$ (`lg`).
  - Hamburger trigger in `AppHeader` opens a `w-72` fixed slide-in drawer with backdrop blur.
  - Closes on backdrop click, navigation link click, or `Escape` keypress.
- **Top Bar (`AppHeader`) Contents**:
  1. Hamburger button (mobile only)
  2. Sidebar collapse toggle button (`PanelLeft` icon, desktop only)
  3. Dynamic breadcrumb: `PMS` $\rightarrow$ Page Title (e.g., `Overview`, `Reservations`, `Room Categories & Setup`)
  4. Quick status pills:
     - `CheckCircle2` icon + `X Clean` (emerald badge)
     - `Clock` icon + `Y Dirty` (amber badge)
  5. `ThemeToggle` button
  6. Sign-in link (only when unauthenticated)

---

### 1.6 Theme Handling and Dark Mode Engine

- **Default Theme**: `"system"` with system preference auto-detection.
- **Switch Mechanism**: `next-themes` toggling the `.dark` class on the root `<html>` element.
- **Hotkeys**: Pressing the letter `D` anywhere on the page (outside input fields and textareas) toggles between dark and light themes instantly via `ThemeHotkey`.
- **Contrast Ratios**: Verified in OKLCH palette; cards transition from crisp white (`oklch(1 0 0)`) to elevated dark gray (`oklch(0.205 0 0)`), borders from `oklch(0.922 0 0)` to `oklch(1 0 0 / 10%)`.

---

# PART 2: ROUTES AND PAGES

### 2.1 Comprehensive Application Route Map

| Path | Source File | Purpose | Access Control |
| :--- | :--- | :--- | :--- |
| `/` | [`src/app/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/page.tsx) | Daily reception desk KPI summary, room status breakdown, and module shortcuts. | Authenticated (`ADMIN`, `RECEPTIONIST`). Public sees fallback login card. |
| `/login` | [`src/app/login/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/login/page.tsx) | Staff credential authentication and JWT session cookie issuance. | Public / Unauthenticated. |
| `/reservations` | [`src/app/reservations/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/reservations/page.tsx) | Paginated list, search, and status filtering of guest bookings. | `ADMIN`, `RECEPTIONIST` |
| `/reservations/new` | [`src/app/reservations/new/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/reservations/new/page.tsx) | Availability search, room allocation cart, and multi-room booking creation. | `ADMIN`, `RECEPTIONIST` |
| `/reservations/[id]` | [`src/app/reservations/[id]/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/reservations/%5Bid%5D/page.tsx) | Booking summary, room check-in/check-out modals, and invoice link. | `ADMIN`, `RECEPTIONIST` |
| `/billing` | [`src/app/billing/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/billing/page.tsx) | Invoicing ledger, payment collection totals, and outstanding balances. | `ADMIN`, `RECEPTIONIST` |
| `/billing/[id]` | [`src/app/billing/[id]/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/billing/%5Bid%5D/page.tsx) | Itemized bill, extra charges, payment recording, and receipt modal. | `ADMIN`, `RECEPTIONIST` |
| `/customers` | [`src/app/customers/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/customers/page.tsx) | Guest directory, contact information, identity documents, and stay count. | `ADMIN`, `RECEPTIONIST` |
| `/customers/[id]` | [`src/app/customers/[id]/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/customers/%5Bid%5D/page.tsx) | Guest profile editing and historical reservation list. | `ADMIN`, `RECEPTIONIST` |
| `/rooms` | [`src/app/rooms/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/rooms/page.tsx) | Room condition grid, operational status updates, and physical room setup. | `ADMIN` (Full CRUD), `RECEPTIONIST` (Status Update only) |
| `/categories` | [`src/app/categories/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/categories/page.tsx) | Room categories catalog, pricing rates, occupancy rules, and amenities. | `ADMIN` (Full CRUD), `RECEPTIONIST` (Read-only) |

---

### 2.2 Overview / Dashboard (`/`)

- **Purpose & Primary Task**: Give reception staff an instant bird's-eye view of room turnover needs and booking activity upon starting a shift.
- **UI Sections (Top to Bottom)**:
  1. *Welcome Banner*: Greeting with user's name, station mode indicator, authorized role badge, and 3 quick action buttons (`New Reservation`, `Reservations`, `Rooms`).
  2. *Quick KPI Cards (4 columns)*:
     - Total Rooms: `{counts.total}` (`In physical inventory`)
     - Vacant Clean: `{counts.clean}` (`Ready for guests`, emerald style)
     - Vacant Dirty: `{counts.dirty}` (`Needs turnover`, amber style)
     - Maintenance: `{counts.maintenance}` (`Out for repair`, purple style)
  3. *Operational Module Cards (3 columns)*:
     - Reservations & Booking: `{counts.confirmedReservations} active` badge, summary text, links to `/reservations` and `/reservations/new`.
     - Room Inventory & Status: `{counts.total} rooms` badge, summary text, link to `/rooms`.
     - Categories & Setup: `{categoryCount} categories` badge, summary text, link to `/categories`.
- **Data Displayed**:
  - Staff Name (`session.name`), Role (`session.role`)
  - Total Room Count (`prisma.room.count()`)
  - Clean Count (`status: VACANT_CLEAN`)
  - Dirty Count (`status: VACANT_DIRTY`)
  - Maintenance Count (`status: MAINTENANCE`)
  - Active Reservations (`ReservationStatus.CONFIRMED`)
  - Category Count (`prisma.roomCategory.count()`)
- **Actions Available**:
  - `New Reservation` button $\rightarrow$ navigates to `/reservations/new`
  - `Reservations` button $\rightarrow$ navigates to `/reservations`
  - `Rooms` button $\rightarrow$ navigates to `/rooms`
  - `View Bookings` link $\rightarrow$ navigates to `/reservations`
  - `Open Room Status Board` link $\rightarrow$ navigates to `/rooms`
  - `Configure Categories` link $\rightarrow$ navigates to `/categories`
- **Filters / Search / Sorting**: None on overview.
- **Empty / Loading / Error States**: Unauthenticated state displays a centered login card with `ShieldCheck` icon prompting staff to sign in.
- **Responsive Behavior**: Stacked 2-column KPI grid on mobile, 4-column on desktop. Module cards stack to 1 column on mobile/tablet.

---

### 2.3 Staff Authentication (`/login`)

- **Purpose & Primary Task**: Securely authenticate reception desk staff and administrators using email and password.
- **UI Sections (Top to Bottom)**:
  1. Centered floating card with byteInn logo (size 48px).
  2. Title: `Sign in to byteInn`, Subtitle: `Reception-operated Room Management System`.
  3. Form inputs: `Email address` and `Password`.
  4. Submit Button: `Sign in` / `Signing in...`.
- **Data Displayed**: Form field labels, placeholders, and error messages.
- **Actions Available**:
  - Form submit $\rightarrow$ calls `POST /api/auth/login`, redirects to `/` on success.
- **Filters / Search / Sorting**: None.
- **States**:
  - *Loading*: Button disabled with text `Signing in...`, input fields disabled.
  - *Error*: Destructive red alert banner rendering server-returned validation error message.
  - *Success*: Immediate client-side redirection to `/`.
- **Responsive Behavior**: Centered container with `max-w-sm` across all viewports.

---

### 2.4 Reservations Registry (`/reservations`)

- **Purpose & Primary Task**: Search, inspect, and track all guest reservations across dates, rooms, and operational statuses.
- **UI Sections (Top to Bottom)**:
  1. *Header*: Page title `Reservations`, subtitle, and `New Reservation` button.
  2. *Search & Filter Bar*:
     - Search input: `Search by reservation #, guest name, phone, or room...`
     - Status tabs: `All Statuses`, `confirmed`, `completed`, `cancelled`.
  3. *Table Container*: Header with `All Bookings ({pagination.total})` and spinning loader indicator.
  4. *Data Table*:
     - Columns: `Reservation No`, `Primary Guest`, `Stay Schedule`, `Rooms Allocated`, `Status`, `Staff`, `Action`.
  5. *Pagination Controls*: `Showing X to Y of Z bookings`, `Previous` and `Next` buttons, `Page A of B`.
- **Data Displayed**:
  - `res.reservationNo`: Monospace link to `/reservations/[id]`.
  - `res.createdAt`: Formatted creation date.
  - `res.customer`: Full guest name (`User` icon), phone number, or email address.
  - `Stay Schedule`: Date range `YYYY-MM-DD → YYYY-MM-DD` and calculated stay nights.
  - `Rooms Allocated`: Badge list showing room number and category (e.g., `101 (Deluxe Double)`), plus estimated total rate snapshot (`Est. $XX.XX`).
  - `res.status`: Color badge (`Confirmed` in emerald, `Completed` in blue, `Cancelled` in rose).
  - `res.creator`: Staff name and staff role badge.
  - `Action`: Ghost button `View` $\rightarrow$ `/reservations/[id]`.
- **Actions Available**:
  - Click reservation number or `View` button $\rightarrow$ navigates to `/reservations/[id]`.
  - Click `New Reservation` $\rightarrow$ navigates to `/reservations/new`.
  - Click status tab $\rightarrow$ filters results by status.
  - Type in search box $\rightarrow$ executes debounced search (250ms delay).
  - Click `Previous` / `Next` $\rightarrow$ fetches corresponding page.
- **Filters / Search / Sorting**:
  - Backend search queries: reservation number, customer first name, last name, phone, email, and allocated room numbers.
  - Filter: Reservation status (`ALL`, `CONFIRMED`, `COMPLETED`, `CANCELLED`).
  - Sorting: Defaults to creation date descending (`createdAt: desc`).
  - Pagination: 20 records per page.
- **Empty / Loading / Error States**:
  - *Empty*: Centered `Calendar` icon, `No reservations found`, explanatory text, and `Create First Reservation` button.
  - *Loading*: `Loader2` spinner next to table header, previous/next buttons disabled.
- **Responsive Behavior**: Horizontal scroll wrapper (`overflow-x-auto`) prevents table breakage on mobile viewports.

---

### 2.5 New Reservation Wizard (`/reservations/new`)

- **Purpose & Primary Task**: Check physical room availability, select rooms, capture stay dates, attach primary guest details, and create a multi-room booking.
- **UI Sections (Top to Bottom)**:
  1. *Top Bar*: `Back` button to `/reservations`, title `Create New Reservation`, subtitle.
  2. *Error Banner*: Inline red card rendering validation failure messages.
  3. *Two-Column Layout*:
     - **Left Column (Span 2)**:
       - *Card 1: Primary Guest Details*: Toggle between `New Guest` and `Existing Guest`.
         - If New Guest: 8 inputs (`First Name`, `Last Name`, `Phone Number`, `Email Address`, `Nationality`, `ID Proof Type`, `ID Proof Number`, `Residential Address`).
         - If Existing Guest: Debounced search input, dropdown list of matching guest profiles, and selected guest card with `Change` button.
       - *Card 2: Check Room Availability*:
         - `Arrival Date` (date picker, defaults to today).
         - `Departure Date` (date picker, defaults to tomorrow).
         - `Category (Optional)` (dropdown selector).
         - `Search Available Rooms` button and `Apply Dates to All Added Rooms` button.
         - Available Rooms Grid: Card list showing room number, category, floor/building, nightly rate, and `Add to Booking` / `Remove` toggle.
       - *Card 3: Special Requests & Remarks*: Multi-line textarea for guest requests.
     - **Right Column (Span 1, Sticky Cart)**:
       - *Allocated Rooms Cart*:
         - Itemized cards for each added room: room number, category, per-room arrival date, per-room departure date, adults count, children count, rate snapshot input, calculated nights $\times$ rate, and trash button.
         - *Financial Summary*: Total rooms, total guest nights, estimated total booking cost.
         - *Confirm Button*: `Confirm & Book Reservation` (disabled when cart is empty or while submitting).
- **Actions Available**:
  - Toggle New / Existing Guest mode.
  - Search existing guests (debounced 300ms, calls `/api/customers?search=...&limit=5`).
  - Search available rooms (calls `/api/availability?arrivalDate=...&departureDate=...`).
  - Click `Add to Booking` $\rightarrow$ pushes room to cart state.
  - Click `Remove` $\rightarrow$ removes room from cart.
  - Edit per-room arrival/departure dates, adult/child counts, or rate overrides directly inside cart items.
  - Click `Apply Dates to All Added Rooms` $\rightarrow$ copies top search dates to all cart items.
  - Click `Confirm & Book Reservation` $\rightarrow$ calls `POST /api/reservations`, redirects to `/reservations/[id]`.
- **Responsive Behavior**: Sticky right cart stacks underneath the main form on screens $< 1024\text{px}$ (`lg`), forcing users to scroll the entire length of the page to inspect cart totals.

---

### 2.6 Reservation Details & Operations (`/reservations/[id]`)

- **Purpose & Primary Task**: Review an existing reservation, perform guest room check-in and check-out, and manage linked billing.
- **UI Sections (Top to Bottom)**:
  1. *Header*: `All Reservations` back button, reservation number (monospace), status badge, creation timestamp, and `New Reservation` button.
  2. *Two-Column Layout*:
     - **Left Column (1 Column)**:
       - *Primary Guest Card*: Full name, phone, email, nationality, ID proof type & number, residential address, guest notes.
       - *Reception Desk Record Card*: Booked by staff name, role badge, staff email.
       - *Special Requests Card*: Quoted guest requests (if present).
       - *Billing & Invoicing Card*: Invoice status badge, invoice number, grand total, total paid, balance due, and link `Open Invoice & Payments Hub` (or `Generate Invoice Now` button if not yet generated).
     - **Right Column (2 Columns)**:
       - *Physical Room Allocations Card*: Header with total night counter.
         - Itemized allocation rows: Room number, category, display name, building, floor, physical room status (`VACANT_CLEAN`, `OCCUPIED`, etc.), stay interval, guest counts, snapshotted nightly rate, subtotal, check-in timestamp, check-out timestamp, allocation status badge.
         - Action buttons per row: `Check In` (for `CONFIRMED` rooms) or `Check Out` (for `CHECKED_IN` rooms).
       - *Financial Breakdown Card*: Total allocated rooms, cumulative nights, estimated total booking value, PostgreSQL fixed-precision disclosure note.
  3. *Modals*:
     - Check-In Dialog (`AllocationActionRow`): Physical room condition verification, guest ID verification (type and number), reception check-in notes, confirm button.
     - Check-Out Dialog (`AllocationActionRow`): Turnover invariant notice (reminds user that checkout strictly resets room to `VACANT_DIRTY`), departure notes, confirm button.
- **Actions Available**:
  - Click `Check In` $\rightarrow$ opens Check-In modal $\rightarrow$ calls `POST /api/room-allocations/[id]/check-in`.
  - Click `Check Out` $\rightarrow$ opens Check-Out modal $\rightarrow$ calls `POST /api/room-allocations/[id]/check-out`.
  - Click `Generate Invoice Now` $\rightarrow$ calls `POST /api/invoices` with `{ autoIssue: true }`.
  - Click `Open Invoice & Payments Hub` $\rightarrow$ navigates to `/billing/[id]`.
- **Responsive Behavior**: Stacks gracefully to a single column on tablet/mobile.

---

### 2.7 Billing & Invoices Ledger (`/billing`)

- **Purpose & Primary Task**: Track hotel cash flow, review all reservation invoices, and identify guests with outstanding balances.
- **UI Sections (Top to Bottom)**:
  1. *Header*: Title `Billing & Invoicing`, subtitle.
  2. *Financial KPI Cards (3 columns)*:
     - Total Invoiced: `${data.summary.totalInvoiced}` (`Receipt` icon)
     - Total Collected: `${data.summary.totalCollected}` (`DollarSign` icon, emerald text)
     - Outstanding Balance: `${data.summary.totalOutstanding}` (`Clock` icon, amber text)
  3. *Search & Filter Bar*:
     - Search input: `Search by invoice #, reservation #, guest name, or phone...`
     - Status filter pills: `ALL`, `ISSUED`, `PARTIALLY PAID`, `PAID`, `DRAFT`, `VOID`.
  4. *Invoices Table*:
     - Columns: `Invoice #`, `Guest & Reservation`, `Status`, `Grand Total`, `Collected`, `Balance Due`, `Action`.
     - Footer: `Showing X of Y invoices`, `Page A of B`.
- **Data Displayed**:
  - `inv.invoiceNumber`: Monospace bold text with formatted date below.
  - `inv.customerName`: Guest name with `Res #reservationNo` below.
  - `inv.status`: Status badge (`Paid`, `Partial`, `Issued`, `Draft`, `Void`).
  - Financial figures: `Grand Total`, `Collected` (emerald), `Balance Due` (amber).
  - Action: `View Hub` button with `ArrowUpRight` icon $\rightarrow$ `/billing/[id]`.
- **Actions Available**:
  - Filter by invoice status pill.
  - Search invoices with instant query update.
  - Click `View Hub` $\rightarrow$ navigates to invoice detail `/billing/[id]`.
- **Responsive Behavior**: Table scrolls horizontally on mobile. KPI cards stack vertically on small screens.

---

### 2.8 Invoice Details, Charges & Payments Hub (`/billing/[id]`)

- **Purpose & Primary Task**: Itemize room and incidental charges, record guest payments (cash, card, UPI, bank transfer), void incorrect charges, and generate printable receipts.
- **UI Sections (Top to Bottom)**:
  1. *Header*: Back button to `/billing`, invoice number (monospace), status badge, creation date, link to reservation, and action toolbar:
     - `Issue Invoice` button (only if status is `DRAFT`).
     - `Add Extra Charge` button (disabled if status is `VOID`).
     - `Record Payment` button (visible only if balance due $> 0$).
     - `Print` button (triggers browser print).
  2. *Error Alert Banner* (if action fails).
  3. *Two-Column Layout*:
     - **Left Column (Span 2)**:
       - *Billed Items & Room Charges Table*: Description, allocation reference, type (`Room Stay` in blue, `Extra` in purple), quantity, unit rate, line total, and trash button to remove extra charges.
       - *Payments & Receipts Table*: Timestamp, payment method & reference number, status badge (`Recorded` in emerald, `Voided` in red), payment amount, `Receipt` button, and `Void Payment` button (`Ban` icon).
     - **Right Column (Span 1)**:
       - *Financial Summary Card*: Subtotal, discount total (if $> 0$), tax total (if $> 0$), grand total, total paid, balance due callout, and `Pay Balance` quick button.
       - *Billed Guest Card*: Name (links to `/customers/[id]`), email, phone.
       - *Linked Reservation Card*: Reservation number (links to `/reservations/[id]`).
  4. *Modals*:
     - Add Extra Charge Dialog (`AddItemDialog`): Quick preset buttons (Minibar, Room Service, Laundry, etc.), description input, quantity input, unit price input, line total estimate, submit button.
     - Record Payment Dialog (`RecordPaymentDialog`): Amount input with `Pay Full Balance` shortcut, payment method selector (Cash, Card, UPI, Bank Transfer), reference/transaction ID input, confirm button.
     - Official Receipt Modal (`ReceiptModal`): Brand header, receipt number, invoice number, guest name, reservation number, payment method, amount paid callout, processed by staff name, financial summary, and print button.
- **Actions Available**:
  - Issue draft invoice (`POST /api/invoices/[id]/issue`).
  - Add extra charge (`POST /api/invoices/[id]/items`).
  - Remove extra charge (`DELETE /api/invoices/[id]/items/[itemId]`).
  - Record payment (`POST /api/invoices/[id]/payments`).
  - Void payment (`POST /api/invoices/[id]/payments/[paymentId]/void`).
  - View / print official payment receipt.
- **Responsive Behavior**: Left and right columns stack into a single column on smaller viewports.

---

### 2.9 Guest Directory (`/customers`)

- **Purpose & Primary Task**: Search the hotel's guest database, review identification credentials, and register new guest profiles.
- **UI Sections (Top to Bottom)**:
  1. *Header*: Page title `Guest Directory`, subtitle, and `Register New Guest` button.
  2. *Search Card*: Input `Search by name, phone, email, nationality, or ID proof #...`.
  3. *Table Container*: Header with `Registered Guests ({pagination.total})`.
  4. *Guests Table*:
     - Columns: `Guest Name` (with address below), `Contact Details` (phone & email with icons), `ID Proof` (badge with type and monospace document number), `Nationality` (`Globe` icon), `Stays` (booking count badge), `Registered` (date), `Action` (`View Profile` button).
  5. *Pagination Controls*: `Showing X to Y of Z guests`, `Previous` and `Next` buttons.
  6. *Register New Guest Modal*:
     - Inputs: First Name (required), Last Name, Phone, Email, Nationality, ID Document Type dropdown, ID Document Number, Residential Address.
- **Actions Available**:
  - Search guests (debounced 250ms).
  - Open `Register New Guest` dialog $\rightarrow$ calls `POST /api/customers`.
  - Click guest name or `View Profile` $\rightarrow$ navigates to `/customers/[id]`.
- **Responsive Behavior**: Horizontal scroll table wrapper; stacks modal inputs into 2-column grid.

---

### 2.10 Guest Profile & Booking History (`/customers/[id]`)

- **Purpose & Primary Task**: Edit guest contact information, update identification documents, and review all previous and upcoming bookings.
- **UI Sections (Top to Bottom)**:
  1. *Header*: Back button to `/customers`, guest full name, registration date, total booking count.
  2. *Success / Error Banner*: Alerts indicating profile update status.
  3. *Two-Column Layout*:
     - **Left Column (1 Column)**:
       - *Guest Profile Form*: First Name, Last Name, Phone, Email, Nationality, ID Type dropdown, ID Number, Address, Remarks/Preferences textarea, and `Update Guest Details` button.
     - **Right Column (2 Columns)**:
       - *Reservation History Table*: Header with `Book Stay` shortcut button (links to `/reservations/new`).
       - Columns: `Reservation #` (monospace link), `Rooms` (badges with room number & category), `Stay Dates` (earliest arrival $\rightarrow$ latest departure), `Status` badge, `Details` button.
- **Actions Available**:
  - Update guest profile $\rightarrow$ calls `PUT /api/customers/[id]`.
  - Click reservation number or `View` $\rightarrow$ navigates to `/reservations/[id]`.
  - Click `Book Stay` $\rightarrow$ navigates to `/reservations/new`.
- **Responsive Behavior**: Stacks the edit profile card above the reservation history table on mobile viewports.

---

### 2.11 Room Inventory & Maintenance Board (`/rooms`)

- **Purpose & Primary Task**: Monitor real-time physical room states, update housekeeping/maintenance conditions with one click, and manage room inventory.
- **UI Sections (Top to Bottom)**:
  1. *Header*: Page title `Room Inventory & Status`, subtitle.
  2. *Status KPI Filter Row (6 clickable cards)*:
     - Total Rooms: `{counts.total}` (`Bed` icon)
     - Clean: `{counts.clean}` (`CheckCircle2` icon, emerald style)
     - Dirty: `{counts.dirty}` (`Clock` icon, amber style)
     - Occupied: `{counts.occupied}` (`Users` icon, blue style)
     - Maintenance: `{counts.maintenance}` (`Wrench` icon, purple style)
     - Out of Service: `{counts.outOfService}` (`Ban` icon, gray style)
  3. *Filter and Action Toolbar*:
     - Search input: `Search room no...`
     - Category filter dropdown (`All Categories` + category list)
     - Status filter dropdown (`All Statuses` + 5 statuses)
     - Floor filter dropdown (`All Floors` + distinct floor numbers)
     - `Add Room` button (ADMIN only)
  4. *Rooms Card Grid (4 columns)*:
     - Per room card:
       - Room number (large monospace text) + category badge + display name.
       - Operational status button (colored pill with icon, clicking opens status change modal).
       - Location: Building name + Floor number.
       - Capacity: `X Guests`.
       - Nightly rate: Rate override (or base category rate with strikethrough if overridden).
       - Notes: In-room notes banner (if present).
       - Footer: `Update Status` button + Admin actions (`Edit` pencil button, `Delete` trash button).
  5. *Modals*:
     - *Update Room Status Modal*: Shows warning banner if occupied (preventing manual modification); otherwise allows selecting condition (`Vacant Clean`, `Vacant Dirty`, `Maintenance`, `Out of Service`) and entering operational notes.
     - *Add / Edit Physical Room Modal* (ADMIN only): Property dropdown, Building dropdown, Floor dropdown, Room Category dropdown, Room No, Capacity, Rate Override ($), Display Name, Notes.
- **Actions Available**:
  - Filter rooms by clicking any of the 6 top KPI cards or selecting dropdown filters.
  - Search by room number or display name.
  - Click status pill or `Update Status` $\rightarrow$ opens status change dialog $\rightarrow$ calls `PATCH /api/rooms/[id]/status`.
  - Click `Add Room` (Admin only) $\rightarrow$ opens creation modal $\rightarrow$ calls `POST /api/rooms`.
  - Click `Edit` (Admin only) $\rightarrow$ opens edit modal $\rightarrow$ calls `PUT /api/rooms/[id]`.
  - Click `Delete` (Admin only) $\rightarrow$ browser confirmation $\rightarrow$ calls `DELETE /api/rooms/[id]`.
- **Role Differences**:
  - `ADMIN`: Full access to create, edit, delete physical rooms, and change statuses.
  - `RECEPTIONIST`: Read-only room setup (cannot add, edit, or delete rooms); can only click to update room operational statuses.
- **Responsive Behavior**: Grid adapts from 4 columns on large monitors down to 2 columns on tablets and 1 column on mobile screens.

---

### 2.12 Categories & Amenities Setup (`/categories`)

- **Purpose & Primary Task**: Define room category specifications, base nightly rates, maximum occupancy limits, and attach available amenities.
- **UI Sections (Top to Bottom)**:
  1. *Header*: Page title `Room Categories & Amenities`, subtitle.
  2. *Toolbar*:
     - Search input: `Search categories...`
     - Action buttons (ADMIN only): `Add Amenity` (sparkles icon) and `Add Category` (plus icon).
  3. *Categories Grid (3 columns)*:
     - Per category card:
       - Category name + assigned room count badge (e.g. `2 rooms`).
       - Description text.
       - Metrics box: Base nightly rate (`$XX.XX /night`) and Max Capacity (`X Guests`).
       - Included Amenities list (pill badges).
       - Footer (ADMIN only): `Edit` button and `Delete` button (disabled with tooltip if rooms are currently assigned).
  4. *Modals*:
     - *Create / Edit Category Modal*: Category Name, Base Nightly Rate ($), Max Occupancy, Description, Amenities multi-select checklist.
     - *Add Amenity Modal*: Amenity Name, Description.
- **Actions Available**:
  - Search categories by name or description.
  - Click `Add Category` (Admin only) $\rightarrow$ calls `POST /api/room-categories`.
  - Click `Edit` (Admin only) $\rightarrow$ calls `PUT /api/room-categories/[id]`.
  - Click `Delete` (Admin only) $\rightarrow$ calls `DELETE /api/room-categories/[id]` (blocked if `_count.rooms > 0`).
  - Click `Add Amenity` (Admin only) $\rightarrow$ calls `POST /api/amenities`.
- **Role Differences**:
  - `ADMIN`: Full configuration access.
  - `RECEPTIONIST`: Read-only view (all buttons hidden).
- **Responsive Behavior**: 3-column grid collapses to 2 columns on tablet and 1 column on mobile.

---

# PART 3: FORMS AND WORKFLOWS

### 3.1 Staff Login Form

- **Location**: [`src/app/login/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/login/page.tsx)
- **Primary Schema**:
```typescript
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required")
    .max(255, "Email must not exceed 255 characters")
    .email("Invalid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password must not exceed 128 characters"),
});
```
- **Fields**:
  | Label | Name | Type | Placeholder | Required | Default Value | Notes |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | Email address | `email` | `email` | `reception@byteinn.local` | Yes | `""` | Lowercased on submit |
  | Password | `password` | `password` | `••••••••` | Yes | `""` | Min 1, Max 128 chars |
- **Submission**: Calls `POST /api/auth/login`. On error, renders an inline alert. On success, executes `router.push("/")` and `router.refresh()`.

---

### 3.2 Multi-Room Reservation Booking Form

- **Location**: [`src/app/reservations/new/new-reservation-form.tsx`](file:///Users/apple/Byten/byteInn/src/app/reservations/new/new-reservation-form.tsx)
- **Primary Schemas**:
```typescript
export const checkAvailabilitySchema = z
  .object({
    arrivalDate: dateSchema,
    departureDate: dateSchema,
    propertyId: z.string().trim().min(1).optional(),
    roomCategoryId: z.string().trim().min(1).optional(),
    minCapacity: z.coerce.number().int().positive().optional(),
  })
  .refine(
    (data) => data.departureDate.getTime() > data.arrivalDate.getTime(),
    { message: "Departure date must be after arrival date", path: ["departureDate"] }
  );

export const roomAllocationSchema = z
  .object({
    roomId: z.string().trim().min(1, "Room ID is required"),
    roomCategoryId: z.string().trim().min(1).optional(),
    arrivalDate: dateSchema,
    departureDate: dateSchema,
    bookedNightlyRate: z.union([z.number(), z.string()]).optional(),
    adults: z.coerce.number().int().min(1, "At least 1 adult required").default(1),
    children: z.coerce.number().int().min(0, "Children cannot be negative").default(0),
  })
  .refine(
    (data) => data.departureDate.getTime() > data.arrivalDate.getTime(),
    { message: "Departure date must be after arrival date", path: ["departureDate"] }
  );

export const createReservationSchema = z
  .object({
    customerId: z.string().trim().min(1).optional(),
    newCustomer: createCustomerSchema.optional(),
    specialRequests: z.string().trim().max(1000).optional().nullable(),
    allocations: z.array(roomAllocationSchema).min(1, "At least one room allocation is required"),
  })
  .refine((data) => Boolean(data.customerId || data.newCustomer), {
    message: "Either an existing customerId or newCustomer details must be provided",
    path: ["customerId"],
  });
```

- **Fields Inventory (Guest Section)**:
  | Label | Name | Type | Placeholder | Required | Default Value | Notes |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | Guest Mode Toggle | `guestMode` | Tab buttons | — | Yes | `"new"` | `"new"` $\leftrightarrow$ `"existing"` |
  | First Name | `firstName` | `text` | `e.g. John` | Yes (if new) | `""` | Validated in Zod |
  | Last Name | `lastName` | `text` | `e.g. Doe` | Optional | `""` | |
  | Phone Number | `phone` | `text` | `+1 (555) 000-0000` | Optional | `""` | |
  | Email Address | `email` | `email` | `guest@example.com` | Optional | `""` | Validated email regex |
  | Nationality | `nationality` | `text` | `e.g. American` | Optional | `""` | |
  | ID Proof Type | `idProofType` | `select` | — | Optional | `"Passport"` | Passport, National ID, Driving License, Other |
  | ID Proof Number | `idProofNumber` | `text` | `e.g. A12345678` | Optional | `""` | |
  | Residential Address | `address` | `text` | `City, Country` | Optional | `""` | |
  | Guest Search | `customerSearchQuery` | `text` | `Search existing guest...` | Yes (if existing) | `""` | Debounced 300ms |

- **Fields Inventory (Availability Section)**:
  | Label | Name | Type | Placeholder | Required | Default Value | Notes |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | Arrival Date | `searchArrival` | `date` | — | Yes | Today (`YYYY-MM-DD`) | Check-in day |
  | Departure Date | `searchDeparture` | `date` | — | Yes | Tomorrow (`YYYY-MM-DD`)| Check-out day |
  | Category | `searchCategoryId` | `select` | `All Categories` | Optional | `""` | Pre-filters query |

- **Fields Inventory (Allocated Room Cart Item)**:
  | Label | Name | Type | Placeholder | Required | Default Value | Notes |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | Arrival | `alloc.arrivalDate` | `date` | — | Yes | Inherits search arrival | Independent per room |
  | Departure | `alloc.departureDate`| `date` | — | Yes | Inherits search dep. | Independent per room |
  | Adults | `alloc.adults` | `number` | — | Yes | `1` | Min 1 |
  | Children | `alloc.children` | `number` | — | Yes | `0` | Min 0 |
  | Rate ($) | `alloc.bookedNightlyRate`| `number` | — | Yes | Effective room rate | Editable snapshot |
  | Special Requests | `specialRequests` | `textarea` | `Optional notes...` | Optional | `""` | Max 1000 chars |

---

### 3.3 Guest Registration Form

- **Location**: [`src/app/customers/customer-list.tsx`](file:///Users/apple/Byten/byteInn/src/app/customers/customer-list.tsx)
- **Primary Schema**:
```typescript
export const createCustomerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email("Invalid email address").optional().nullable().or(z.literal("")),
  nationality: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  idProofType: z.string().trim().max(50).optional().nullable(),
  idProofNumber: z.string().trim().max(100).optional().nullable(),
  remarks: z.string().trim().max(500).optional().nullable(),
});
```
- **Fields**: First Name (required), Last Name, Phone, Email, Nationality, ID Document Type (`Passport`, `National ID`, `Driving License`, `Other`), ID Document Number, Residential Address.
- **Submission**: Calls `POST /api/customers`. On success, prepends new guest to local state and closes modal.

---

### 3.4 Guest Profile Edit Form

- **Location**: [`src/app/customers/[id]/customer-detail-view.tsx`](file:///Users/apple/Byten/byteInn/src/app/customers/[id]/customer-detail-view.tsx)
- **Primary Schema**: `createCustomerSchema.partial()`
- **Fields**: Same 8 fields as registration plus `Remarks / Preferences` (`textarea`).
- **Submission**: Calls `PUT /api/customers/[id]`. Displays success banner upon completion.

---

### 3.5 Physical Room Creation / Edit Form

- **Location**: [`src/app/rooms/room-manager.tsx`](file:///Users/apple/Byten/byteInn/src/app/rooms/room-manager.tsx)
- **Primary Schema**:
```typescript
export const createRoomSchema = z.object({
  propertyId: z.string().trim().min(1, "Property ID is required"),
  buildingId: z.string().trim().min(1, "Building ID is required"),
  floorId: z.string().trim().min(1, "Floor ID is required"),
  roomCategoryId: z.string().trim().min(1, "Room Category ID is required"),
  roomNo: z.string().trim().min(1, "Room number is required").max(50),
  displayName: z.string().trim().max(100).optional().nullable(),
  capacity: z.coerce.number().int("Capacity must be an integer").min(1, "Capacity must be at least 1"),
  status: z.nativeEnum(RoomStatus).optional().default(RoomStatus.VACANT_CLEAN),
  priceOverride: z.union([z.number(), z.string()])
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Price override must be non-negative")
    .transform((val) => Number(val).toFixed(2))
    .optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});
```
- **Fields**:
  | Label | Name | Type | Required | Notes |
  | :--- | :--- | :--- | :--- | :--- |
  | Property | `propertyId` | `select` | Yes | Populated from properties API |
  | Building | `buildingId` | `select` | Yes | Cascades from selected property |
  | Floor | `floorId` | `select` | Yes | Cascades from selected building |
  | Room Category | `roomCategoryId` | `select` | Yes | Populated from room categories |
  | Room No | `roomNo` | `text` | Yes | Unique per building (`buildingId_roomNo`) |
  | Capacity | `capacity` | `number` | Yes | Min 1 integer |
  | Rate Override ($) | `priceOverride` | `number` | Optional | Overrides category base price |
  | Display Name | `displayName` | `text` | Optional | e.g. "Corner Executive Suite" |
  | Notes | `notes` | `textarea` | Optional | Physical room features or status remarks |

---

### 3.6 Operational Room Status Transition Form

- **Location**: [`src/app/rooms/room-manager.tsx`](file:///Users/apple/Byten/byteInn/src/app/rooms/room-manager.tsx)
- **Primary Schema**:
```typescript
export const updateRoomStatusSchema = z.object({
  status: z.nativeEnum(RoomStatus, { message: "Invalid room status" }),
  notes: z.string().trim().max(500).optional().nullable(),
});
```
- **Allowed Manual Choices**: `VACANT_CLEAN`, `VACANT_DIRTY`, `MAINTENANCE`, `OUT_OF_SERVICE`.
- **Blocked State**: If room is `OCCUPIED`, form is replaced with an informational callout explaining that checkout is required to transition to `VACANT_DIRTY`.

---

### 3.7 Add Extra Invoice Charge Form

- **Location**: [`src/app/billing/[id]/add-item-dialog.tsx`](file:///Users/apple/Byten/byteInn/src/app/billing/[id]/add-item-dialog.tsx)
- **Primary Schema**:
```typescript
export const addInvoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(255),
  quantity: z.union([z.number(), z.string()])
    .transform((val) => Number(val))
    .refine((n) => !isNaN(n) && n > 0, "Quantity must be a positive number"),
  unitPrice: z.union([z.number(), z.string()])
    .transform((val) => Number(val))
    .refine((n) => !isNaN(n) && n >= 0, "Unit price must be non-negative"),
  itemType: z.nativeEnum(InvoiceItemType).optional().default(InvoiceItemType.EXTRA_CHARGE),
  reservationRoomId: z.string().optional(),
});
```
- **Presets**: Minibar ($15), Room Service ($35), Laundry ($20), Airport Transfer ($45), Late Checkout ($30), Extra Bedding ($25).
- **Fields**: Description (`text`), Quantity (`number`), Unit Price (`number`).

---

### 3.8 Record Invoice Payment Form

- **Location**: [`src/app/billing/[id]/record-payment-dialog.tsx`](file:///Users/apple/Byten/byteInn/src/app/billing/[id]/record-payment-dialog.tsx)
- **Primary Schema**:
```typescript
export const recordPaymentSchema = z.object({
  amount: z.union([z.number(), z.string()])
    .transform((val) => Number(val))
    .refine((n) => !isNaN(n) && n > 0, "Payment amount must be greater than 0"),
  paymentMethod: z.string().min(1, "Payment method is required").max(50),
  referenceNumber: z.string().max(100).optional().nullable(),
  paidAt: z.string().datetime({ offset: true }).optional().or(z.string().optional()),
});
```
- **Fields**: Payment Amount (defaults to `balanceDue`, includes `Pay Full Balance` shortcut), Payment Method pills (`CASH`, `CARD`, `UPI`, `BANK_TRANSFER`), Reference / Transaction ID (`text`, optional).

---

### 3.9 Room Category Creation / Edit Form

- **Location**: [`src/app/categories/category-manager.tsx`](file:///Users/apple/Byten/byteInn/src/app/categories/category-manager.tsx)
- **Primary Schema**:
```typescript
export const createCategorySchema = z.object({
  propertyId: z.string().trim().min(1).optional().nullable(),
  name: z.string().trim().min(1, "Category name is required").max(100),
  description: z.string().trim().max(255).optional().nullable(),
  basePrice: z.union([z.number(), z.string()])
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Base price must be a non-negative number")
    .transform((val) => Number(val).toFixed(2)),
  maxOccupancy: z.coerce.number().int("Max occupancy must be an integer").min(1, "Max occupancy must be at least 1"),
  amenityIds: z.array(z.string().trim()).optional().default([]),
});
```
- **Fields**: Category Name (`text`), Base Nightly Rate (`number`), Max Occupancy (`number`), Description (`textarea`), Amenities (`checkbox checklist`).

---

### 3.10 Amenity Creation Form

- **Location**: [`src/app/categories/category-manager.tsx`](file:///Users/apple/Byten/byteInn/src/app/categories/category-manager.tsx)
- **Primary Schema**:
```typescript
export const createAmenitySchema = z.object({
  name: z.string().trim().min(1, "Amenity name is required").max(100),
  description: z.string().trim().max(255).optional().nullable(),
});
```
- **Fields**: Amenity Name (`text`), Description (`text`, optional).

---

### 3.11 Room Allocation Check-In Form

- **Location**: [`src/app/reservations/[id]/allocation-action-row.tsx`](file:///Users/apple/Byten/byteInn/src/app/reservations/[id]/allocation-action-row.tsx)
- **Primary Schema**:
```typescript
export const checkInSchema = z.object({
  allocationId: z.string().trim().min(1, "Allocation ID is required"),
  verifiedIdType: z.string().trim().max(50).optional().nullable(),
  verifiedIdNumber: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});
```
- **Fields**: Verified ID Type (`select`), Verified ID Number (`text`), Reception Notes (`text`). Displays physical room condition badge; warns if not `VACANT_CLEAN`.

---

### 3.12 Room Allocation Check-Out Form

- **Location**: [`src/app/reservations/[id]/allocation-action-row.tsx`](file:///Users/apple/Byten/byteInn/src/app/reservations/[id]/allocation-action-row.tsx)
- **Primary Schema**:
```typescript
export const checkOutSchema = z.object({
  allocationId: z.string().trim().min(1, "Allocation ID is required"),
  notes: z.string().trim().max(500).optional().nullable(),
});
```
- **Fields**: Notes (`text`, optional). Explicit turnover warning callout that room transitions to `VACANT_DIRTY`.

---

### 3.13 Deep-Dive: The Complete Multi-Room Booking Flow

1. **Guest Resolution**:
   - Receptionist decides whether booking is for a new or returning guest.
   - For a returning guest: Types into search field. Debounced query calls `GET /api/customers?search=<query>&limit=5`. Receptionist clicks a result, binding `selectedCustomerId`.
   - For a new guest: Fills out `First Name` (mandatory) and optional contact/ID details.
2. **Availability Check**:
   - Selects `searchArrival` and `searchDeparture`.
   - Optionally selects a Category filter.
   - Clicks `Search Available Rooms`.
   - Client sends request: `GET /api/availability?arrivalDate=...&departureDate=...&roomCategoryId=...`.
   - Response shape:
     ```json
     {
       "success": true,
       "rooms": [
         {
           "id": "cm...",
           "roomNo": "101",
           "displayName": "Room 101",
           "capacity": 2,
           "status": "VACANT_CLEAN",
           "building": { "id": "...", "name": "Main Wing" },
           "floor": { "id": "...", "floorNo": 1, "name": "First Floor" },
           "category": { "id": "...", "name": "Standard Single", "basePrice": "75.00", "maxOccupancy": 1 },
           "effectiveRate": "75.00"
         }
       ]
     }
     ```
3. **Cart Addition ("Add to Booking")**:
   - Receptionist clicks `Add to Booking` on an available room.
   - The room is appended to the `allocations` array in React state.
   - Default dates from the availability query are populated into the room's cart item, along with default occupancy (`adults: 1`, `children: 0`) and snapshotted rate (`effectiveRate`).
4. **Independent Date & Rate Adjustments**:
   - In the cart, the receptionist can modify the room's arrival and departure dates independently of other rooms in the same reservation.
   - The receptionist can adjust adults/children count and change `bookedNightlyRate`.
   - If a group booking shares dates, clicking `Apply Dates to All Added Rooms` synchronizes all items to the primary search range.
5. **Conflict-Safe Submission**:
   - Client computes:
     - `nights = Math.max(1, (departure - arrival) / 86400000)`
     - `roomTotal = nights * bookedNightlyRate`
     - `estimatedTotal = sum(roomTotal)`
   - Clicks `Confirm & Book Reservation`.
   - Sends payload to `POST /api/reservations`:
     ```json
     {
       "customerId": "cm...",
       "specialRequests": "Late check-in requested",
       "allocations": [
         {
           "roomId": "cm_room_1",
           "arrivalDate": "2026-10-12",
           "departureDate": "2026-10-15",
           "bookedNightlyRate": 120.00,
           "adults": 2,
           "children": 0
         },
         {
           "roomId": "cm_room_2",
           "arrivalDate": "2026-10-13",
           "departureDate": "2026-10-16",
           "bookedNightlyRate": 75.00,
           "adults": 1,
           "children": 0
         }
       ]
     }
     ```
   - Database verifies that neither room is double-allocated on overlapping dates inside a transactional boundary.
   - On success, client redirects to `/reservations/[id]`.

---

# PART 4: DATA AND BUSINESS RULES

### 4.1 Prisma Schema Models and Domain Enums

```prisma
enum RoleName {
  ADMIN
  RECEPTIONIST
}

enum RoomStatus {
  VACANT_CLEAN
  VACANT_DIRTY
  OCCUPIED
  MAINTENANCE
  OUT_OF_SERVICE
}

enum ReservationStatus {
  CONFIRMED
  CANCELLED
  COMPLETED
}

enum AllocationStatus {
  CONFIRMED
  CHECKED_IN
  CHECKED_OUT
  CANCELLED
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PARTIALLY_PAID
  PAID
  VOID
}

enum InvoiceItemType {
  ROOM_CHARGE
  EXTRA_CHARGE
  DISCOUNT
  TAX
}

enum PaymentStatus {
  RECORDED
  VOIDED
}

model Role {
  id          String   @id @default(cuid())
  name        RoleName @unique
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  users       User[]
  @@map("roles")
}

model User {
  id           String        @id @default(cuid())
  name         String
  email        String        @unique
  passwordHash String        @map("password_hash")
  roleId       String        @map("role_id")
  status       String        @default("ACTIVE")
  lastLoginAt  DateTime?     @map("last_login_at")
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")
  role         Role          @relation(fields: [roleId], references: [id])
  reservations Reservation[] @relation("CreatedReservations")
  payments     Payment[]     @relation("RecordedPayments")
  auditLogs    AuditLog[]
  @@index([roleId])
  @@map("users")
}

model Property {
  id             String         @id @default(cuid())
  name           String
  address        String?
  city           String?
  state          String?
  country        String?
  phone          String?
  email          String?
  status         String         @default("ACTIVE")
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")
  buildings      Building[]
  rooms          Room[]
  roomCategories RoomCategory[]
  @@map("properties")
}

model Building {
  id          String   @id @default(cuid())
  propertyId  String   @map("property_id")
  name        String
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  property    Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  floors      Floor[]
  rooms       Room[]
  @@index([propertyId])
  @@map("buildings")
}

model Floor {
  id         String   @id @default(cuid())
  buildingId String   @map("building_id")
  floorNo    Int      @map("floor_no")
  name       String?
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  building   Building @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  rooms      Room[]
  @@index([buildingId])
  @@map("floors")
}

model RoomCategory {
  id               String                @id @default(cuid())
  propertyId       String?               @map("property_id")
  name             String
  description      String?
  basePrice        Decimal               @map("base_price") @db.Decimal(10, 2)
  maxOccupancy     Int                   @map("max_occupancy")
  createdAt        DateTime              @default(now()) @map("created_at")
  updatedAt        DateTime              @updatedAt @map("updated_at")
  property         Property?             @relation(fields: [propertyId], references: [id], onDelete: SetNull)
  rooms            Room[]
  amenities        RoomCategoryAmenity[]
  reservationRooms ReservationRoom[]
  @@index([propertyId])
  @@map("room_categories")
}

model Amenity {
  id          String                @id @default(cuid())
  name        String                @unique
  description String?
  createdAt   DateTime              @default(now()) @map("created_at")
  categories  RoomCategoryAmenity[]
  @@map("amenities")
}

model RoomCategoryAmenity {
  roomCategoryId String       @map("room_category_id")
  amenityId      String       @map("amenity_id")
  roomCategory   RoomCategory @relation(fields: [roomCategoryId], references: [id], onDelete: Cascade)
  amenity        Amenity      @relation(fields: [amenityId], references: [id], onDelete: Cascade)
  @@id([roomCategoryId, amenityId])
  @@map("room_category_amenities")
}

model Room {
  id               String            @id @default(cuid())
  propertyId       String            @map("property_id")
  buildingId       String            @map("building_id")
  floorId          String            @map("floor_id")
  roomCategoryId   String            @map("room_category_id")
  roomNo           String            @map("room_no")
  displayName      String?           @map("display_name")
  capacity         Int
  status           RoomStatus        @default(VACANT_CLEAN)
  priceOverride    Decimal?          @map("price_override") @db.Decimal(10, 2)
  notes            String?
  createdAt        DateTime          @default(now()) @map("created_at")
  updatedAt        DateTime          @updatedAt @map("updated_at")
  property         Property          @relation(fields: [propertyId], references: [id])
  building         Building          @relation(fields: [buildingId], references: [id])
  floor            Floor             @relation(fields: [floorId], references: [id])
  category         RoomCategory      @relation(fields: [roomCategoryId], references: [id])
  reservationRooms ReservationRoom[]
  @@unique([buildingId, roomNo])
  @@index([propertyId])
  @@index([roomCategoryId])
  @@index([status])
  @@map("rooms")
}

model Customer {
  id            String        @id @default(cuid())
  firstName     String        @map("first_name")
  lastName      String?       @map("last_name")
  phone         String?
  email         String?
  nationality   String?
  address       String?
  idProofType   String?       @map("id_proof_type")
  idProofNumber String?       @map("id_proof_number")
  remarks       String?
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")
  reservations  Reservation[]
  @@index([phone])
  @@index([email])
  @@map("customers")
}

model Reservation {
  id              String            @id @default(cuid())
  reservationNo   String            @unique @map("reservation_no")
  customerId      String            @map("customer_id")
  status          ReservationStatus @default(CONFIRMED)
  createdBy       String            @map("created_by")
  specialRequests String?           @map("special_requests")
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")
  customer        Customer          @relation(fields: [customerId], references: [id])
  creator         User              @relation("CreatedReservations", fields: [createdBy], references: [id])
  rooms           ReservationRoom[]
  invoices        Invoice[]
  @@index([customerId])
  @@index([status])
  @@index([createdBy])
  @@map("reservations")
}

model ReservationRoom {
  id                String           @id @default(cuid())
  reservationId     String           @map("reservation_id")
  roomId            String           @map("room_id")
  roomCategoryId    String           @map("room_category_id")
  arrivalDate       DateTime         @map("arrival_date") @db.Date
  departureDate     DateTime         @map("departure_date") @db.Date
  bookedNightlyRate Decimal          @map("booked_nightly_rate") @db.Decimal(10, 2)
  adults            Int              @default(1)
  children          Int              @default(0)
  status            AllocationStatus @default(CONFIRMED)
  checkedInAt       DateTime?        @map("checked_in_at")
  checkedOutAt      DateTime?        @map("checked_out_at")
  assignedAt        DateTime         @default(now()) @map("assigned_at")
  createdAt         DateTime         @default(now()) @map("created_at")
  updatedAt         DateTime         @updatedAt @map("updated_at")
  reservation       Reservation      @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  room              Room             @relation(fields: [roomId], references: [id])
  roomCategory      RoomCategory     @relation(fields: [roomCategoryId], references: [id])
  invoiceItems      InvoiceItem[]
  @@index([reservationId])
  @@index([roomId])
  @@index([roomCategoryId])
  @@index([arrivalDate, departureDate])
  @@index([status])
  @@map("reservation_rooms")
}

model Invoice {
  id            String        @id @default(cuid())
  reservationId String        @map("reservation_id")
  invoiceNumber String        @unique @map("invoice_number")
  subtotal      Decimal       @db.Decimal(10, 2)
  discountTotal Decimal       @default(0) @map("discount_total") @db.Decimal(10, 2)
  taxTotal      Decimal       @default(0) @map("tax_total") @db.Decimal(10, 2)
  grandTotal    Decimal       @map("grand_total") @db.Decimal(10, 2)
  status        InvoiceStatus @default(DRAFT)
  issuedAt      DateTime?     @map("issued_at")
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")
  reservation   Reservation   @relation(fields: [reservationId], references: [id])
  items         InvoiceItem[]
  payments      Payment[]
  @@index([reservationId])
  @@index([status])
  @@map("invoices")
}

model InvoiceItem {
  id                String          @id @default(cuid())
  invoiceId         String          @map("invoice_id")
  reservationRoomId String?         @map("reservation_room_id")
  description       String
  quantity          Decimal         @default(1) @db.Decimal(10, 2)
  unitPrice         Decimal         @map("unit_price") @db.Decimal(10, 2)
  lineTotal         Decimal         @map("line_total") @db.Decimal(10, 2)
  itemType          InvoiceItemType @default(ROOM_CHARGE) @map("item_type")
  createdAt         DateTime        @default(now()) @map("created_at")
  invoice           Invoice         @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  reservationRoom   ReservationRoom?@relation(fields: [reservationRoomId], references: [id], onDelete: SetNull)
  @@index([invoiceId])
  @@index([reservationRoomId])
  @@map("invoice_items")
}

model Payment {
  id              String        @id @default(cuid())
  invoiceId       String        @map("invoice_id")
  amount          Decimal       @db.Decimal(10, 2)
  paymentMethod   String        @map("payment_method")
  referenceNumber String?       @map("reference_number")
  status          PaymentStatus @default(RECORDED)
  paidAt          DateTime      @map("paid_at")
  createdBy       String        @map("created_by")
  createdAt       DateTime      @default(now()) @map("created_at")
  invoice         Invoice       @relation(fields: [invoiceId], references: [id])
  creator         User          @relation("RecordedPayments", fields: [createdBy], references: [id])
  @@index([invoiceId])
  @@index([createdBy])
  @@map("payments")
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String?  @map("user_id")
  entityType String   @map("entity_type")
  entityId   String   @map("entity_id")
  action     String
  oldData    Json?    @map("old_data")
  newData    Json?    @map("new_data")
  createdAt  DateTime @default(now()) @map("created_at")
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  @@index([userId])
  @@index([entityType, entityId])
  @@map("audit_logs")
}
```

---

### 4.2 Backend API Endpoint Index

All frontend Route Handlers enforce authentication via `requireAuth(roles)`:

| Method | Path | Request Body | Response Shape | Auth / Role |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | `{ email, password }` | `{ success, user, token }` | Public |
| `POST` | `/api/auth/logout` | None | `{ success: true }` | Public |
| `GET` | `/api/auth/me` | None | `{ success, user }` | Authenticated |
| `POST` | `/api/auth/verify-role`| `{ roles: RoleName[] }` | `{ authorized, role, user }` | Authenticated |
| `GET` | `/api/availability` | Query: `arrivalDate`, `departureDate`, `roomCategoryId` | `{ success, rooms: AvailableRoom[] }` | `ADMIN`, `RECEPTIONIST` |
| `GET` | `/api/reservations` | Query: `page`, `limit`, `search`, `status` | `{ success, reservations, pagination }` | `ADMIN`, `RECEPTIONIST` |
| `POST` | `/api/reservations` | `{ customerId?, newCustomer?, allocations, specialRequests? }` | `{ success, reservation }` | `ADMIN`, `RECEPTIONIST` |
| `GET` | `/api/reservations/[id]` | None | `{ success, reservation }` | `ADMIN`, `RECEPTIONIST` |
| `POST` | `/api/room-allocations/[id]/check-in` | `{ verifiedIdType?, verifiedIdNumber?, notes? }` | `{ success, allocation }` | `ADMIN`, `RECEPTIONIST` |
| `POST` | `/api/room-allocations/[id]/check-out` | `{ notes? }` | `{ success, allocation }` | `ADMIN`, `RECEPTIONIST` |
| `GET` | `/api/check-in-out/daily` | Query: `date` | `{ success, arrivals, departures, inHouse }` | `ADMIN`, `RECEPTIONIST` |
| `GET` | `/api/invoices` | Query: `page`, `limit`, `search`, `status` | `{ success, data: { invoices, total, summary } }` | `ADMIN`, `RECEPTIONIST` |
| `POST` | `/api/invoices` | `{ reservationId, autoIssue?, discountTotal?, taxTotal? }` | `{ success, data: InvoiceDetailDTO }` | `ADMIN`, `RECEPTIONIST` |
| `GET` | `/api/invoices/[id]` | None | `{ success, data: InvoiceDetailDTO }` | `ADMIN`, `RECEPTIONIST` |
| `POST` | `/api/invoices/[id]/issue` | None | `{ success, data: InvoiceDetailDTO }` | `ADMIN`, `RECEPTIONIST` |
| `POST` | `/api/invoices/[id]/items` | `{ description, quantity, unitPrice, itemType? }` | `{ success, data: InvoiceDetailDTO }` | `ADMIN`, `RECEPTIONIST` |
| `DELETE`| `/api/invoices/[id]/items/[itemId]` | None | `{ success, data: InvoiceDetailDTO }` | `ADMIN`, `RECEPTIONIST` |
| `POST` | `/api/invoices/[id]/payments` | `{ amount, paymentMethod, referenceNumber? }` | `{ success, data: { invoice, receipt } }` | `ADMIN`, `RECEPTIONIST` |
| `POST` | `/api/invoices/[id]/payments/[paymentId]/void` | None | `{ success, data: InvoiceDetailDTO }` | `ADMIN`, `RECEPTIONIST` |
| `GET` | `/api/customers` | Query: `page`, `limit`, `search` | `{ success, customers, pagination }` | `ADMIN`, `RECEPTIONIST` |
| `POST` | `/api/customers` | `{ firstName, lastName?, phone?, email?, ... }` | `{ success, customer }` | `ADMIN`, `RECEPTIONIST` |
| `GET` | `/api/customers/[id]` | None | `{ success, customer }` | `ADMIN`, `RECEPTIONIST` |
| `PUT` | `/api/customers/[id]` | `{ firstName, lastName?, phone?, email?, ... }` | `{ success, customer }` | `ADMIN`, `RECEPTIONIST` |
| `GET` | `/api/rooms` | Query: `status`, `roomCategoryId`, `buildingId` | `{ success, rooms }` | `ADMIN`, `RECEPTIONIST` |
| `POST` | `/api/rooms` | `{ roomNo, propertyId, buildingId, floorId, roomCategoryId, capacity, ... }` | `{ success, room }` | `ADMIN` only |
| `GET` | `/api/rooms/[id]` | None | `{ success, room }` | `ADMIN`, `RECEPTIONIST` |
| `PUT` | `/api/rooms/[id]` | `{ roomNo, capacity, priceOverride, ... }` | `{ success, room }` | `ADMIN` only |
| `DELETE`| `/api/rooms/[id]` | None | `{ success: true }` | `ADMIN` only |
| `PATCH` | `/api/rooms/[id]/status` | `{ status: RoomStatus, notes? }` | `{ success, room }` | `ADMIN`, `RECEPTIONIST` |
| `GET` | `/api/room-categories` | None | `{ success, categories }` | `ADMIN`, `RECEPTIONIST` |
| `POST` | `/api/room-categories` | `{ name, basePrice, maxOccupancy, amenityIds, ... }` | `{ success, category }` | `ADMIN` only |
| `GET` | `/api/room-categories/[id]` | None | `{ success, category }` | `ADMIN`, `RECEPTIONIST` |
| `PUT` | `/api/room-categories/[id]` | `{ name, basePrice, maxOccupancy, amenityIds, ... }` | `{ success, category }` | `ADMIN` only |
| `DELETE`| `/api/room-categories/[id]` | None | `{ success: true }` | `ADMIN` only |
| `GET` | `/api/amenities` | None | `{ success, amenities }` | `ADMIN`, `RECEPTIONIST` |
| `POST` | `/api/amenities` | `{ name, description? }` | `{ success, amenity }` | `ADMIN` only |
| `GET` | `/api/properties` | None | `{ success, properties }` | `ADMIN`, `RECEPTIONIST` |
| `POST` | `/api/properties` | `{ name, address, ... }` | `{ success, property }` | `ADMIN` only |

---

### 4.3 Enforced Invariants and Business Logic

1. **Half-Open Stay Interval `[arrivalDate, departureDate)`**:
   - Stays are inclusive of arrival day and exclusive of departure day.
   - A guest departing on October 15 vacates the room in the morning, making it available for a new arrival checking in on October 15.
   - Overlap logic:
     $$\text{Existing.arrival} < \text{Requested.departure} \quad \text{AND} \quad \text{Existing.departure} > \text{Requested.arrival}$$
2. **Double-Booking Prevention at Transaction Level**:
   - `prisma.$transaction` locks room checks prior to inserting allocations.
   - Cancelled allocations (`status: CANCELLED`) do not block availability.
   - Physical rooms with status `OUT_OF_SERVICE` are excluded from availability search.
3. **Nightly Rate Snapshotting**:
   - When a booking is confirmed, `bookedNightlyRate` is captured on `ReservationRoom` from `Room.priceOverride ?? RoomCategory.basePrice`.
   - Modifying category base pricing in `/categories` never alters historical or existing booking rates.
4. **Physical Room Status vs. Reservation Schedule**:
   - Physical statuses (`VACANT_CLEAN`, `VACANT_DIRTY`, `OCCUPIED`, `MAINTENANCE`, `OUT_OF_SERVICE`) track the physical state of the room, not calendar bookings.
   - Check-in invariant: Fails if physical room status is not `VACANT_CLEAN`. Sets room status to `OCCUPIED`.
   - Checkout invariant: Checkout strictly transitions physical room status to `VACANT_DIRTY`.
   - Occupied invariant: Rooms with active in-house guests cannot have physical status manually updated from `/rooms`.
5. **Billing Lifecycle and Fixed Precision**:
   - All financial numbers use PostgreSQL `numeric(10, 2)` / Prisma `Decimal`.
   - `subtotal` = $\sum (\text{quantity} \times \text{unitPrice})$.
   - `grandTotal` = $\text{subtotal} - \text{discountTotal} + \text{taxTotal}$.
   - `balanceDue` = $\text{grandTotal} - \text{totalPaid}$.
   - Invoice auto-transitions:
     - `totalPaid == 0` $\rightarrow$ `ISSUED`
     - `0 < totalPaid < grandTotal` $\rightarrow$ `PARTIALLY_PAID`
     - `totalPaid >= grandTotal` $\rightarrow$ `PAID`
6. **Deletion Protections**:
   - Categories with assigned rooms (`_count.rooms > 0`) cannot be deleted (returns 400 Bad Request).
   - Rooms with attached reservations cannot be deleted (Prisma foreign key error caught).

---

### 4.4 Client-Side and UI-Derived Computations

| Computed Metric | Computation Formula / Location | Where Rendered |
| :--- | :--- | :--- |
| **Stay Nights** | `Math.max(1, Math.round((dep.getTime() - arr.getTime()) / 86400000))` | Reservation list, cart summary, reservation detail |
| **Room Subtotal** | `nights * parseFloat(bookedNightlyRate)` | Cart items, reservation room allocation cards |
| **Booking Value** | `sum(nights * bookedNightlyRate)` across all allocated rooms | Reservation detail financial breakdown |
| **Avatar Initials** | `name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()` | `NavUser`, `ProfileMenu` avatar bubbles |
| **Line Item Total** | `parseFloat(quantity) * parseFloat(unitPrice)` | `AddItemDialog`, `InvoiceDetailView` |
| **Stay Date Range** | `${earliestArrival} → ${latestDeparture}` | Reservation list, customer profile history |

---

# PART 5: CONTENT INVENTORY

| Page | Element / Field | Where Shown Now | Importance | Notes / Reasoning |
| :--- | :--- | :--- | :--- | :--- |
| **Overview** | Welcome Staff Name & Role | Top banner | **ESSENTIAL** | Informs receptionist which profile/shift is active. |
| **Overview** | New Reservation button | Top right banner | **ESSENTIAL** | Reception desk primary task is creating bookings. |
| **Overview** | Vacant Clean KPI Card | 2nd KPI card | **ESSENTIAL** | Crucial for receptionist to know how many rooms can be sold immediately. |
| **Overview** | Vacant Dirty KPI Card | 3rd KPI card | **ESSENTIAL** | Critical for front desk turnover and housekeeping tracking. |
| **Overview** | Maintenance KPI Card | 4th KPI card | **SECONDARY** | Useful context, but repairs are less urgent than arrivals. |
| **Overview** | Total Rooms KPI Card | 1st KPI card | **SECONDARY** | Static inventory count; rarely changes during shifts. |
| **Overview** | Module Quick Links (3 Cards) | Middle grid | **REDUNDANT** | Exactly duplicates the persistent left sidebar navigation. |
| **Overview** | Station Mode subtitle | Top banner subtitle | **DECORATIVE** | Static helper text ("Reception Desk Operations • Authorized as RECEPTIONIST"). |
| **Reservations** | Search Bar | Top filter card | **ESSENTIAL** | Instant lookup of arriving guest by name or reservation #. |
| **Reservations** | Status Filter Tabs | Top filter card | **ESSENTIAL** | Allows filtering between confirmed, completed, and cancelled. |
| **Reservations** | Reservation # link | 1st table column | **ESSENTIAL** | Primary unique key to inspect booking details. |
| **Reservations** | Primary Guest Name | 2nd table column | **ESSENTIAL** | Identifies the checking-in guest at a glance. |
| **Reservations** | Stay Schedule Dates | 3rd table column | **ESSENTIAL** | Shows arrival $\rightarrow$ departure and stay night duration. |
| **Reservations** | Room Allocated Badges | 4th table column | **ESSENTIAL** | Identifies which physical room is reserved. |
| **Reservations** | Status Badge | 5th table column | **ESSENTIAL** | Distinguishes confirmed from checked-in or completed. |
| **Reservations** | Action Button ("View") | 7th table column | **REDUNDANT** | Duplicate of clicking the reservation number link in column 1. |
| **Reservations** | Staff Creator Name | 6th table column | **SECONDARY** | Audit info; front desk rarely needs who created it on the main board. |
| **Reservations** | Est. Rate Snapshot | 4th column subtext | **SECONDARY** | Financial detail can live in reservation details. |
| **Reservations** | Table Subtitle | Table card header | **DECORATIVE** | Helper copy ("Showing active and historical reservations..."). |
| **New Res** | Guest Mode Toggle | Card 1 Header | **ESSENTIAL** | Fast branching between existing guest search and new guest registration. |
| **New Res** | First Name Input | Card 1 Body | **ESSENTIAL** | Required legal guest identity. |
| **New Res** | Arrival Date Input | Card 2 Body | **ESSENTIAL** | Invariant start date for stay interval check. |
| **New Res** | Departure Date Input | Card 2 Body | **ESSENTIAL** | Invariant end date for stay interval check. |
| **New Res** | Search Available Rooms | Card 2 Body | **ESSENTIAL** | Core action querying live room inventory. |
| **New Res** | Available Room Cards | Card 2 Results | **ESSENTIAL** | Live inventory feed for receptionist to select room. |
| **New Res** | Cart Allocated Rooms | Sticky Right Column | **ESSENTIAL** | Cart summary showing room, night, and rate totals. |
| **New Res** | Confirm & Book Button | Bottom Right Column | **ESSENTIAL** | Primary conversion button to commit booking. |
| **New Res** | Residential Address | Card 1 Body | **SECONDARY** | Nice to have, but not mandatory at initial desk check-in. |
| **New Res** | Special Requests Area | Card 3 Body | **SECONDARY** | Useful for special needs, but optional. |
| **New Res** | Apply Dates to All | Card 2 Action | **SECONDARY** | Convenience helper for multi-room group bookings. |
| **New Res** | Availability Subtitle | Card 2 Header | **DECORATIVE** | Technical explanation ("Query physical rooms with half-open..."). |
| **Res Detail** | Reservation No & Status | Top Left Header | **ESSENTIAL** | Booking identity and current lifecycle state. |
| **Res Detail** | Check In / Out Buttons | Allocation Action Row | **ESSENTIAL** | Core receptionist desk interaction for arriving/departing guests. |
| **Res Detail** | Physical Room Status | Allocation Row Grid | **ESSENTIAL** | Front desk must verify room is `VACANT_CLEAN` before handoff. |
| **Res Detail** | Billing Hub Link / Gen | Billing Card | **ESSENTIAL** | Links directly to payment recording and invoice. |
| **Res Detail** | Primary Guest Name/Phone| Guest Card | **ESSENTIAL** | Contact info if guest is late or room needs attention. |
| **Res Detail** | Staff Creator Card | Left Column | **SECONDARY** | Staff audit record; useful for discrepancy investigation. |
| **Res Detail** | Fixed-Precision Note | Cost Card Subtitle | **DECORATIVE** | Engineering copy ("PostgreSQL Fixed-Precision Decimal(10, 2)"). |
| **Billing** | KPI Outstanding Balance | 3rd Stat Card | **ESSENTIAL** | Outstanding accounts receivable must be collected at checkout. |
| **Billing** | KPI Total Invoiced/Paid | 1st & 2nd Stat Cards | **SECONDARY** | Managerial financial summary; secondary to immediate front-desk work. |
| **Billing** | Invoice # & Guest Name | Table Column 1 & 2 | **ESSENTIAL** | Identifies which bill belongs to which guest. |
| **Billing** | Balance Due Column | Table Column 6 | **ESSENTIAL** | Immediate visual indicator of unpaid bills. |
| **Billing** | View Hub Link | Table Column 7 | **ESSENTIAL** | Navigation into payment recording and itemized receipts. |
| **Invoice Hub**| Balance Due Callout | Financial Summary | **ESSENTIAL** | Total amount guest owes before leaving the desk. |
| **Invoice Hub**| Record Payment Button | Header / Summary | **ESSENTIAL** | Primary conversion button to collect cash/card. |
| **Invoice Hub**| Add Extra Charge Button| Header | **ESSENTIAL** | Front desk adds minibar, laundry, or late checkout fees. |
| **Invoice Hub**| Itemized Items Table | Left Main Column | **ESSENTIAL** | Proof of room charges and incidentals. |
| **Invoice Hub**| Print Receipt Button | Header / Table Row | **ESSENTIAL** | Printing paper receipt for guest records. |
| **Invoice Hub**| Linked Res / Guest Card | Right Column | **SECONDARY** | Contextual links; secondary to billing figures. |
| **Rooms** | Status Toggle KPI Cards | Top 6 Cards | **ESSENTIAL** | Immediate room condition filters (Clean, Dirty, Occupied). |
| **Rooms** | Room Card Status Pill | Room Card Header | **ESSENTIAL** | Clicking allows receptionist to mark room as clean or dirty. |
| **Rooms** | Location & Capacity | Room Card Body | **SECONDARY** | Physical specs; helpful during booking, secondary during turnover. |
| **Rooms** | Add Room Button | Toolbar | **SECONDARY** | Admin-only configuration; never used by receptionist. |
| **Categories**| Category Name & Base Rate| Card Header & Body | **ESSENTIAL** | Catalog definition of property room types. |
| **Categories**| Amenities Pill Badges | Card Content | **SECONDARY** | List of features (Wi-Fi, AC) attached to category. |
| **Categories**| Add Category / Amenity | Toolbar | **SECONDARY** | Setup configuration; infrequently modified. |

---

# PART 6: UX PROBLEMS AND FRICTION POINTS IN THE CODE

### 1. High Cognitive Density in `NewReservationForm`
- **Problem**: [`new-reservation-form.tsx`](file:///Users/apple/Byten/byteInn/src/app/reservations/new/new-reservation-form.tsx) is a single 957-line form containing 3 vertically stacked cards on the left and a sticky shopping cart on the right.
- **Impact**: On standard reception monitors or laptops, the receptionist must constantly scroll up and down between the guest details, availability search results, and cart items to verify if dates match.
- **Recommendation for Designer**: Re-architect into a guided multi-step stepper wizard (Step 1: Stay Dates & Available Rooms $\rightarrow$ Step 2: Guest Details $\rightarrow$ Step 3: Review & Summary) or a split side-by-side workspace.

### 2. Native HTML Date Pickers Without Date Presets
- **Problem**: All date fields use raw browser `<input type="date">` inputs without calendar popovers, range selectors, or quick buttons (e.g., "Tonight", "Tomorrow", "1 Week").
- **Impact**: Receptionists must manually click through browser-native spinners or type calendar dates. Typographical mistakes can easily occur during phone bookings.

### 3. Inconsistent Dialog and Modal Implementations
- **Problem**: The codebase mixes shadcn/Base UI `Dialog` components in some modules (e.g., `AllocationActionRow`, `RoomManager`) with raw floating CSS overlays in others:
  - `add-item-dialog.tsx`: Uses `<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">`.
  - `record-payment-dialog.tsx`: Uses custom overlay markup.
  - `receipt-modal.tsx`: Uses custom overlay markup.
- **Impact**: Accessibility inconsistencies (focus traps and `aria-hidden` attributes differ), animations feel inconsistent, and mobile drawer transitions do not match.

### 4. Browser `window.confirm()` Used for Critical Operations
- **Problem**: Several destructive actions trigger browser-native popup dialogs instead of shadcn `AlertDialog`:
  - `InvoiceDetailView`: `if (!confirm("Are you sure you want to remove this line item?"))` (line 62)
  - `InvoiceDetailView`: `if (!confirm("Are you sure you want to void this recorded payment?"))` (line 80)
  - `RoomManager`: `if (!confirm("Are you sure you want to delete Room ...?"))` (line 322)
  - `CategoryManager`: `if (!confirm("Are you sure you want to delete category ...?"))` (line 154)
- **Impact**: Breaks design polish, looks like an unfinished prototype, and can be accidentally dismissed with a misclick.

### 5. Missing "Occupied" KPI Card on Overview Page
- **Problem**: In [`src/app/page.tsx`](file:///Users/apple/Byten/byteInn/src/app/page.tsx) (line 36), the query specifically counts `prisma.room.count({ where: { status: RoomStatus.OCCUPIED } })`. However, the Overview UI renders cards for Total, Clean, Dirty, and Maintenance—completely omitting the `Occupied` count.
- **Impact**: Reception desk staff cannot see at a glance how many in-house guest rooms are occupied from the main dashboard.

### 6. Weak Mobile Stacking on Sticky Cart
- **Problem**: In `new-reservation-form.tsx`, the right-hand column has `className="space-y-6 lg:sticky lg:top-20"`. On mobile and tablet screens ($< 1024\text{px}$), this column drops below Card 1, Card 2, and Card 3.
- **Impact**: After clicking "Add to Booking", the receptionist gets no immediate visual feedback that a room was added without scrolling past 300px of form fields to the bottom of the page.

### 7. Hardcoded Incidental Charge Presets
- **Problem**: In [`add-item-dialog.tsx`](file:///Users/apple/Byten/byteInn/src/app/billing/%5Bid%5D/add-item-dialog.tsx) (lines 15–22), common incidental charges are hardcoded into an array:
  ```typescript
  const COMMON_PRESETS = [
    { name: "Minibar Charges", price: 15.0 },
    { name: "Room Service", price: 35.0 },
    { name: "Laundry Service", price: 20.0 },
    { name: "Airport Transfer", price: 45.0 },
    { name: "Late Checkout Fee", price: 30.0 },
    { name: "Extra Bedding / Linen", price: 25.0 },
  ];
  ```
- **Impact**: Property managers cannot configure custom items or localized pricing from the database or administrative UI.

### 8. Receipt Printing Flow Friction
- **Problem**: In [`receipt-modal.tsx`](file:///Users/apple/Byten/byteInn/src/app/billing/%5Bid%5D/receipt-modal.tsx), receipts are printed directly from a floating dialog using `window.print()` and CSS `print:` modifiers.
- **Impact**: If background graphics are disabled in the user's browser print settings, borders and badge fills disappear. There is no dedicated printable receipt route (e.g. `/billing/[id]/receipt/[paymentId]`).

### 9. Absence of Multi-Room Bulk Operations
- **Problem**: When a customer books 3 rooms under a single reservation, check-in and check-out must be performed room-by-room in [`allocation-action-row.tsx`](file:///Users/apple/Byten/byteInn/src/app/reservations/%5Bid%5D/allocation-action-row.tsx).
- **Impact**: Receptionists handling families or corporate groups must open 3 separate dialogs and submit 3 separate check-in confirmations.

---

# PART 7: ASSETS, CONFIGURATION AND CONSTRAINTS

### 7.1 Seed and Demo Data Summary

Defined in [`prisma/seed.ts`](file:///Users/apple/Byten/byteInn/prisma/seed.ts):

- **Property**:
  - Name: `byteInn Grand Hotel`
  - Address: `100 Hospitality Way`, `Metropolis`, `NY`, `USA`
  - Contact: `+1-555-0199`, `contact@byteinn.local`
- **Building**: `Main Wing`
- **Floors**: `Floor 1` (`First Floor`), `Floor 2` (`Second Floor`)
- **Amenities**: `Wi-Fi`, `Air Conditioning`, `Flat Screen TV`, `Mini Bar`, `Safe Deposit Box`
- **Categories**:
  1. `Standard Single`: Base Rate `$75.00`, Max Occupancy `1`
  2. `Deluxe Double`: Base Rate `$120.00`, Max Occupancy `2`
  3. `Executive Suite`: Base Rate `$220.00`, Max Occupancy `4`
- **Physical Rooms**:
  - Room `101`: Floor 1, Standard Single, Capacity 1, Status `VACANT_CLEAN`
  - Room `102`: Floor 1, Standard Single, Capacity 1, Status `VACANT_DIRTY`
  - Room `103`: Floor 1, Deluxe Double, Capacity 2, Status `VACANT_CLEAN`
  - Room `201`: Floor 2, Deluxe Double, Capacity 2, Status `MAINTENANCE`
  - Room `202`: Floor 2, Executive Suite, Capacity 4, Status `VACANT_CLEAN`, Price Override `$200.00`
  - Room `203`: Floor 2, Executive Suite, Capacity 4, Status `OUT_OF_SERVICE`
- **Seed Staff Users**:
  - `admin@byteinn.local` (Role: `ADMIN`)
  - `reception@byteinn.local` (Role: `RECEPTIONIST`)

---

### 7.2 Logo and Brand Assets

- `/public/logo.png`: 32px / 48px brand emblem (inverted in dark mode via `dark:invert`).
- `/public/favicon.ico`: Standard browser shortcut icon.
- `/public/apple-icon.png`: Apple touch device icon.
- `/public/icon.png`: PWA web application manifest icon.

---

### 7.3 Internationalization, Currency & Date Formats

- **Currency**: Fixed to US Dollar (`$`). Stored exclusively as fixed-precision `Decimal(10, 2)`.
- **Date Format**: Calendar dates use ISO 8601 UTC strings (`YYYY-MM-DD`). UI displays formatted dates using `toLocaleDateString()` and time via `toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })`.
- **Language**: English only (`lang="en"` in `<html>`). No i18n libraries currently integrated.

---

### 7.4 Architectural Invariants (Must NOT Be Altered in Redesign)

1. **Modular Monolith in Next.js App Router**: Backend logic strictly resides in domain services (`src/modules/*`), called by Route Handlers (`src/app/api/*`). Do not introduce microservices or separate Express servers.
2. **Strict Server-Side Authorization**: Hiding UI buttons based on `session.role` is purely for UX; Route Handlers strictly enforce security with `requireAuth(["ADMIN"])`.
3. **Database Financial Precision**: Never use JavaScript floating-point arithmetic for money. All monetary balances must use Prisma `Decimal(10, 2)`.
4. **Availability & Double-Booking Safeguards**: Availability checking and allocation creation must occur atomically inside database transactions.
5. **Turnover Physical State Machine**: Physical room checkout strictly transitions state to `VACANT_DIRTY`. Check-in strictly requires `VACANT_CLEAN`.
6. **Snapshotted Room Rates**: Nightly rates are locked at booking time on `ReservationRoom` and must never retroactively change when category catalog prices are updated.

---
*(End of UI Audit)*
