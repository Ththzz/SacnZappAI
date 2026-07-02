import { beforeEach, describe, expect, it, vi } from "vitest"

const { requireUser, findMany, upsert } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireUser }))
vi.mock("@/lib/db", () => ({
  prisma: {
    savedMealSuggestion: { findMany, upsert },
  },
}))

import { GET, POST } from "./route"

describe("saved meal suggestions collection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUser.mockResolvedValue({ id: "user-1" })
  })

  it("returns only the current user's saved suggestions", async () => {
    findMany.mockResolvedValue([{ id: "saved-1", name: "สลัดไก่" }])

    const response = await GET()

    expect(response.status).toBe(200)
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
    })
  })

  it("uses a normalized per-user key so saving the same menu is idempotent", async () => {
    upsert.mockResolvedValue({ id: "saved-1", name: "สลัดไก่" })

    const response = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "  สลัดไก่  ",
        calories: 320,
        protein: 30,
        carbs: 20,
        fat: 10,
      }),
    }))

    expect(response.status).toBe(201)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_normalizedName: {
          userId: "user-1",
          normalizedName: "สลัดไก่",
        },
      },
    }))
  })
})
