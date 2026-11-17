"use client"

import * as React from "react"

interface CacheEntry<T> {
  data: T
  timestamp: number
}

// 30 seconds freshness window: prevents stale financial figures while supporting snappy navigation
const REPORT_CACHE_TTL_MS = 30_000
const sessionCache = new Map<string, CacheEntry<unknown>>()

function getCachedData<T>(key: string): T | null {
  const entry = sessionCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > REPORT_CACHE_TTL_MS) {
    sessionCache.delete(key)
    return null
  }
  return entry.data as T
}

function setCachedData<T>(key: string, data: T): void {
  // Cap cache size to 50 entries
  if (sessionCache.size >= 50) {
    const oldestKey = sessionCache.keys().next().value
    if (oldestKey) sessionCache.delete(oldestKey)
  }
  sessionCache.set(key, { data, timestamp: Date.now() })
}

export function clearReportSessionCache(endpointPrefix?: string) {
  if (!endpointPrefix) {
    sessionCache.clear()
    return
  }
  for (const key of Array.from(sessionCache.keys())) {
    if (key.startsWith(endpointPrefix)) {
      sessionCache.delete(key)
    }
  }
}

export function invalidateReportCacheKeys(prefixes: string[]) {
  for (const key of Array.from(sessionCache.keys())) {
    for (const prefix of prefixes) {
      if (key.startsWith(prefix)) {
        sessionCache.delete(key)
      }
    }
  }
}

export interface UseReportQueryOptions {
  endpoint: string
  params: Record<string, string | number | boolean | undefined | null>
  enabled?: boolean
  refreshTrigger?: number
}

export interface UseReportQueryResult<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useReportQuery<T>({
  endpoint,
  params,
  enabled = true,
  refreshTrigger = 0,
}: UseReportQueryOptions): UseReportQueryResult<T> {
  const queryParams = React.useMemo(() => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        sp.set(k, String(v))
      }
    }
    return sp.toString()
  }, [params])

  const cacheKey = `${endpoint}${queryParams ? `?${queryParams}` : ""}`

  const [data, setData] = React.useState<T | null>(() => {
    return getCachedData<T>(cacheKey)
  })
  const [isLoading, setIsLoading] = React.useState<boolean>(() => {
    return getCachedData<T>(cacheKey) === null
  })
  const [error, setError] = React.useState<string | null>(null)
  const [localRefresh, setLocalRefresh] = React.useState<number>(0)

  // Immediately synchronize data and loading state when cacheKey changes (adjusting state during render)
  const [prevCacheKey, setPrevCacheKey] = React.useState(cacheKey)
  if (prevCacheKey !== cacheKey) {
    setPrevCacheKey(cacheKey)
    const cached = getCachedData<T>(cacheKey)
    setData(cached)
    setError(null)
    if (cached === null) {
      setIsLoading(true)
    }
  }

  const abortControllerRef = React.useRef<AbortController | null>(null)
  const requestIdRef = React.useRef<number>(0)
  const lastFetchedTriggerRef = React.useRef<number>(refreshTrigger)
  const lastFetchedLocalRef = React.useRef<number>(localRefresh)

  const fetchData = React.useCallback(async () => {
    if (!enabled) return

    const isGlobalRefresh = refreshTrigger !== lastFetchedTriggerRef.current
    const isLocalRefresh = localRefresh !== lastFetchedLocalRef.current

    lastFetchedTriggerRef.current = refreshTrigger
    lastFetchedLocalRef.current = localRefresh

    // Check valid freshness cache unless explicitly refreshed
    if (!isGlobalRefresh && !isLocalRefresh) {
      const cached = getCachedData<T>(cacheKey)
      if (cached !== null) {
        setData(cached)
        setIsLoading(false)
        setError(null)
        return
      }
    }

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller
    const currentRequestId = ++requestIdRef.current

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(cacheKey, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        throw new Error(errJson?.error || `Request failed with status ${res.status}`)
      }
      const json = await res.json()

      // Discard stale responses from out-of-order execution
      if (currentRequestId !== requestIdRef.current) {
        return
      }

      if (json && typeof json === "object" && "success" in json) {
        if (!json.success) {
          throw new Error(json.error || "Failed to load report data")
        }
        setCachedData(cacheKey, json.data)
        setData(json.data as T)
      } else {
        setCachedData(cacheKey, json)
        setData(json as T)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return
      }
      if (currentRequestId === requestIdRef.current) {
        const msg = err instanceof Error ? err.message : "Failed to load report"
        setError(msg)
      }
    } finally {
      if (currentRequestId === requestIdRef.current && abortControllerRef.current === controller) {
        setIsLoading(false)
      }
    }
  }, [cacheKey, enabled, refreshTrigger, localRefresh])

  React.useEffect(() => {
    let isMounted = true
    if (!enabled) return

    const run = async () => {
      await Promise.resolve()
      if (!isMounted) return
      await fetchData()
    }
    void run()

    return () => {
      isMounted = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [enabled, fetchData])

  const refetch = React.useCallback(() => {
    sessionCache.delete(cacheKey)
    setLocalRefresh((prev) => prev + 1)
  }, [cacheKey])

  return {
    data,
    isLoading,
    error,
    refetch,
  }
}
