import { AsyncLocalStorage } from "node:async_hooks";
import { NextRequest, NextResponse } from "next/server";

export interface RequestMetrics {
  queryCount: number;
  dbMs: number;
}

export const requestMetricsStorage = new AsyncLocalStorage<RequestMetrics>();

/**
 * Wraps a route handler to collect database timing and query count metrics,
 * injects the standard W3C Server-Timing header, and logs a single JSON line.
 */
export async function withReportTiming(
  endpoint: string,
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const metrics: RequestMetrics = { queryCount: 0, dbMs: 0 };
  const startTotal = performance.now();

  return requestMetricsStorage.run(metrics, async () => {
    try {
      const response = await handler();
      const totalMs = Math.round((performance.now() - startTotal) * 10) / 10;
      const dbMs = Math.round(metrics.dbMs * 10) / 10;

      // Inject Server-Timing header (W3C specification format)
      response.headers.set(
        "Server-Timing",
        `total;dur=${totalMs}, db;dur=${dbMs}, queries;desc="${metrics.queryCount}"`
      );

      // Log single JSON line for observability (no secrets)
      const logEntry = {
        type: "report_timing",
        endpoint,
        status: response.status,
        totalMs,
        dbMs,
        queryCount: metrics.queryCount,
        timestamp: new Date().toISOString(),
      };
      console.warn(JSON.stringify(logEntry));

      return response;
    } catch (error) {
      const totalMs = Math.round((performance.now() - startTotal) * 10) / 10;
      const dbMs = Math.round(metrics.dbMs * 10) / 10;
      console.error(
        JSON.stringify({
          type: "report_timing_error",
          endpoint,
          totalMs,
          dbMs,
          queryCount: metrics.queryCount,
          timestamp: new Date().toISOString(),
        })
      );
      throw error;
    }
  });
}
