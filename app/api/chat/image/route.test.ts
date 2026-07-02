import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { requireUser, getActiveChatConsent, analyzeFoodImage } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getActiveChatConsent: vi.fn(),
  analyzeFoodImage: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireUser,
}))

vi.mock("@/lib/db", () => ({
  prisma: {},
}))

vi.mock("@/lib/chat/repository", () => ({
  getActiveChatConsent,
}))

vi.mock("@/lib/ai/food-analysis", () => ({
  analyzeFoodImage,
  MAX_FOOD_IMAGE_BYTES: 8 * 1024 * 1024,
}))

import { POST } from "./route"

describe("chat image route", () => {
  const originalApiKey = process.env.QWEN_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    requireUser.mockResolvedValue({ id: "user-1" })
    getActiveChatConsent.mockResolvedValue({ id: "consent-1" })
    process.env.QWEN_API_KEY = "test-key"
  })

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.QWEN_API_KEY
    } else {
      process.env.QWEN_API_KEY = originalApiKey
    }
  })

  it("requires image consent", async () => {
    getActiveChatConsent.mockResolvedValue(null)

    const response = await POST(
      new Request("http://localhost/api/chat/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: "data:image/png;base64,aGVsbG8=" }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toMatchObject({
      error: {
        code: "CONSENT_REQUIRED",
      },
    })
  })

  it("returns a reusable chat image context note", async () => {
    analyzeFoodImage.mockResolvedValue({
      model: "qwen/test",
      rawPreview: "{}",
      analysis: {
        isFood: true,
        reason: "",
        name: "ข้าวกะเพรา",
        calories: 520,
        protein: 22,
        carbs: 48,
        fat: 24,
        confidence: 82,
        note: "ค่าประมาณ",
      },
    })

    const response = await POST(
      new Request("http://localhost/api/chat/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: "data:image/png;base64,aGVsbG8=" }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      provenanceLabel: "ภาพอาหารที่แนบ",
      analysis: {
        name: "ข้าวกะเพรา",
      },
    })
    expect(body.contextNote).toContain("ข้าวกะเพรา")
  })
})
