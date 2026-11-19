"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  CalendarDays,
  Receipt,
  Users,
  BedDouble,
  SlidersHorizontal,
  UserCog,
  Landmark,
  CalendarCheck,
  Building2,
  Wallet,
  TrendingUp,
  ChevronRight,
} from "lucide-react"
import { Logo } from "@/components/logo"
import { NavUser } from "@/components/nav-user"
import { useSidebar } from "@/components/sidebar-context"
import type { SessionPayload } from "@/modules/auth/auth.types"
import { cn } from "@/lib/utils"

export interface NavSubItem {
  title: string
  href: string
}

export interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
  children?: NavSubItem[]
  defaultOpen?: boolean
}

export interface NavSection {
  section: string
  items: NavItem[]
}

interface AppSidebarProps {
  className?: string
  onNavigate?: () => void
  session?: SessionPayload | null
  forceExpanded?: boolean
}

export function getNavItems(role?: string | null): NavSection[] {
  if (role === "SUPER_ADMIN") {
    return [
      {
        section: "Operations",
        items: [
          {
            title: "Overview",
            href: "/",
            icon: LayoutDashboard,
            exact: true,
          },
          {
            title: "Reservations",
            href: "/reservations",
            icon: CalendarDays,
          },
          {
            title: "Rooms & Categories",
            href: "/rooms",
            icon: BedDouble,
          },
          {
            title: "Billing",
            href: "/billing",
            icon: Receipt,
          },
          {
            title: "Guests",
            href: "/customers",
            icon: Users,
          },
        ],
      },
      {
        section: "Property & Finance",
        items: [
          {
            title: "Hotels",
            href: "/properties",
            icon: Building2,
          },
          {
            title: "Categories",
            href: "/categories",
            icon: SlidersHorizontal,
          },
          {
            title: "Finance",
            href: "/finance",
            icon: Landmark,
          },
        ],
      },
      {
        section: "Reports & Analytics",
        items: [
          {
            title: "Hotel Operations",
            href: "/reports/daily-operations",
            icon: CalendarCheck,
            defaultOpen: true,
            children: [
              { title: "Daily Operations", href: "/reports/daily-operations" },
              { title: "Availability Grid", href: "/reports/availability-grid" },
            ],
          },
          {
            title: "Financial Reports",
            href: "/reports/cash-flow",
            icon: Wallet,
            defaultOpen: true,
            children: [
              { title: "Cash Flow & Performance", href: "/reports/cash-flow" },
              { title: "Shift Collections", href: "/reports/collections" },
              { title: "Folio Receivables", href: "/reports/receivables" },
            ],
          },
          {
            title: "Management",
            href: "/reports/occupancy",
            icon: TrendingUp,
            defaultOpen: true,
            children: [
              { title: "Occupancy & Revenue", href: "/reports/occupancy" },
            ],
          },
        ],
      },
      {
        section: "Administration",
        items: [
          {
            title: "Staff & Users",
            href: "/users",
            icon: UserCog,
          },
        ],
      },
    ]
  }

  if (role === "ADMIN") {
    return [
      {
        section: "Operations",
        items: [
          {
            title: "Overview",
            href: "/",
            icon: LayoutDashboard,
            exact: true,
          },
          {
            title: "Reservations",
            href: "/reservations",
            icon: CalendarDays,
          },
          {
            title: "Rooms",
            href: "/rooms",
            icon: BedDouble,
          },
          {
            title: "Billing",
            href: "/billing",
            icon: Receipt,
          },
          {
            title: "Guests",
            href: "/customers",
            icon: Users,
          },
        ],
      },
      {
        section: "Property & Finance",
        items: [
          {
            title: "Finance",
            href: "/finance",
            icon: Landmark,
          },
          {
            title: "Categories",
            href: "/categories",
            icon: SlidersHorizontal,
          },
        ],
      },
      {
        section: "Reports & Analytics",
        items: [
          {
            title: "Hotel Operations",
            href: "/reports/daily-operations",
            icon: CalendarCheck,
            defaultOpen: true,
            children: [
              { title: "Daily Operations", href: "/reports/daily-operations" },
              { title: "Availability Grid", href: "/reports/availability-grid" },
            ],
          },
          {
            title: "Financial Reports",
            href: "/reports/cash-flow",
            icon: Wallet,
            defaultOpen: true,
            children: [
              { title: "Cash Flow & Performance", href: "/reports/cash-flow" },
              { title: "Shift Collections", href: "/reports/collections" },
              { title: "Folio Receivables", href: "/reports/receivables" },
            ],
          },
          {
            title: "Management",
            href: "/reports/occupancy",
            icon: TrendingUp,
            defaultOpen: true,
            children: [
              { title: "Occupancy & Revenue", href: "/reports/occupancy" },
            ],
          },
        ],
      },
      {
        section: "Administration",
        items: [
          {
            title: "Staff Users",
            href: "/users",
            icon: UserCog,
          },
        ],
      },
    ]
  }

  // RECEPTIONIST navigation: strictly operational links and permitted operational reports
  return [
    {
      section: "Operations",
      items: [
        {
          title: "Overview",
          href: "/",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          title: "Reservations",
          href: "/reservations",
          icon: CalendarDays,
        },
        {
          title: "Rooms & Status",
          href: "/rooms",
          icon: BedDouble,
        },
        {
          title: "Billing & Folios",
          href: "/billing",
          icon: Receipt,
        },
        {
          title: "Guests",
          href: "/customers",
          icon: Users,
        },
      ],
    },
    {
      section: "Reports",
      items: [
        {
          title: "Hotel Operations",
          href: "/reports/daily-operations",
          icon: CalendarCheck,
          defaultOpen: true,
          children: [
            { title: "Daily Operations", href: "/reports/daily-operations" },
            { title: "Availability Grid", href: "/reports/availability-grid" },
          ],
        },
        {
          title: "Shift Collections",
          href: "/reports/collections",
          icon: Wallet,
          defaultOpen: true,
          children: [
            { title: "Shift Collections", href: "/reports/collections" },
            { title: "Folio Receivables", href: "/reports/receivables" },
          ],
        },
      ],
    },
  ]
}

