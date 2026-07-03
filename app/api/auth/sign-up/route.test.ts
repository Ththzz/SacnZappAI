import { beforeEach, describe, expect, it, vi } from "vitest"

const { createSession, createUser } = vi.hoisted(() => ({
  createSession: vi.fn(),
  createUser: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  createSession,
  createUser,
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  getClientIp: () => "127.0.0.1",
}))

import { POST } from "./route"

function createSignUpRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/sign-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("public sign-up route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createUser.mockResolvedValue({
      user: { id: "user-1", name: "Demo User", email: "demo@example.com", role: "user" },
    })
  })

  it("always creates a regular user even when an admin role is submitted manually", async () => {
    const response = await POST(createSignUpRequest({
      name: "Demo User",
      email: "demo@example.com",
      password: "password123",
      role: "admin",
      adminCode: "attempted-bypass",
    }))

    expect(response.status).toBe(201)
    expect(createUser).toHaveBeenCalledWith({
      name: "Demo User",
      email: "demo@example.com",
      password: "password123",
      role: "user",
    })
    expect(createSession).toHaveBeenCalledWith("user-1")
  })

  it("returns a conflict for PostgreSQL unique email errors", async () => {
    createUser.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }))

    const response = await POST(createSignUpRequest({
      name: "Demo User",
      email: "used@example.com",
      password: "password123",
    }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: "อีเมลนี้ถูกใช้งานแล้ว" })
    expect(createSession).not.toHaveBeenCalled()
  })
})
