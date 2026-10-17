"use client";

import * as React from "react";
import type { SessionPayload } from "@/modules/auth/auth.types";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarProvider, useSidebar } from "@/components/sidebar-context";
import { X } from "lucide-react";

interface AppShellProps {
  session: SessionPayload | null;
  stats?: {
    cleanRooms?: number;
    dirtyRooms?: number;
  };
  children: React.ReactNode;
}

function AppShellInner({ session, stats, children }: AppShellProps) {
  const { mobileOpen, setMobileOpen } = useSidebar();

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

  // If user is unauthenticated (e.g. login or public error), render clean unboxed layout
  if (!session) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader session={null} />
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
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

      {/* 3. Main Workspace Area (Fixed height with scrollable main) */}
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        <AppHeader session={session} stats={stats} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  return (
    <SidebarProvider>
      <AppShellInner {...props} />
    </SidebarProvider>
  );
}

