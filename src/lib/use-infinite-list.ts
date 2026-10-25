"use client";

import * as React from "react";

export interface UseInfiniteListOptions<T, F extends Record<string, unknown> = Record<string, unknown>> {
  /** API endpoint to fetch chunks from (e.g. "/api/rooms") */
  endpoint: string;
  /** Chunk size (default 48) */
  limit?: number;
  /** Initial items hydrated by SSR */
  initialItems?: T[];
  /** Initial nextCursor hydrated by SSR */
  initialNextCursor?: string | null;
  /** Initial total count if available */
  initialTotal?: number;
  /** Filter parameters (when these change, list resets and aborts pending requests) */
  filters?: F;
  /** Extraction helper for custom API responses */
  transformResponse?: (json: unknown) => { items: T[]; nextCursor: string | null; total?: number };
  /** IntersectionObserver rootMargin (default "800px") */
  rootMargin?: string;
  /** Scroll position ratio to pre-trigger loading (default 0.75 for 75%) */
  thresholdRatio?: number;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseInfiniteListResult<T> {
  items: T[];
  total: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
  sentinelRef: (node: HTMLElement | null) => void;
}

export const DEFAULT_CHUNK_SIZE = 48;

function getScrollParent(element: HTMLElement | null): HTMLElement | Window {
  if (!element || typeof window === "undefined") return window;
  let parent = element.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
}

export function useInfiniteList<T, F extends Record<string, unknown> = Record<string, unknown>>({
  endpoint,
  limit = DEFAULT_CHUNK_SIZE,
  initialItems = [],
  initialNextCursor = null,
  initialTotal = 0,
  filters = {} as F,
  transformResponse,
  rootMargin = "800px",
  thresholdRatio = 0.75,
  onError,
}: UseInfiniteListOptions<T, F>): UseInfiniteListResult<T> {
  const [items, setItems] = React.useState<T[]>(initialItems);
  const [total, setTotal] = React.useState<number>(initialTotal || initialItems.length);
  const [nextCursor, setNextCursor] = React.useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = React.useState<boolean>(
    initialNextCursor !== null || initialItems.length >= limit
  );
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const isLoadingMoreRef = React.useRef<boolean>(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const isFirstRender = React.useRef<boolean>(true);
  const prevFiltersJson = React.useRef<string>(JSON.stringify(filters));
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const sentinelNodeRef = React.useRef<HTMLElement | null>(null);
  const cleanupScrollRef = React.useRef<(() => void) | null>(null);

  // Helper to extract items, nextCursor, and total from response
  const parseResponse = React.useCallback(
    (json: unknown): { items: T[]; nextCursor: string | null; total?: number } => {
      if (transformResponse) {
        return transformResponse(json);
      }

      if (json && typeof json === "object") {
        const obj = json as Record<string, unknown>;
        const rawItems = (obj.items || obj.rooms || obj.rows || obj.data) as unknown;
        const extractedItems = Array.isArray(rawItems) ? (rawItems as T[]) : [];
        const extractedNextCursor =
          typeof obj.nextCursor === "string"
            ? obj.nextCursor
            : obj.pagination && typeof (obj.pagination as Record<string, unknown>).nextCursor === "string"
            ? ((obj.pagination as Record<string, unknown>).nextCursor as string)
            : null;
        const extractedTotal =
          typeof obj.total === "number"
            ? obj.total
            : obj.pagination && typeof (obj.pagination as Record<string, unknown>).total === "number"
            ? ((obj.pagination as Record<string, unknown>).total as number)
            : undefined;

        return {
          items: extractedItems,
          nextCursor: extractedNextCursor,
          total: extractedTotal,
        };
      }

      return {
        items: Array.isArray(json) ? (json as T[]) : [],
        nextCursor: null,
      };
    },
    [transformResponse]
  );

  // Load next chunk
  const loadMore = React.useCallback(async () => {
    if (isLoading || isLoadingMoreRef.current || !hasMore) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set("limit", String(limit));
      if (nextCursor) {
        url.searchParams.set("cursor", nextCursor);
      }

      for (const [key, val] of Object.entries(filters)) {
        if (val !== undefined && val !== null && val !== "" && val !== "ALL") {
          url.searchParams.set(key, String(val));
        }
      }

      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Request failed with status ${res.status}`);
      }

      const json: unknown = await res.json();
      const parsed = parseResponse(json);

      setItems((prev) => {
        const existingIds = new Set(
          prev
            .map((item) => (typeof item === "object" && item !== null && "id" in item ? (item as { id: unknown }).id : null))
            .filter(Boolean)
        );
        const newItems = parsed.items.filter((item) => {
          const id = typeof item === "object" && item !== null && "id" in item ? (item as { id: unknown }).id : null;
          return !id || !existingIds.has(id);
        });
        return [...prev, ...newItems];
      });
      setNextCursor(parsed.nextCursor);
      setHasMore(Boolean(parsed.nextCursor && parsed.items.length > 0));
      if (parsed.total !== undefined) {
        setTotal(parsed.total);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj.message);
      onError?.(errObj);
    } finally {
      if (abortControllerRef.current === controller) {
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [endpoint, limit, nextCursor, hasMore, isLoading, filters, parseResponse, onError]);

  // Fetch initial chunk (resets list)
  const fetchInitial = React.useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set("limit", String(limit));

      for (const [key, val] of Object.entries(filters)) {
        if (val !== undefined && val !== null && val !== "" && val !== "ALL") {
          url.searchParams.set(key, String(val));
        }
      }

      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Request failed with status ${res.status}`);
      }

      const json: unknown = await res.json();
      const parsed = parseResponse(json);

      setItems(parsed.items);
      setNextCursor(parsed.nextCursor);
      setHasMore(Boolean(parsed.nextCursor && parsed.items.length > 0));
      if (parsed.total !== undefined) {
        setTotal(parsed.total);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj.message);
      onError?.(errObj);
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, [endpoint, limit, filters, parseResponse, onError]);

  // Handle filter changes (abort stale requests, reset list, scroll reset)
  React.useEffect(() => {
    const currentFiltersJson = JSON.stringify(filters);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (initialItems.length > 0) {
        return;
      }
    }

    if (prevFiltersJson.current !== currentFiltersJson) {
      prevFiltersJson.current = currentFiltersJson;
      // Filter changed: reset items and cursor
      setNextCursor(null);
      setHasMore(true);
      fetchInitial();
    }
  }, [filters, initialItems.length, fetchInitial]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (cleanupScrollRef.current) {
        cleanupScrollRef.current();
      }
    };
  }, []);

  // IntersectionObserver callback ref for the sentinel element
  const sentinelRef = React.useCallback(
    (node: HTMLElement | null) => {
      sentinelNodeRef.current = node;

      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (cleanupScrollRef.current) {
        cleanupScrollRef.current();
        cleanupScrollRef.current = null;
      }

      if (!node) return;

      const scrollParent = getScrollParent(node);
      const isCustomContainer = scrollParent instanceof HTMLElement;
      const observerRoot = isCustomContainer ? scrollParent : null;

      // 1. IntersectionObserver with generous rootMargin
      if (typeof IntersectionObserver !== "undefined") {
        const observer = new IntersectionObserver(
          (entries) => {
            const first = entries[0];
            if (first && first.isIntersecting && hasMore && !isLoading && !isLoadingMoreRef.current) {
              loadMore();
            }
          },
          { root: observerRoot, rootMargin }
        );

        observer.observe(node);
        observerRef.current = observer;
      }

      // 2. Pre-fetch scroll listener at thresholdRatio (e.g. 75%)
      let rafId: number | null = null;
      const checkScroll = () => {
        if (!hasMore || isLoading || isLoadingMoreRef.current) return;

        let scrollTop = 0;
        let scrollHeight = 0;
        let clientHeight = 0;

        if (isCustomContainer) {
          scrollTop = scrollParent.scrollTop;
          scrollHeight = scrollParent.scrollHeight;
          clientHeight = scrollParent.clientHeight;
        } else {
          scrollTop = window.scrollY || document.documentElement.scrollTop;
          scrollHeight = document.documentElement.scrollHeight;
          clientHeight = window.innerHeight;
        }

        if (scrollHeight <= clientHeight) return;

        // When user reaches ~75% of the scrollable content, pre-load the next chunk
        const scrollProgress = (scrollTop + clientHeight) / scrollHeight;
        if (scrollProgress >= thresholdRatio) {
          loadMore();
        }
      };

      const onScroll = () => {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          checkScroll();
        });
      };

      const scrollTarget = isCustomContainer ? scrollParent : window;
      scrollTarget.addEventListener("scroll", onScroll, { passive: true });
      if (isCustomContainer) {
        window.addEventListener("scroll", onScroll, { passive: true });
      }

      cleanupScrollRef.current = () => {
        scrollTarget.removeEventListener("scroll", onScroll);
        if (isCustomContainer) {
          window.removeEventListener("scroll", onScroll);
        }
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      };
    },
    [hasMore, isLoading, loadMore, rootMargin, thresholdRatio]
  );

  const reset = React.useCallback(() => {
    setNextCursor(null);
    setHasMore(true);
    fetchInitial();
  }, [fetchInitial]);

  return {
    items,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    retry: nextCursor ? loadMore : fetchInitial,
    reset,
    sentinelRef,
  };
}
