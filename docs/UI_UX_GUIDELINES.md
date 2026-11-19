# byteInn — UI/UX Design System & Component Guidelines

**Status**: Authoritative Reference  
**Version**: 1.0 (V1 PMS)  
**Target Audience**: Frontend Engineers, SaaS Designers, AI Agents

---

## 1. System Identity & Hospitality UX Philosophy

byteInn is a reception-operated Property Management System (PMS) designed for front-desk efficiency, high transactional integrity, and a calm, boutique hospitality aesthetic.

### Core UX Tenets:
1. **Receptionist-First Ergonomics**: Front-desk staff navigate under time pressure with guests standing at the desk. Information must be legible at a glance, actions must be reachable in 1–2 clicks, and high-frequency operational data (room numbers, guest names, dates, balance dues) must never be buried or truncated.
2. **Warm Boutique Aesthetic**: Avoid generic corporate blues or blinding clinical white. byteInn uses warm amber/terracotta primary accents, neutral slate and stone surfaces, and subtle, tactile borders.
3. **Flawless Dark/Light Parity**: Reception desks often operate in dim lobby lighting at night and bright sunshine during the day. Both light and dark modes must maintain high contrast, legible typography, and consistent visual hierarchy.
4. **Predictable State Feedback**: Every interactive view must gracefully handle Loading (skeletons), Empty (helpful guidance + CTA), and Error (clear recovery) states.

### 1.1 Summary-First Ergonomics & Progressive Disclosure

**Core Principle**:
> *Show users what they need to know first. Show everything else when they ask for it.*

Clean, minimal, summary-first design does not mean removing useful functionality or oversimplifying a professional PMS. It means organizing information into the correct interface tier so that immediate operational priorities are obvious, while deep details, itemizations, and secondary histories are accessible on demand.

#### The Four Interface Archetypes:

| Interface Archetype | Primary Purpose | What Belongs Here | What Does NOT Belong Here |
| :--- | :--- | :--- | :--- |
| **Overview** | Shift awareness, health, alerts, navigation launchpad. | • Curated operational KPIs (see KPI Guidelines below).<br>• Shift readiness indicators (clean vs dirty room counts).<br>• Urgent operational action queues (overdue check-ins, unassigned arrivals).<br>• Compact, secondary visual trends.<br>• Short preview lists (3–5 items) with explicit "View All" links. | • Exhaustive multi-page data tables.<br>• Detailed transaction logs or audit histories.<br>• Verbose explanatory paragraphs.<br>• Complex multi-field creation forms. |
| **Listing** | Search, filter, operational triage, and rapid identification. | • Fast search with debounce and semantic status filters.<br>• **High-density operational tables**: Room #, Guest, Category, Dates, Status pill, Balance due.<br>• Contextual 1-click action triggers (Check-In, Folio, Collect).<br>• Clean bounded pagination controls. | • Multi-card KPI walls pushing tables below the fold.<br>• Secondary audit stamps (creator IDs, edit timestamps).<br>• Full transaction breakdowns or itemized receipts.<br>• Decorative visual clutter. |
| **Detail** | Complete operational truth, auditability, and deep workflows. | • Exhaustive stay folios and itemized room/extra charges.<br>• Full transaction receipts, payment allocations, refunds.<br>• Chronological audit logs, timestamps, user stamps.<br>• Guest profile history, preferences, and identity records.<br>• Secondary actions (voiding, rate overrides, extensions). | • Redundant top-level overview KPIs.<br>• Cluttered cross-entity widgets unrelated to the record. |
| **Dialog / Modal** | Single focused transactional action. | • Clear, descriptive title stating the exact action.<br>• Minimum necessary form fields for that action.<br>• 1–2 line contextual summary (e.g. "Remaining Balance: $150.00").<br>• Generously spaced footer with Cancel and Action button. | • Running transaction histories or embedded ledgers.<br>• Multi-tab navigation inside the modal.<br>• Stacked secondary forms or dense micro-tables.<br>• Overlapping buttons or crowded helper copy. |

#### Ergonomic Guidelines:

1. **KPI Card Curation**:
   - Curate KPI cards based on operational significance and available screen space (typically 3–4 primary indicators per view on desktop, stacking gracefully on mobile).
   - This is an ergonomic guideline to ensure high-impact metrics remain scannable, not a dogmatic limit. If an operational dashboard legitimately benefits from additional indicators, arrange them cleanly with progressive visual weighting.
   - Avoid adding cards merely to display available data, and avoid duplicating metrics already visible in the primary table below.

