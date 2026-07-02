import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  requireUser,
  listActiveChatConsents,
  getActiveChatConsent,
  grantChatConsent,
  revokeChatConsent,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  listActiveChatConsents: vi.fn(),
  getActiveChatConsent: vi.fn(),
  grantChatConsent: vi.fn(),
  revokeChatConsent: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireUser,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({}),
  },
}))

vi.mock("@/lib/chat/repository", () => ({
  listActiveChatConsents,
  getActiveChatConsent,
  grantChatConsent,
  revokeChatConsent,
}))

import { GET, PATCH } from "./route"

describe("chat consent route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns unauthenticated error shape when session is missing", async () => {
    requireUser.mockRejectedValue(
      new Response(JSON.stringify({ error: "กรุณาเข้าสู่ระบบ" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const response = await GET(new Request("http://localhost/api/chat/consent"))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toMatchObject({
      error: {
        code: "UNAUTHENTICATED",
        message: "กรุณาเข้าสู่ระบบ",
        retryable: false,
      },
    })
  })

  it("rejects invalid consent payloads with shared validation error shape", async () => {
    requireUser.mockResolvedValue({ id: "user-1" })

    const response = await PATCH(
      new Request("http://localhost/api/chat/consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ scope: "unknown", granted: true }] }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: "รูปแบบ consent ไม่ถูกต้อง",
      },
    })
    expect(grantChatConsent).not.toHaveBeenCalled()
  })
})
