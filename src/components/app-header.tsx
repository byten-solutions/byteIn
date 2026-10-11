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
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 sm:px-6 backdrop-blur supports-backdrop-filter:bg-background/60">
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

        <div className="flex items-center gap-1.5 text-xs font-medium truncate ml-1">
          <span className="hidden sm:inline text-muted-foreground/60">PMS</span>
          <ChevronRight className="hidden sm:inline size-3.5 text-muted-foreground/40" />
          <h1 className="text-xs sm:text-sm font-semibold text-foreground truncate tracking-tight">
            {title}
          </h1>
        </div>
      </div>

      {/* Right: Quick Clean/Dirty link, Theme Switch */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Compact Clean/Dirty status link */}
        {stats && (stats.cleanRooms !== undefined || stats.dirtyRooms !== undefined) && (
          <Link
            href="/rooms"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60 transition-colors"
            title="View rooms status"
          >
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span>{stats.cleanRooms ?? 0} clean</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="size-1.5 rounded-full bg-amber-500" />
            <span>{stats.dirtyRooms ?? 0} dirty</span>
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
