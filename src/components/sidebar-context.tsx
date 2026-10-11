"use client";

import * as React from "react";

interface SidebarContextValue {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebar: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleMobile: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

const SIDEBAR_STORAGE_KEY = "byteinn_sidebar_collapsed";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("byteinn:sidebar-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("byteinn:sidebar-change", callback);
  };
};

const getSnapshot = () => {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const getServerSnapshot = () => false;

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isCollapsed = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const [mobileOpen, setMobileOpen] = React.useState<boolean>(false);

  const setIsCollapsed = React.useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      try {
        const current = getSnapshot();
        const next = typeof value === "function" ? value(current) : value;
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
        window.dispatchEvent(new Event("byteinn:sidebar-change"));
      } catch {
        // Ignore storage errors
      }
    },
    []
  );

  const toggleSidebar = React.useCallback(() => {
    try {
      const current = getSnapshot();
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!current));
      window.dispatchEvent(new Event("byteinn:sidebar-change"));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleMobile = React.useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  // Keyboard shortcut: Cmd+B / Ctrl+B toggles desktop sidebar collapse
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (isTypingTarget(event.target)) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      isCollapsed,
      setIsCollapsed,
      toggleSidebar,
      mobileOpen,
      setMobileOpen,
      toggleMobile,
    }),
    [isCollapsed, setIsCollapsed, toggleSidebar, mobileOpen, toggleMobile]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

