import { beforeEach, describe, expect, it, vi } from "vitest"

const { queryRaw } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: { $queryRaw: queryRaw },
}))

import { GET } from "./route"

describe("deployment health route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("reports a healthy database without caching the response", async () => {
    queryRaw.mockResolvedValue([{ value: 1 }])

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(body).toMatchObject({ status: "ok", database: "ok" })
  })

  it("returns 503 without exposing the database error", async () => {
    queryRaw.mockRejectedValue(new Error("postgresql://secret@example.com"))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({ status: "error", database: "unavailable" })
    expect(JSON.stringify(body)).not.toContain("secret")
  })
})
