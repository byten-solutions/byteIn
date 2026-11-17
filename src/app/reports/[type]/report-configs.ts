export interface ReportConfig {
  type: string
  title: string
  subtitle: string
  category: "Hotel Operations" | "Financial Reports" | "Management"
  categoryHref: string
  dateMode: "range" | "single" | "none"
}

export const REPORT_CONFIGS: Record<string, ReportConfig> = {
  "daily-operations": {
    type: "daily-operations",
    title: "Daily Operations Dispatch",
    subtitle: "Front-desk schedule of expected arrivals, departures, in-house guests, and overdue check-ins.",
    category: "Hotel Operations",
    categoryHref: "/reports/daily-operations",
    dateMode: "single",
  },
  "availability-grid": {
    type: "availability-grid",
    title: "Room Availability Grid",
    subtitle: "Visual tape chart and room rack status for frontline allocation dispatch.",
    category: "Hotel Operations",
    categoryHref: "/reports/availability-grid",
    dateMode: "range",
  },
  "cash-flow": {
    type: "cash-flow",
    title: "Cash Flow & Financial Performance",
    subtitle: "Consolidated visual trajectory and executive breakdown of cash inflows, operating expenses, and liquidity velocity.",
    category: "Financial Reports",
    categoryHref: "/reports/cash-flow",
    dateMode: "range",
  },
  collections: {
    type: "collections",
    title: "Shift Collections",
    subtitle: "Daily cashier tender reconciliation, payment methods breakdown, and receipt audit log.",
    category: "Financial Reports",
    categoryHref: "/reports/collections",
    dateMode: "single",
  },
  receivables: {
    type: "receivables",
    title: "Folio Receivables & Aging",
    subtitle: "Aging ledger of unpaid guest invoices across in-house and departed folios.",
    category: "Financial Reports",
    categoryHref: "/reports/receivables",
    dateMode: "none",
  },
  occupancy: {
    type: "occupancy",
    title: "Occupancy & Revenue Performance",
    subtitle: "Room occupancy rate, room revenue, ADR, and RevPAR breakdown.",
    category: "Management",
    categoryHref: "/reports/occupancy",
    dateMode: "range",
  },
  // Canonical redirects for backward-compatibility
  "financial-performance": {
    type: "financial-performance",
    title: "Cash Flow & Financial Performance",
    subtitle: "Consolidated visual trajectory and executive breakdown of cash inflows, operating expenses, and liquidity velocity.",
    category: "Financial Reports",
    categoryHref: "/reports/cash-flow",
    dateMode: "range",
  },
  "revenue-vs-expense": {
    type: "revenue-vs-expense",
    title: "Cash Flow & Financial Performance",
    subtitle: "Consolidated visual trajectory and executive breakdown of cash inflows, operating expenses, and liquidity velocity.",
    category: "Financial Reports",
    categoryHref: "/reports/cash-flow",
    dateMode: "range",
  },
  outstanding: {
    type: "outstanding",
    title: "Folio Receivables & Aging",
    subtitle: "Aging ledger of unpaid guest invoices across in-house and departed folios.",
    category: "Financial Reports",
    categoryHref: "/reports/receivables",
    dateMode: "none",
  },
  revenue: {
    type: "revenue",
    title: "Occupancy & Revenue Performance",
    subtitle: "Room occupancy rate, room revenue, ADR, and RevPAR breakdown.",
    category: "Management",
    categoryHref: "/reports/occupancy",
    dateMode: "range",
  },
}

export const RECEPTIONIST_ALLOWED_REPORTS = new Set([
  "daily-operations",
  "availability-grid",
  "collections",
  "receivables",
])

export function resolveCanonicalReportType(slug: string): string {
  if (slug === "outstanding") return "receivables"
  if (
    slug === "revenue" ||
    slug === "monthly-performance" ||
    slug === "reservations" ||
    slug === "performance" ||
    slug === "discounts" ||
    slug === "property-summary"
  ) {
    return "occupancy"
  }
  if (
    slug === "financial-performance" ||
    slug === "revenue-vs-expense" ||
    slug === "account-statements"
  ) {
    return "cash-flow"
  }
  if (slug === "operations" || slug === "guests") {
    return "daily-operations"
  }
  return slug
}

export function isValidReportSlug(slug: string): boolean {
  const canonical = resolveCanonicalReportType(slug)
  return Boolean(REPORT_CONFIGS[slug] || REPORT_CONFIGS[canonical])
}
