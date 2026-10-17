---
name: byteInn
description: Warm Boutique Hospitality Property Management System (PMS)
colors:
  primary: "oklch(0.555 0.165 48.5)"
  primary-dark: "oklch(0.64 0.16 48.5)"
  neutral-bg: "oklch(0.985 0.006 65)"
  neutral-bg-dark: "oklch(0.14 0.008 55)"
  card-bg: "oklch(1 0 0)"
  card-bg-dark: "oklch(0.185 0.01 55)"
  border: "oklch(0.90 0.008 65)"
  border-dark: "oklch(0.28 0.01 55)"
  status-clean: "oklch(0.55 0.15 155)"
  status-dirty: "oklch(0.65 0.16 75)"
  status-occupied: "oklch(0.52 0.14 245)"
  status-maintenance: "oklch(0.52 0.14 310)"
  status-out-of-service: "oklch(0.45 0.02 55)"
typography:
  display:
    fontFamily: "var(--font-sans), system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "var(--font-sans), system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  small:
    fontFamily: "var(--font-sans), system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  caption:
    fontFamily: "var(--font-sans), system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  micro:
    fontFamily: "var(--font-mono), monospace"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.05em"
  mono:
    fontFamily: "var(--font-mono), monospace"
    fontWeight: 600
    letterSpacing: "normal"
rounded:
  sm: "calc(var(--radius) * 0.6)"
  md: "calc(var(--radius) * 0.8)"
  lg: "var(--radius)"
  xl: "calc(var(--radius) * 1.4)"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 14px"
---

# Design System

<!-- impeccable:design-schema 1 -->

## Overview

byteInn is an internal, reception-operated Property Management System (PMS) designed for front-desk speed, calm ergonomics, and transactional integrity. The visual world is **Warm Boutique Hospitality** (Operate Mode): tactile alabaster and warm stone canvas, crisp white and charcoal card surfaces, rich terracotta and amber primary accents, and monospace tabular numerals for all operational data (room numbers, currency, dates, times).

## Colors

The palette operates in the OKLCH color space for perceptually uniform contrast:

- **Primary Brand Accent**:
  - Light: `oklch(0.555 0.165 48.5)` (Warm terracotta / burnt amber, contrast > 5:1 against light canvas)
  - Dark: `oklch(0.64 0.16 48.5)` (Vibrant warm terracotta, contrast > 7:1 against dark surfaces)
- **Canvas & Card Surfaces**:
  - Light Ground: `oklch(0.985 0.006 65)` (Warm alabaster)
  - Light Card: `oklch(1 0 0)` (Crisp white elevated card)
  - Dark Ground: `oklch(0.14 0.008 55)` (Deep warm charcoal)
  - Dark Card: `oklch(0.185 0.01 55)` (Warm slate charcoal)
- **Tactile Borders**:
  - Light: `oklch(0.90 0.008 65)`
  - Dark: `oklch(0.28 0.01 55)`
- **Operational Status Tokens**:
  - `VACANT_CLEAN` / `PAID`: Emerald (`bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/25`)
  - `VACANT_DIRTY` / `PARTIALLY_PAID`: Amber (`bg-amber-500/12 text-amber-900 dark:text-amber-300 border-amber-500/30`)
  - `OCCUPIED` / `ISSUED`: Sapphire / Sky (`bg-sky-500/12 text-sky-900 dark:text-sky-300 border-sky-500/25`)
  - `MAINTENANCE`: Plum / Violet (`bg-purple-500/12 text-purple-900 dark:text-purple-300 border-purple-500/25`)
  - `OUT_OF_SERVICE` / `CANCELLED`: Warm Slate (`bg-stone-500/12 text-stone-800 dark:text-stone-300 border-stone-500/25`)

## Typography

- **Primary UI Sans**: Clean geometric sans-serif (`var(--font-sans)`). High legibility at 12–14px sizes under lobby lighting.
- **Tabular Figures Monospace**: `var(--font-mono)` with `tabular-nums` for all room numbers, amounts, stay dates, and invoice references.
- **Hierarchy Scale**:
  - Section Title: `text-xl sm:text-2xl font-bold tracking-tight text-foreground`
  - Group Label / Table Header: `text-[10px] sm:text-[11px] font-mono font-bold tracking-wider uppercase text-muted-foreground/70`
  - Body: `text-xs sm:text-sm text-foreground`
  - Metric Numerals: `text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground tracking-tight`

## Layout

- **Application Shell**:
  - Fixed-height top bar (`h-13` / 52px) with live shift status indicator, clean/dirty room count pills, and theme toggle.
  - Collapsible persistent left navigation rail (`w-64` expanded, `w-16` collapsed) with accessible tooltips and mobile slide-out drawer.
  - Main scrollable content canvas centered with bounded width (`max-w-6xl` or `max-w-7xl` for wide tables).

## Elevation & Depth

- Elevation is achieved via tonal contrast and subtle, natural drop shadows with blur.
- No zero-blur hard offset shadows (no neo-brutalism).
- Soft card elevation: `shadow-2xs` (subtle resting state) transitioning to `shadow-xs` or `hover:border-primary/50` on interactive hover.

## Shapes

- Rounded corners use a warm, cohesive radius scale:
  - Cards, Tables, Dialogs: `rounded-xl` (10px–12px)
  - Buttons, Inputs, Selects: `rounded-lg` (8px)
  - Status Pills & Badges: `rounded-full`

## Components

- **StatCard**: Operational metric tile displaying status dot, label, tabular monospace metric, and operational subtext.
- **StatusBadge**: High-contrast, tactile status pill with colored dot indicator and border.
- **DataTableShell**: Responsive data table wrapper with compact desktop layout, smooth skeleton shimmer loading, and bounded pagination.
- **EmptyState**: Dashed stone border, centered boutique icon badge, and actionable creation button.

## Do's and Don'ts

### Do's
- Always format currency, dates, invoice numbers, and room numbers with `font-mono tabular-nums`.
- Maintain contrast >= 4.5:1 for body copy and >= 3:1 for large display elements.
- Keep operational actions reachable within 1–2 clicks from the main dispatch matrix.
- Ensure light and dark mode parity across all views.

### Don'ts
- ❌ Do NOT use gradient text.
- ❌ Do NOT place kicker or eyebrow labels above headings.
- ❌ Do NOT use same-size nested cards.
- ❌ Do NOT use floating point arithmetic for monetary calculations.
- ❌ Do NOT hardcode arbitrary colors outside the semantic design tokens.
