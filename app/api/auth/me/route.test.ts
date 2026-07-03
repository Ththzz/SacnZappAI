import { beforeEach, describe, expect, it, vi } from "vitest"

const { getCurrentUser } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  getCurrentUser,
}))

import { GET } from "./route"

describe("current user route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when no session is present", async () => {
    getCurrentUser.mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "กรุณาเข้าสู่ระบบ" })
  })

  it("returns the authenticated user", async () => {
    const user = { id: "user-1", name: "Demo", email: "demo@example.com", role: "user" }
    getCurrentUser.mockResolvedValue(user)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ user })
  })
})
