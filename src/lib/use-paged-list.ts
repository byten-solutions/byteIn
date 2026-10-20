"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export interface UsePagedListOptions<T, F extends Record<string, unknown> = Record<string, unknown>> {
  /** The base API endpoint to fetch data from (e.g. "/api/reports/daily-operations/list") */
  endpoint: string;
  /** Initial rows provided by SSR */
  initialRows?: T[];
  /** Initial total count provided by SSR */
  initialTotal?: number;
  /** Initial page (default 1 or from searchParams) */
  initialPage?: number;
  /** Initial limit (default 25 or from searchParams) */
  initialLimit?: number;
  /** Initial search query */
  initialQ?: string;
  /** Initial custom filters object */
  initialFilters?: F;
  /** Initial sort column */
  initialSort?: string;
  /** Initial sort direction */
  initialDir?: "asc" | "desc";
  /** Debounce delay for search query in milliseconds (default 300ms) */
  debounceMs?: number;
  /** Whether to sync state to browser URL search parameters (default true) */
  syncUrl?: boolean;
  /** Custom data extractor if API response format differs from { rows: T[], total: number } */
  transformResponse?: (json: unknown) => { rows: T[]; total: number };
}

export interface UsePagedListResult<T, F extends Record<string, unknown> = Record<string, unknown>> {
  rows: T[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  q: string;
  filters: F;
  sort: string | undefined;
  dir: "asc" | "desc" | undefined;
  isLoading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setQ: (q: string) => void;
  setFilter: <K extends keyof F>(key: K, value: F[K]) => void;
  setFilters: (filters: Partial<F>) => void;
  setSort: (sortField: string, sortDir?: "asc" | "desc") => void;
  retry: () => void;
  refetch: () => void;
}

export function usePagedList<T, F extends Record<string, unknown> = Record<string, unknown>>({
  endpoint,
  initialRows = [],
  initialTotal = 0,
  initialPage = DEFAULT_PAGE,
  initialLimit = DEFAULT_PAGE_SIZE,
  initialQ = "",
  initialFilters = {} as F,
  initialSort,
  initialDir = "desc",
  debounceMs = 300,
  syncUrl = true,
  transformResponse,
}: UsePagedListOptions<T, F>): UsePagedListResult<T, F> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize from searchParams if available
  const urlPage = searchParams?.get("page") ? parseInt(searchParams.get("page")!, 10) : undefined;
  const urlLimit = searchParams?.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;
  const urlQ = searchParams?.get("q") ?? undefined;
  const urlSort = searchParams?.get("sort") ?? undefined;
  const urlDir = (searchParams?.get("dir") as "asc" | "desc") ?? undefined;

  const [rows, setRows] = React.useState<T[]>(initialRows);
  const [total, setTotal] = React.useState<number>(initialTotal);
  const [page, setPageState] = React.useState<number>(!isNaN(urlPage ?? NaN) ? urlPage! : initialPage);
  const [limit, setLimitState] = React.useState<number>(!isNaN(urlLimit ?? NaN) ? urlLimit! : initialLimit);
  const [q, setQState] = React.useState<string>(urlQ ?? initialQ);
  const [debouncedQ, setDebouncedQ] = React.useState<string>(q);
  const [filters, setFiltersState] = React.useState<F>(initialFilters);
  const [sort, setSortState] = React.useState<string | undefined>(urlSort ?? initialSort);
  const [dir, setDirState] = React.useState<"asc" | "desc" | undefined>(urlDir ?? initialDir);

  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const abortControllerRef = React.useRef<AbortController | null>(null);
  const isFirstRender = React.useRef<boolean>(true);

