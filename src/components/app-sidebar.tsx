"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Receipt,
  Users,
  BedDouble,
  SlidersHorizontal,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { NavUser } from "@/components/nav-user";
import { useSidebar } from "@/components/sidebar-context";
import type { SessionPayload } from "@/modules/auth/auth.types";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  className?: string;
  onNavigate?: () => void;
  session?: SessionPayload | null;
  forceExpanded?: boolean;
}

const navItems = [
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
        title: "Billing & Invoices",
        href: "/billing",
        icon: Receipt,
      },
      {
        title: "Guests & Profiles",
        href: "/customers",
        icon: Users,
      },
    ],
  },
  {
    section: "Property",
    items: [
      {
        title: "Rooms & Status",
        href: "/rooms",
        icon: BedDouble,
      },
      {
        title: "Categories & Setup",
        href: "/categories",
        icon: SlidersHorizontal,
      },
    ],
  },
];

export function AppSidebar({
  className,
  onNavigate,
  session,
  forceExpanded = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { isCollapsed: sidebarCollapsed } = useSidebar();
  const isCollapsed = forceExpanded ? false : sidebarCollapsed;

  const isItemActive = (href: string, exact = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card/60 backdrop-blur shrink-0 transition-[width] duration-200 ease-in-out h-full overflow-hidden z-40 select-none",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-border/80 transition-all",
          isCollapsed ? "justify-center px-2" : "px-4 gap-2.5"
        )}
      >
        <Link
          href="/"
          className={cn(
            "flex items-center hover:opacity-90 transition-opacity",
            isCollapsed ? "justify-center" : "gap-2.5"
          )}
          onClick={onNavigate}
          title="byteInn PMS"
        >
          <Logo size={28} showWordmark={false} />
          {!isCollapsed && (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold tracking-tight text-base text-foreground truncate">
                byteInn
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0">
                PMS
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto py-4 space-y-6",
          isCollapsed ? "px-2 space-y-4" : "px-3"
        )}
      >
        {navItems.map((group, groupIdx) => (
          <div key={group.section} className="space-y-1">
            {isCollapsed ? (
              groupIdx > 0 && <div className="my-2 border-t border-border/60 mx-1" />
            ) : (
              <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                {group.section}
              </h3>
            )}
            <div className="space-y-1 pt-1">
              {group.items.map((item) => {
                const active = isItemActive(item.href, item.exact);
                const Icon = item.icon;

                if (isCollapsed) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      title={item.title}
                      className={cn(
                        "flex items-center justify-center h-10 w-10 mx-auto rounded-lg text-xs font-medium transition-all group relative",
                        active
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
                          active
                            ? "text-primary-foreground"
                            : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      <span className="sr-only">{item.title}</span>
                    </Link>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group relative",
                      active
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                        active
                          ? "text-primary-foreground"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Station Status */}
      <div
        className={cn(
          "border-t border-border/80 text-[11px] text-muted-foreground transition-all",
          isCollapsed ? "p-2 flex justify-center" : "p-2.5"
        )}
      >
        {isCollapsed ? (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/40 border border-border/50"
            title="Reception Desk — Shift Active"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        ) : (
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50">
            <div className="flex items-center gap-2 truncate">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="truncate font-medium text-foreground">Reception Desk</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">v1.0</span>
          </div>
        )}
      </div>

      {/* User Account Menu Footer (shadcn NavUser pattern) */}
      {session && (
        <div
          className={cn(
            "border-t border-border/80 transition-all bg-card/40",
            isCollapsed ? "p-2" : "p-2.5"
          )}
        >
          <NavUser session={session} isCollapsed={isCollapsed} />
        </div>
      )}
    </aside>
  );
}
