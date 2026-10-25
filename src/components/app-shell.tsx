"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { SessionPayload } from "@/modules/auth/auth.types";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider, useSidebar } from "@/components/sidebar-context";
import { X } from "lucide-react";

interface AppShellProps {
  session?: SessionPayload | null;
  stats?: {
    cleanRooms?: number;
    dirtyRooms?: number;
  };
  children: React.ReactNode;
}

interface AppShellContextValue {
  isInShell: boolean;
  stats?: { cleanRooms?: number; dirtyRooms?: number };
  setStats: React.Dispatch<React.SetStateAction<{ cleanRooms?: number; dirtyRooms?: number } | undefined>>;
  setSession: React.Dispatch<React.SetStateAction<SessionPayload | null>>;
}

const AppShellContext = React.createContext<AppShellContextValue | null>(null);

function AppShellRoot({
  initialSession,
  initialStats,
  children,
}: {
  initialSession?: SessionPayload | null;
  initialStats?: { cleanRooms?: number; dirtyRooms?: number };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const [sessionOverride, setSessionOverride] = React.useState<SessionPayload | null>(null);
  const session = sessionOverride ?? initialSession ?? null;
  const [stats, setStats] = React.useState<{ cleanRooms?: number; dirtyRooms?: number } | undefined>(initialStats);
  const mainRef = React.useRef<HTMLElement>(null);

  // Scroll main container to top on route change
  React.useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [pathname]);

  // Close mobile menu on Escape
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, setMobileOpen]);

  // Bare pages (login, change password, print layouts) should never render the PMS shell
  const isBarePage =
    pathname === "/login" ||
    pathname === "/change-password" ||
    pathname.includes("/print");

  // Hydrate session if missing on protected routes
  React.useEffect(() => {
    if (!session && !isBarePage) {
      fetch("/api/auth/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user) {
            setSessionOverride({
              sub: data.user.id,
              email: data.user.email,
              name: data.user.name,
              role: data.user.role,
              propertyId: data.user.propertyId,
              property: data.user.property,
            });
          }
        })
        .catch(() => {});
    }
  }, [session, isBarePage]);

  const contextValue = React.useMemo<AppShellContextValue>(
    () => ({
      isInShell: true,
      stats,
      setStats,
      setSession: setSessionOverride,
    }),
    [stats]
  );

  // If bare page or unauthenticated, render children directly without shell
  if (isBarePage || !session) {
    return (
      <AppShellContext.Provider value={contextValue}>
        {children}
      </AppShellContext.Provider>
    );
  }

  return (
    <AppShellContext.Provider value={contextValue}>
      <div className="flex h-svh w-full overflow-hidden bg-background text-foreground">
        {/* 1. Desktop Persistent Collapsible Sidebar */}
        <AppSidebar session={session} className="hidden lg:flex" />

        {/* 2. Mobile Drawer & Backdrop */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer Content */}
            <div className="relative flex flex-col h-full w-72 max-w-[85vw] bg-card border-r border-border shadow-2xl z-50 animate-in slide-in-from-left duration-200">
              {/* Close Button Header */}
              <div className="absolute top-3 right-3 z-10">
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <AppSidebar
                session={session}
                forceExpanded
                className="w-full border-r-0 h-full"
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </div>
        )}

        {/* 3. Main Workspace Area (Persistent header and scrollable main content) */}
        <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
          <AppHeader session={session} stats={stats} />
          <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </AppShellContext.Provider>
  );
}

export function AppShell({ session, stats, children }: AppShellProps) {
  const existingShell = React.useContext(AppShellContext);

  // If already inside the persistent outer AppShell (from RootLayout),
  // relay stats and session updates up, and render children transparently.
  React.useEffect(() => {
    if (existingShell) {
      if (stats) {
        existingShell.setStats(stats);
      }
      return () => {
        if (stats) {
          existingShell.setStats(undefined);
        }
      };
    }
  }, [existingShell, stats]);

  React.useEffect(() => {
    if (existingShell && session) {
      existingShell.setSession(session);
    }
  }, [existingShell, session]);

  if (existingShell?.isInShell) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppShellRoot initialSession={session} initialStats={stats}>
        {children}
      </AppShellRoot>
    </SidebarProvider>
  );
}