  // Debounce search query changes
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(q);
    }, debounceMs);
    return () => clearTimeout(handler);
  }, [q, debounceMs]);

  // Synchronize state with browser URL search parameters
  const updateUrl = React.useCallback(
    (nextState: { page: number; limit: number; q?: string; sort?: string; dir?: string; filters?: F }) => {
      if (!syncUrl || !router || !pathname) return;
      const params = new URLSearchParams(searchParams ? searchParams.toString() : "");

      params.set("page", String(nextState.page));
      params.set("limit", String(nextState.limit));

      if (nextState.q && nextState.q.trim()) {
        params.set("q", nextState.q.trim());
      } else {
        params.delete("q");
      }

      if (nextState.sort) {
        params.set("sort", nextState.sort);
        if (nextState.dir) params.set("dir", nextState.dir);
      }

      if (nextState.filters) {
        for (const [key, val] of Object.entries(nextState.filters)) {
          if (val !== undefined && val !== null && val !== "") {
            params.set(key, String(val));
          } else {
            params.delete(key);
          }
        }
      }

      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [syncUrl, router, pathname, searchParams]
  );

  // Fetch function using AbortController to abort stale requests
  const fetchData = React.useCallback(async () => {
    // Abort previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));

      if (debouncedQ.trim()) {
        url.searchParams.set("q", debouncedQ.trim());
      }
      if (sort) {
        url.searchParams.set("sort", sort);
        if (dir) url.searchParams.set("dir", dir);
      }

      for (const [key, val] of Object.entries(filters)) {
        if (val !== undefined && val !== null && val !== "") {
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
      let extractedRows: T[] = [];
      let extractedTotal = 0;

      if (transformResponse) {
        const transformed = transformResponse(json);
        extractedRows = transformed.rows;
        extractedTotal = transformed.total;
      } else if (
        json &&
        typeof json === "object" &&
        "data" in json &&
        json.data &&
        typeof json.data === "object" &&
        "rows" in json.data &&
        Array.isArray((json.data as { rows: unknown }).rows)
      ) {
        const d = json.data as { rows: T[]; total?: number };
        extractedRows = d.rows;
        extractedTotal = d.total ?? d.rows.length;
      } else if (
        json &&
        typeof json === "object" &&
        "rows" in json &&
        Array.isArray((json as { rows: unknown }).rows)
      ) {
        const d = json as { rows: T[]; total?: number };
        extractedRows = d.rows;
        extractedTotal = d.total ?? d.rows.length;
      } else if (
        json &&
        typeof json === "object" &&
        "items" in json &&
        Array.isArray((json as { items: unknown }).items)
      ) {
        const d = json as { items: T[]; total?: number };
        extractedRows = d.items;
        extractedTotal = d.total ?? d.items.length;
      } else if (Array.isArray(json)) {
        extractedRows = json as T[];
        extractedTotal = json.length;
      }

      setRows(extractedRows);
      setTotal(extractedTotal);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // Request was aborted by newer request; keep state intact
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to load records";
      setError(message);
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, [endpoint, page, limit, debouncedQ, filters, sort, dir, transformResponse]);

  // Effect to trigger fetch on dependency changes
  React.useEffect(() => {
    // If it's the very first render and we have initialRows, don't double fetch
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (initialRows.length > 0 || initialTotal > 0) {
        return;
      }
    }
    fetchData();
  }, [fetchData, initialRows.length, initialTotal]);

  // State mutators that handle URL sync and page resets
  const setPage = React.useCallback(
    (newPage: number) => {
      setPageState(newPage);
      updateUrl({ page: newPage, limit, q, sort, dir, filters });
    },
    [limit, q, sort, dir, filters, updateUrl]
  );

  const setLimit = React.useCallback(
    (newLimit: number) => {
      // Reset to page 1 on limit change
      setLimitState(newLimit);
      setPageState(1);
      updateUrl({ page: 1, limit: newLimit, q, sort, dir, filters });
    },
    [q, sort, dir, filters, updateUrl]
  );

  const setQ = React.useCallback(
    (newQ: string) => {
      setQState(newQ);
      // Reset to page 1 when query changes
      setPageState(1);
      updateUrl({ page: 1, limit, q: newQ, sort, dir, filters });
    },
    [limit, sort, dir, filters, updateUrl]
  );

  const setFilter = React.useCallback(
    <K extends keyof F>(key: K, value: F[K]) => {
      setFiltersState((prev) => {
        const next = { ...prev, [key]: value };
        // Reset to page 1 on filter change
        setPageState(1);
        updateUrl({ page: 1, limit, q, sort, dir, filters: next });
        return next;
      });
    },
    [limit, q, sort, dir, updateUrl]
  );

  const setFilters = React.useCallback(
    (partialFilters: Partial<F>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...partialFilters };
        setPageState(1);
        updateUrl({ page: 1, limit, q, sort, dir, filters: next });
        return next;
      });
    },
    [limit, q, sort, dir, updateUrl]
  );

  const setSort = React.useCallback(
    (sortField: string, sortDir?: "asc" | "desc") => {
      let resolvedDir = sortDir;
      if (!resolvedDir) {
        resolvedDir = sort === sortField && dir === "asc" ? "desc" : "asc";
      }
      setSortState(sortField);
      setDirState(resolvedDir);
      setPageState(1);
      updateUrl({ page: 1, limit, q, sort: sortField, dir: resolvedDir, filters });
    },
    [sort, dir, limit, q, filters, updateUrl]
  );

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));

  return {
    rows,
    total,
    totalPages,
    page,
    limit,
    q,
    filters,
    sort,
    dir,
    isLoading,
    error,
    setPage,
    setLimit,
    setQ,
    setFilter,
    setFilters,
    setSort,
    retry: fetchData,
    refetch: fetchData,
  };
}
