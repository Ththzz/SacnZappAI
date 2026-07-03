import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { queryRaw, deleteMany } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  deleteMany: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: queryRaw,
    rateLimitBucket: { deleteMany },
  },
}))

import { checkRateLimit, getClientIp } from "./rate-limit"

describe("rate limiting", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DATABASE_URL
  })

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = originalDatabaseUrl
  })

  it("blocks requests after the configured limit", async () => {
    const key = `test:${crypto.randomUUID()}`
    expect((await checkRateLimit(key, { limit: 2, windowMs: 60_000 })).allowed).toBe(true)
    expect((await checkRateLimit(key, { limit: 2, windowMs: 60_000 })).allowed).toBe(true)
    const blocked = await checkRateLimit(key, { limit: 2, windowMs: 60_000 })
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("uses the shared PostgreSQL bucket in production", async () => {
    process.env.DATABASE_URL = "postgresql://user:password@example.com:6543/postgres"
    queryRaw.mockResolvedValue([{ count: 3, reset_at: new Date(Date.now() + 60_000) }])

    const result = await checkRateLimit("auth:sign-in:203.0.113.10", {
      limit: 2,
      windowMs: 60_000,
    })

    expect(queryRaw).toHaveBeenCalledOnce()
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("uses the first forwarded address", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    })
    expect(getClientIp(request)).toBe("203.0.113.10")
  })
})
