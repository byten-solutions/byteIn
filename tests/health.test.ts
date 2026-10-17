import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { GET } from "../src/app/api/health/route"

describe("DEP-003: Public Health Check Probe (/api/health)", () => {
  it("should return HTTP 200 with ok status and connected database when database is reachable", async () => {
    const response = await GET()

    assert.equal(response.status, 200)

    const data = await response.json()
    assert.equal(data.status, "ok")
    assert.equal(data.database, "connected")
    assert.equal(typeof data.timestamp, "string")
    assert.equal(typeof data.uptime, "number")
    assert.ok(data.uptime >= 0)
    assert.equal(typeof data.latencyMs, "number")
    assert.ok(data.latencyMs >= 0)
    assert.equal(data.version, "0.0.1")

    // Verify cache prevention headers for monitoring probes
    const cacheControl = response.headers.get("cache-control")
    assert.ok(cacheControl?.includes("no-store"), "Must include no-store in Cache-Control header")
  })

  it("should provide consistent health contract without requiring authentication", async () => {
    // Verify GET can be called without any session token or auth headers
    const response = await GET()
    assert.notEqual(response.status, 401, "Health probe must be publicly accessible without authentication")
    assert.notEqual(response.status, 403, "Health probe must not be restricted by role guards")
  })
})
