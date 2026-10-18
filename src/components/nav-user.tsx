"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Shield } from "lucide-react";
import type { SessionPayload } from "@/modules/auth/auth.types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NavUserProps {
  session: SessionPayload;
  isCollapsed?: boolean;
}

export function NavUser({ session, isCollapsed = false }: NavUserProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  const initials =
    session.name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isAdmin = session.role === "ADMIN" || isSuperAdmin;
  const roleLabel =
    session.role === "SUPER_ADMIN"
      ? "Super Admin"
      : session.role === "ADMIN"
      ? "Hotel Admin"
      : "Receptionist";

  return (
    <div className="relative w-full" ref={menuRef}>
      {/* User Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User account menu"
        title={isCollapsed ? `${session.name} (${roleLabel})` : undefined}
        className={cn(
          "flex items-center w-full rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isCollapsed
            ? "justify-center p-1.5 hover:bg-muted/80"
            : "gap-2.5 p-2 hover:bg-muted/80 text-foreground"
        )}
      >
        {/* Avatar */}
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg font-bold tracking-tight",
            isSuperAdmin
              ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30"
              : "bg-primary/10 text-primary border border-primary/20",
            isCollapsed ? "h-9 w-9 text-xs" : "h-8 w-8 text-xs"
          )}
        >
          {initials}
        </div>

        {/* User Info (when expanded) */}
        {!isCollapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold leading-tight text-foreground truncate">
                {session.name}
              </p>
              <p className="text-[10px] text-muted-foreground truncate leading-tight">
                {session.property?.name || (isSuperAdmin ? "Platform Admin" : session.email)}
              </p>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground/70" />
          </>
        )}
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 rounded-xl border border-border bg-card p-3 shadow-xl animate-in fade-in-0 zoom-in-95",
            isCollapsed
              ? "left-full bottom-0 ml-3 w-64"
              : "bottom-full left-0 right-0 mb-2 w-full min-w-[240px]"
          )}
        >
          {/* Header Card */}
          <div className="flex items-start gap-3 pb-3 border-b border-border/80">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold text-sm",
                isSuperAdmin
                  ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                  : "bg-primary/15 text-primary"
              )}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{session.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{session.email}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <Badge
                  variant={isSuperAdmin ? "default" : isAdmin ? "secondary" : "outline"}
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-4 font-semibold",
                    isSuperAdmin && "bg-purple-600 hover:bg-purple-700 text-white"
                  )}
                >
                  <Shield className="w-2.5 h-2.5 mr-1 inline" />
                  {roleLabel}
                </Badge>
              </div>
            </div>
          </div>

          {/* Hotel & Station Details */}
          <div className="py-2.5 px-1 text-[11px] text-muted-foreground space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0">Hotel:</span>
              <span
                className="font-medium text-foreground truncate max-w-[150px] text-right"
                title={session.property?.name || (isSuperAdmin ? "All Hotels (Platform)" : "Unassigned")}
              >
                {session.property?.name || (isSuperAdmin ? "All Hotels (Platform)" : "Unassigned")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Station Mode:</span>
              <span className="font-medium text-foreground">
                {isSuperAdmin ? "Platform Console" : "Reception Desk"}
              </span>
            </div>
          </div>

          {/* Sign Out Button */}
          <div className="border-t border-border/80 pt-2">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={loading}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{loading ? "Signing out..." : "Sign Out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
