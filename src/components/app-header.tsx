"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft, ChevronRight, CheckCircle2, Clock } from "lucide-react";
import type { SessionPayload } from "@/modules/auth/auth.types";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSidebar } from "@/components/sidebar-context";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  session: SessionPayload | null;
  stats?: {
    cleanRooms?: number;
    dirtyRooms?: number;
  };
}

const routeTitles: Record<string, string> = {
  "/": "Overview",
  "/reservations": "Reservations",
  "/reservations/new": "New Reservation",
  "/billing": "Billing & Invoices",
  "/customers": "Guest Directory",
  "/rooms": "Rooms & Maintenance",
  "/categories": "Room Categories & Setup",
};

export function AppHeader({ session, stats }: AppHeaderProps) {
  const pathname = usePathname();
  const { toggleSidebar, toggleMobile } = useSidebar();

  // Determine page title
  const title =
    routeTitles[pathname] ||
    (pathname.startsWith("/reservations/")
      ? "Reservation Details"
      : pathname.startsWith("/billing/")
      ? "Invoice Details"
      : pathname.startsWith("/customers/")
      ? "Guest Profile"
      : "byteInn");

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 sm:px-6 backdrop-blur supports-backdrop-filter:bg-background/60">
      {/* Left: Sidebar Toggle Buttons & Title / Breadcrumb */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu trigger */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden w-8 h-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80"
          onClick={toggleMobile}
          aria-label="Open mobile navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Desktop collapsible sidebar trigger */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden lg:flex w-8 h-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar (⌘B)"
          title="Toggle sidebar (⌘B)"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 text-xs font-medium truncate ml-1">
          <span className="hidden sm:inline text-muted-foreground/70">PMS</span>
          <ChevronRight className="hidden sm:inline h-3.5 w-3.5 text-muted-foreground/40" />
          <h1 className="text-sm font-semibold text-foreground truncate tracking-tight">
            {title}
          </h1>
        </div>
      </div>

      {/* Right: Quick Stats, Theme Switch (Profile menu removed per design) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Room Status Pills (if stats available) */}
        {stats && (stats.cleanRooms !== undefined || stats.dirtyRooms !== undefined) && (
          <div className="hidden md:flex items-center gap-2 text-xs">
            {stats.cleanRooms !== undefined && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80 text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>{stats.cleanRooms} Clean</span>
              </div>
            )}
            {stats.dirtyRooms !== undefined && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/80 text-[11px] font-semibold">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>{stats.dirtyRooms} Dirty</span>
              </div>
            )}
          </div>
        )}

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Fallback Sign In link when unauthenticated */}
        {!session && (
          <Link
            href="/login"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
