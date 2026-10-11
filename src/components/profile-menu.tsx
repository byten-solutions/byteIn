"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Shield } from "lucide-react";
import type { SessionPayload } from "@/modules/auth/auth.types";
import { Badge } from "@/components/ui/badge";

interface ProfileMenuProps {
  session: SessionPayload;
}

export function ProfileMenu({ session }: ProfileMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close when clicking outside
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

  const initials = session.name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  const isAdmin = session.role === "ADMIN";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1 rounded-full hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User profile menu"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold tracking-tight">
          {initials}
        </div>
        <div className="hidden md:flex flex-col text-left">
          <span className="text-xs font-semibold leading-none text-foreground truncate max-w-[120px]">
            {session.name}
          </span>
          <span className="text-[10px] text-muted-foreground capitalize leading-tight">
            {session.role.toLowerCase()}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card p-3 shadow-lg z-50 animate-in fade-in-0 zoom-in-95">
          {/* User Details Header */}
          <div className="flex items-start gap-3 pb-3 border-b border-border/80">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-sm">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{session.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{session.email}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <Badge
                  variant={isAdmin ? "default" : "secondary"}
                  className="text-[10px] px-1.5 py-0 h-4 font-semibold"
                >
                  <Shield className="w-2.5 h-2.5 mr-1 inline" />
                  {session.role}
                </Badge>
              </div>
            </div>
          </div>

          {/* Session Information */}
          <div className="py-2.5 px-1 text-[11px] text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span>Station Mode:</span>
              <span className="font-medium text-foreground">Reception Desk</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Session Duration:</span>
              <span className="font-medium text-foreground">8 Hours Shift</span>
            </div>
          </div>

          {/* Divider */}
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
