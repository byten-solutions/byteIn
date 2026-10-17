import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const startTime = Date.now()
  let dbStatus = "disconnected"
  let isHealthy = false

  try {
    // Ping database with lightweight query
    await prisma.$queryRaw`SELECT 1`
    dbStatus = "connected"
    isHealthy = true
  } catch (error) {
    dbStatus = "disconnected"
    isHealthy = false
    // Log masked internal error without leaking details to client
    console.error("[HealthCheck] Database connection check failed:", error instanceof Error ? error.message : "Unknown error")
  }

  const responseBody = {
    status: isHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    database: dbStatus,
    latencyMs: Date.now() - startTime,
    version: "0.0.1",
  }

  const statusCode = isHealthy ? 200 : 503

  return NextResponse.json(responseBody, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  })
}
