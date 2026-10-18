"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, PanelLeft, ChevronRight } from "lucide-react"
import type { SessionPayload } from "@/modules/auth/auth.types"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSidebar } from "@/components/sidebar-context"
import { Button } from "@/components/ui/button"

interface AppHeaderProps {
  session: SessionPayload | null
  stats?: {
    cleanRooms?: number
    dirtyRooms?: number
  }
}

const routeTitles: Record<string, string> = {
  "/": "Overview",
  "/reservations": "Reservations",
  "/reservations/new": "New Reservation",
  "/billing": "Billing",
  "/customers": "Guests",
  "/reports": "Reports & Analytics",
  "/rooms": "Rooms",
  "/categories": "Room Categories",
}

export function AppHeader({ session, stats }: AppHeaderProps) {
  const pathname = usePathname()
  const { toggleSidebar, toggleMobile } = useSidebar()

  // Determine page title
  const title =
    routeTitles[pathname] ||
    (pathname.startsWith("/reservations/")
      ? "Reservation Details"
      : pathname.startsWith("/billing/")
      ? "Invoice Details"
      : pathname.startsWith("/customers/")
      ? "Guest Profile"
      : "byteInn")

  return (
    <header className="sticky top-0 z-30 flex h-13 shrink-0 items-center justify-between gap-4 border-b border-border/80 bg-background/85 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Sidebar Toggle Buttons & Title / Breadcrumb */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        {/* Mobile menu trigger */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80"
          onClick={toggleMobile}
          aria-label="Open mobile navigation"
        >
          <Menu className="size-4" />
        </Button>

        {/* Desktop collapsible sidebar trigger */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden lg:flex size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar (⌘B)"
          title="Toggle sidebar (⌘B)"
        >
          <PanelLeft className="size-4" />
        </Button>

        <div className="flex items-center gap-2 text-xs font-medium truncate ml-1">
          <span className="hidden sm:inline font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            PMS
          </span>
          <ChevronRight className="hidden sm:inline size-3.5 text-muted-foreground/40" />
          <h1 className="text-xs sm:text-sm font-semibold text-foreground truncate tracking-tight">
            {title}
          </h1>
        </div>
      </div>

      {/* Right: Quick Clean/Dirty link, Theme Switch */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Compact Clean/Dirty status link */}
        {stats && (stats.cleanRooms !== undefined || stats.dirtyRooms !== undefined) && (
          <Link
            href="/rooms"
            prefetch={true}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 border border-border/80 shadow-2xs transition-all"
            title="View rooms status"
          >
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 shadow-2xs shrink-0" />
              <span className="font-mono tabular-nums font-semibold text-foreground">
                {stats.cleanRooms ?? 0}
              </span>
              <span className="text-[11px] text-muted-foreground">clean</span>
            </span>
            <span className="text-muted-foreground/30">|</span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500 shadow-2xs shrink-0" />
              <span className="font-mono tabular-nums font-semibold text-foreground">
                {stats.dirtyRooms ?? 0}
              </span>
              <span className="text-[11px] text-muted-foreground">dirty</span>
            </span>
          </Link>
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
  )
}
