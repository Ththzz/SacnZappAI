import { describe, expect, it } from "vitest"

import { checkRateLimit, getClientIp } from "./rate-limit"

describe("rate limiting", () => {
  it("blocks requests after the configured limit", () => {
    const key = `test:${crypto.randomUUID()}`
    expect(checkRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed).toBe(true)
    expect(checkRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed).toBe(true)
    const blocked = checkRateLimit(key, { limit: 2, windowMs: 60_000 })
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("uses the first forwarded address", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    })
    expect(getClientIp(request)).toBe("203.0.113.10")
  })
})
