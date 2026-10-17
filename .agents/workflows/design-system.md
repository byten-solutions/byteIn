---
name: design-system
description: >-
  Follow and evolve the byteInn design system. Use when designing, building, or
  updating user interfaces, shared components, layouts, typography, color tokens,
  and responsive hospitality workflows in byteInn.
---

# byteInn Design System & UI Patterns Skill

## 1. When to Use This Skill
Activate this skill whenever:
- Creating or refactoring UI components, pages, dialogs, tables, or navigation shells.
- Adjusting styling, color tokens, typography, dark/light themes, or spacing.
- Ensuring visual and interaction consistency across reception PMS workflows.

## 2. Context to Load
Before designing or modifying UI:
- Primary Authority: [docs/UI_UX_GUIDELINES.md](file:///Users/apple/Byten/byteInn/docs/UI_UX_GUIDELINES.md)
- Styling Tokens: [src/app/globals.css](file:///Users/apple/Byten/byteInn/src/app/globals.css)
- Existing Primitives: Inspect `src/components/ui/` (`button.tsx`, `card.tsx`, `dialog.tsx`, `table.tsx`, `badge.tsx`, etc.)
- Active Navigation Shell: Inspect `src/components/app-shell.tsx`

## 3. Core Design Principles
1. **Receptionist-First Ergonomics**: High information density without visual clutter; rapid scanning for room numbers, guest names, stay dates, and monetary balances.
2. **Warm Boutique Hospitality Aesthetic**: Deep slate and warm amber/terracotta accents (`--primary`), calm surfaces (`--card`, `--background`), and subtle borders. Avoid harsh saturated generic primaries.
3. **Strict Dark/Light Mode Parity**: Every surface, border, and text element must look intentional in both themes. Test both light (`default`) and dark (`.dark`).
4. **Semantic Status Badging**:
   - `RoomStatus`:
     - `VACANT_CLEAN`: Emerald / Green (`bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800`)
     - `VACANT_DIRTY`: Amber / Orange (`bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800`)
     - `OCCUPIED`: Blue / Indigo (`bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800`)
     - `MAINTENANCE`: Rose / Red (`bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800`)
     - `OUT_OF_SERVICE`: Slate / Zinc (`bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700`)
   - `ReservationStatus`:
     - `CONFIRMED`: Blue / Indigo
     - `CHECKED_IN`: Emerald / Green
     - `CHECKED_OUT`: Slate / Muted
     - `CANCELLED`: Rose / Destructive
   - `PaymentStatus` / `InvoiceStatus`:
     - `PAID`: Emerald
     - `PARTIALLY_PAID`: Amber
     - `UNPAID` / `ISSUED`: Blue
     - `VOID`: Slate

## 4. Step-by-Step Workflow
1. **Identify Existing Components**: Search `src/components/ui/` before creating new component files.
2. **Apply Design Tokens**: Use Tailwind CSS v4 semantic classes (`bg-background`, `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`). Never use hardcoded arbitrary hex colors.
3. **Implement Responsive Layout**:
   - Mobile: clean single-column stacking with sticky action buttons and drawer navigation.
   - Desktop: multi-column dashboard with persistent collapsible sidebar.
4. **Incorporate Feedback States**: Always include Loading skeleton/spinners, Empty states (with clear Call to Action), and Error states.
5. **Verify Accessibility**: Ensure adequate contrast, keyboard focus rings (`focus-visible:ring-2`), and descriptive `aria-label`s on icon-only buttons.

## 5. Scope & Safety Constraints
- ❌ Do NOT introduce Tailwind v3 configurations or install alternative UI libraries (e.g., Mantine, Chakra, Material UI).
- ❌ Do NOT remove operational data columns to make a table "look simpler." Reception desks require complete context.
- ❌ Do NOT bypass Base UI / shadcn accessible primitives.

## 6. Completion Checklist
- [ ] Uses established tokens from `globals.css`
- [ ] Looks polished in both Light and Dark modes
- [ ] Responsive down to 375px mobile viewports
- [ ] Loading, Empty, and Error states handled
- [ ] No layout shift during hydration or server rendering