export function AppSidebar({
  className,
  onNavigate,
  session,
  forceExpanded = false,
}: AppSidebarProps) {
  const pathname = usePathname()
  const { isCollapsed: sidebarCollapsed } = useSidebar()
  const isCollapsed = forceExpanded ? false : sidebarCollapsed
  const navItems = getNavItems(session?.role)

  const [manuallyToggledGroups, setManuallyToggledGroups] = React.useState<Record<string, boolean>>({})

  const toggleGroup = (title: string, defaultOpen = true) => {
    setManuallyToggledGroups((prev) => ({
      ...prev,
      [title]: prev[title] !== undefined ? !prev[title] : !defaultOpen,
    }))
  }

  const isItemActive = (href: string, exact = false, children?: NavSubItem[]) => {
    if (exact) {
      return pathname === href
    }
    if (children && children.length > 0) {
      return children.some(
        (sub) => pathname === sub.href || pathname.startsWith(`${sub.href}/`)
      )
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border/80 bg-sidebar/90 backdrop-blur-md shrink-0 transition-[width] duration-200 ease-in-out h-full z-40 select-none",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "flex h-13 items-center border-b border-sidebar-border/80 transition-all",
          isCollapsed ? "justify-center px-2" : "px-4 gap-2.5"
        )}
      >
        <Link
          href="/"
          prefetch={true}
          className={cn(
            "flex items-center hover:opacity-90 transition-opacity",
            isCollapsed ? "justify-center" : "gap-2.5"
          )}
          onClick={onNavigate}
          title="byteInn PMS"
        >
          <Logo size={26} showWordmark={false} />
          {!isCollapsed && (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold tracking-tight text-base text-foreground truncate">
                byteInn
              </span>
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0">
                PMS
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto py-5 space-y-6",
          isCollapsed ? "px-2 space-y-4" : "px-3"
        )}
      >
        {navItems.map((group, groupIdx) => (
          <div key={group.section} className="space-y-1">
            {isCollapsed ? (
              groupIdx > 0 && <div className="my-2 border-t border-sidebar-border/60 mx-1" />
            ) : (
              <h3 className="px-3 pb-1 text-[10px] font-mono font-bold tracking-wider text-muted-foreground/70 uppercase">
                {group.section}
              </h3>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const hasChildren = Boolean(item.children && item.children.length > 0)
                const active = isItemActive(item.href, item.exact, item.children)
                const hasActiveChild = Boolean(
                  item.children?.some(
                    (sub) => pathname === sub.href || pathname.startsWith(`${sub.href}/`)
                  )
                )
                const isDefaultOpen = item.defaultOpen ?? false
                const isExpanded =
                  manuallyToggledGroups[item.title] !== undefined
                    ? manuallyToggledGroups[item.title]
                    : (isDefaultOpen || hasActiveChild)
                const Icon = item.icon

                if (isCollapsed) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      onClick={onNavigate}
                      title={item.title}
                      className={cn(
                        "flex items-center justify-center size-10 mx-auto rounded-lg text-xs font-medium transition-all group relative",
                        active
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/80"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-transform group-hover:scale-105",
                          active
                            ? "text-primary-foreground"
                            : "text-muted-foreground group-hover:text-sidebar-foreground"
                        )}
                      />
                      <span className="sr-only">{item.title}</span>
                    </Link>
                  )
                }

                if (hasChildren) {
                  return (
                    <div key={item.title} className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.title, isDefaultOpen)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group relative cursor-pointer",
                          active
                            ? "text-foreground font-semibold bg-sidebar-accent/50"
                            : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon
                            className={cn(
                              "size-4 shrink-0 transition-transform group-hover:scale-105",
                              active
                                ? "text-primary"
                                : "text-muted-foreground group-hover:text-sidebar-foreground"
                            )}
                          />
                          <span className="truncate">{item.title}</span>
                        </div>
                        <ChevronRight
                          className={cn(
                            "size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200",
                            isExpanded && "rotate-90 text-foreground"
                          )}
                        />
                      </button>

                      {isExpanded && item.children && (
                        <div className="mt-0.5 space-y-0.5 pl-7 pr-1">
                          {item.children.map((sub) => {
                            const isSubActive =
                              pathname === sub.href || pathname.startsWith(`${sub.href}/`)
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                prefetch={true}
                                onClick={onNavigate}
                                className={cn(
                                  "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all group",
                                  isSubActive
                                    ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                                )}
                              >
                                <span
                                  className={cn(
                                    "size-1.5 rounded-full shrink-0 transition-all",
                                    isSubActive
                                      ? "bg-primary-foreground scale-110"
                                      : "bg-muted-foreground/40 group-hover:bg-sidebar-foreground/60"
                                  )}
                                />
                                <span className="truncate">{sub.title}</span>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative",
                      active
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0 transition-transform group-hover:scale-105",
                        active
                          ? "text-primary-foreground"
                          : "text-muted-foreground group-hover:text-sidebar-foreground"
                      )}
                    />
                    <span className="truncate">{item.title}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Account Menu Footer */}
      {session && (
        <div
          className={cn(
            "border-t border-border/80 transition-all bg-card/40 mt-auto",
            isCollapsed ? "p-2" : "p-2.5"
          )}
        >
          <NavUser session={session} isCollapsed={isCollapsed} />
        </div>
      )}
    </aside>
  )
}
