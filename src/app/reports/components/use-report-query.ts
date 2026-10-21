"use client"

import * as React from "react"

const sessionCache = new Map<string, unknown>()

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
    if (sessionCache.has(cacheKey)) {
      return sessionCache.get(cacheKey) as T
    }
    return null
  })
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const [localRefresh, setLocalRefresh] = React.useState<number>(0)

  const abortControllerRef = React.useRef<AbortController | null>(null)
  const lastFetchedTriggerRef = React.useRef<number>(refreshTrigger)
  const lastFetchedLocalRef = React.useRef<number>(localRefresh)

  const fetchData = React.useCallback(async () => {
    if (!enabled) return

    const isGlobalRefresh = refreshTrigger !== lastFetchedTriggerRef.current
    const isLocalRefresh = localRefresh !== lastFetchedLocalRef.current

    lastFetchedTriggerRef.current = refreshTrigger
    lastFetchedLocalRef.current = localRefresh

    if (!isGlobalRefresh && !isLocalRefresh && sessionCache.has(cacheKey)) {
      setData(sessionCache.get(cacheKey) as T)
      setIsLoading(false)
      setError(null)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

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
      if (json && typeof json === "object" && "success" in json) {
        if (!json.success) {
          throw new Error(json.error || "Failed to load report data")
        }
        sessionCache.set(cacheKey, json.data)
        setData(json.data as T)
      } else {
        sessionCache.set(cacheKey, json)
        setData(json as T)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return
      }
      const msg = err instanceof Error ? err.message : "Failed to load report"
      setError(msg)
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false)
      }
    }
  }, [cacheKey, enabled, refreshTrigger, localRefresh])

  React.useEffect(() => {
    if (!enabled) return

    const isGlobalRefresh = refreshTrigger !== lastFetchedTriggerRef.current
    const isLocalRefresh = localRefresh !== lastFetchedLocalRef.current

    if (!isGlobalRefresh && !isLocalRefresh && sessionCache.has(cacheKey)) {
      setData(sessionCache.get(cacheKey) as T)
      setIsLoading(false)
      setError(null)
      return
    }

    fetchData()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [cacheKey, enabled, refreshTrigger, localRefresh, fetchData])

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