2. **Preserving Operational Scanning Density**:
   - High information density is an essential capability for front-desk speed. In Listing interfaces, tabular density for Room Number, Guest Name, Stay Dates, Room Category, Status Pill, and Balance Due must be preserved.
   - The goal is eliminating unnecessary visual noise, repetitive explanatory copy, and nested container cards—never removing useful operational data that receptionists rely on.

3. **Dialog & Modal Hygiene**:
   - Every dialog must serve a single transactional outcome (e.g., Record Payment, Disburse Expense, Change Room Status).
   - Never embed running transaction histories, historical itemized ledgers, or multi-tab mini-apps inside modal dialogs. Move deep histories to dedicated detail views or expandable side sheets.
   - Footers must provide clear breathing room between secondary Cancel (`variant="outline"`) and primary Action buttons, preventing overlap across all supported screen sizes.

4. **Visual Hierarchy & Whitespace**:
   - Maintain generous whitespace (`gap-4` to `gap-6`, `p-4` to `p-6`) between major visual sections.
   - Never nest cards inside cards (`card` inside `card`). Use subtle borders (`border-border/60`), tonal background shifts (`bg-muted/40`), or clean spacing to establish hierarchy.

---

## 2. Color System & Semantic Tokens

byteInn relies on Tailwind CSS v4 and the CSS variables defined in [src/app/globals.css](file:///Users/apple/Byten/byteInn/src/app/globals.css):

| Token Variable | Light Mode (OKLCH) | Dark Mode (OKLCH) | Semantic Purpose |
| :--- | :--- | :--- | :--- |
| `--background` | `oklch(1 0 0)` (White) | `oklch(0.145 0 0)` (Deep Charcoal) | Primary application canvas background |
| `--card` / `--popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Card, dialog, and dropdown surfaces |
| `--primary` | `oklch(0.555 0.163 48.998)` | `oklch(0.473 0.137 46.201)` | Brand accent, active states, primary buttons |
| `--primary-foreground`| `oklch(0.987 0.022 95.277)` | `oklch(0.987 0.022 95.277)` | Text on primary elements |
| `--secondary` | `oklch(0.967 0.001 286.375)` | `oklch(0.274 0.006 286.033)`| Subtle buttons, secondary badges |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Table header backgrounds, inactive tabs |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | Secondary labels, timestamps, subtitles |
| `--border` / `--input` | `oklch(0.922 0 0)` | `oklch(0.269 0 0)` | Card borders, input outlines, table dividers |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)`| Danger actions, cancellation badges, errors |

### Operational Status Color Standards
Never use arbitrary ad-hoc colors for operational states. Always use these semantic pairings:

#### 1. Physical Room Status (`RoomStatus`)
- **`VACANT_CLEAN`**:
  `bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800`
- **`VACANT_DIRTY`**:
  `bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800`
- **`OCCUPIED`**:
  `bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800`
- **`MAINTENANCE`**:
  `bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800`
- **`OUT_OF_SERVICE`**:
  `bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700`

#### 2. Reservation Status (`ReservationStatus`)
- **`CONFIRMED`**: Indigo / Blue (`bg-blue-50 text-blue-700 border-blue-200`)
- **`CHECKED_IN`**: Emerald / Green (`bg-emerald-50 text-emerald-700 border-emerald-200`)
- **`CHECKED_OUT`**: Slate / Neutral (`bg-slate-100 text-slate-700 border-slate-300`)
- **`CANCELLED`**: Rose / Destructive (`bg-rose-50 text-rose-700 border-rose-200`)

#### 3. Invoice & Payment Status
- **`PAID`**: Emerald (`bg-emerald-50 text-emerald-700 border-emerald-200`)
- **`PARTIALLY_PAID`**: Amber (`bg-amber-50 text-amber-700 border-amber-200`)
- **`UNPAID` / `ISSUED`**: Blue (`bg-blue-50 text-blue-700 border-blue-200`)
- **`VOID`**: Slate (`bg-slate-100 text-slate-700 border-slate-300`)

---

## 3. Typography & Hierarchy

- **Font Family**:
  - Primary UI: `Inter` (`--font-sans`), clean and legible at small sizes.
  - Numbers, Dates, Room Codes: `Geist Mono` (`--font-mono`), tabular alignment for prices, room numbers, and dates.
- **Hierarchy Scale**:
  - Page Title: `text-2xl font-bold tracking-tight text-foreground`
  - Page Description: `text-sm text-muted-foreground`
  - Section / Card Header: `text-lg font-semibold tracking-tight`
  - Metric / KPI Value: `text-2xl sm:text-3xl font-extrabold font-mono tracking-tight`
  - Body Text: `text-sm text-foreground`
  - Secondary / Helper: `text-xs text-muted-foreground`
  - Status Pills / Badges: `text-[11px] font-semibold px-2 py-0.5 rounded-full`

---

## 4. Application Shell Specification

The application shell provides the consistent frame for all reception workflows.

```text
+--------------------------------------------------------------------------+
|  TOP BAR: [Menu] Breadcrumbs / Title | Shift Stats | Theme | User Profile |
+--------------+-----------------------------------------------------------+
|              |                                                           |
|  SIDEBAR     |  MAIN CONTENT CANVAS                                      |
|  - Brand     |  - Page Header & Action Bar                               |
|  - Overview  |  - Metric KPI Cards (if dashboard)                        |
|  - Bookings  |  - Search & Filter Controls                               |
|  - Billing   |  - Data Table / Detail Cards                              |
|  - Guests    |  - Bounded Pagination Footer                              |
|  - Rooms     |                                                           |
|  - Setup     |                                                           |
|              |                                                           |
+--------------+-----------------------------------------------------------+
```

### Components:
1. **Sidebar (`AppSidebar`)**:
   - Fixed width: `w-64` on desktop, collapsible to icon-only (`w-16`) or mobile drawer.
   - Clean byteInn logo and wordmark header.
   - Navigation links with Lucide icons:
     - `LayoutDashboard`: Overview (`/`)
     - `CalendarDays`: Reservations (`/reservations`)
     - `Receipt`: Billing & Invoices (`/billing`)
     - `Users`: Guests (`/customers`)
     - `BedDouble`: Rooms & Status (`/rooms`)
     - `Sliders`: Categories & Setup (`/categories`)
   - Visual active indicator: subtle primary background tint, bold text, colored accent icon.
2. **Top Bar (`AppHeader`)**:
   - Height: `h-14`, sticky top with background blur (`backdrop-blur bg-background/95 border-b border-border`).
   - Breadcrumb / Active Page indicator on left.
   - Live Reception Indicators: Quick counts of `Clean Rooms` and `Dirty Rooms` for immediate situational awareness.
   - Theme Toggle: Instant switch between Light, Dark, and System modes with keyboard shortcut `D`.
   - User Profile Menu: Displays avatar/initials, name, email, role badge (`ADMIN` or `RECEPTIONIST`), and Sign-Out button.
3. **Main Content Canvas**:
   - Max width: `max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8`.
   - Spacing: consistent gap between header, filters, and tables (`space-y-6`).

---

## 5. Reusable Component Conventions

### A. Data Tables
- Header: `bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground`.
- Rows: `hover:bg-muted/40 transition-colors border-b border-border/60`.
- Monetary Values: Right-aligned, formatted with fixed 2 decimals and currency sign (`$120.00`).
- Actions: Grouped in rightmost column (`text-right`).
- Empty State: Centered icon, clear title, supportive description, and primary creation button.

### B. Search & Filter Bars
- Full width on mobile, inline flex on desktop (`flex flex-col sm:flex-row gap-3 items-center justify-between`).
- Search input with leading `Search` icon and debounce (300ms).
- Status dropdown filter using semantic colors.
- Primary creation button on the far right (`Button variant="default"`).

### C. Dialogs & Modals
- Modal max width: `max-w-lg` for standard transactional forms, `max-w-xl` for complex inputs. Avoid super-wide modals (`max-w-4xl+`) unless displaying a printable document preview.
- Single Transactional Scope: Every dialog must execute one distinct action. Never embed running transaction histories, historical itemized ledgers, or multi-tab mini-apps inside dialog bodies.
- Structure: Clear Header, concise form body with essential fields only, and a spacious Footer with distinct Cancel (`variant="outline"`) and Confirm (`variant="default"` / `variant="destructive"`).
- Button Hygiene: Ensure adequate spacing and avoid button or text overlap across mobile and desktop viewports. Cancel and submit buttons must never collide.
- Destructive actions (e.g., voiding payment, deactivating room) must use `variant="destructive"` with mandatory reason inputs and explicit confirmation.

---

## 6. Accessibility & Responsiveness

- All icon buttons must have `aria-label`.
- Interactive elements must maintain visible focus rings (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`).
- Forms must associate labels with inputs using `htmlFor` and `id`.
- Responsive breakpoints:
  - Mobile: `< 768px` (drawer navigation, single-column cards, horizontally scrollable tables).
  - Tablet: `768px - 1024px` (compact sidebar, 2-column KPI cards).
  - Desktop: `> 1024px` (full persistent sidebar, 4-column KPI cards).
