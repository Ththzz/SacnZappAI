import { beforeEach, describe, expect, it, vi } from "vitest"

const { requireUser, requestAiChat, findMeals, findCache, upsertCache, findSettings } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requestAiChat: vi.fn(),
  findMeals: vi.fn(),
  findCache: vi.fn(),
  upsertCache: vi.fn(),
  findSettings: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireUser }))
vi.mock("@/lib/ai/provider", () => ({
  AiProviderError: class AiProviderError extends Error {},
  defaultAiModel: "qwen/test",
  requestAiChat,
}))
vi.mock("@/lib/db", () => ({
  prisma: {
    meal: { findMany: findMeals },
    mealSuggestionCache: { findUnique: findCache, upsert: upsertCache },
    userSettings: { findUnique: findSettings },
  },
}))

import { GET, POST } from "./route"

const meals = [
  {
    id: "meal-1",
    date: "2026-06-29",
    time: "12:00",
    name: "ข้าวไก่",
    calories: 450,
    protein: 25,
    carbs: 55,
    fat: 12,
  },
]

const suggestions = [
  {
    id: "suggestion-1",
    name: "สลัดอกไก่",
    calories: 320,
    protein: 30,
    carbs: 20,
    fat: 10,
    reason: "เพิ่มโปรตีน",
  },
]

describe("meal suggestions cache", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.QWEN_API_KEY = "test-key"
    delete process.env.MEAL_SUGGESTION_MODEL
    requireUser.mockResolvedValue({ id: "user-1" })
    findMeals.mockResolvedValue(meals)
    findSettings.mockResolvedValue({ settingsJson: JSON.stringify({ healthGoal: { dailyCalories: 1800 } }) })
    upsertCache.mockResolvedValue({})
  })

  it("returns today's cache without calling AI", async () => {
    findCache.mockResolvedValue({
      userId: "user-1",
      suggestionsJson: JSON.stringify(suggestions),
      generatedAt: new Date(),
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.source).toBe("cache")
    expect(body.suggestions).toEqual(suggestions)
    expect(requestAiChat).not.toHaveBeenCalled()
  })

  it("returns an older cache without starting AI generation", async () => {
    findCache.mockResolvedValue({
      userId: "user-1",
      suggestionsJson: JSON.stringify(suggestions),
      generatedAt: new Date(2020, 0, 1),
    })

    const response = await GET()
    const body = await response.json()

    expect(body.source).toBe("cache-stale")
    expect(body.isStale).toBe(true)
    expect(body.refreshing).toBe(false)
    expect(body.suggestions).toEqual(suggestions)
    expect(requestAiChat).not.toHaveBeenCalled()
    expect(findMeals).not.toHaveBeenCalled()
    expect(findSettings).not.toHaveBeenCalled()
  })

  it("returns no suggestions from GET when there is no saved cache", async () => {
    findCache.mockResolvedValue(null)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.source).toBe("empty")
    expect(body.suggestions).toEqual([])
    expect(requestAiChat).not.toHaveBeenCalled()
    expect(findMeals).not.toHaveBeenCalled()
  })

  it("generates, saves, and returns fresh suggestions only from POST", async () => {
    requestAiChat.mockResolvedValue({
      text: JSON.stringify([
        { name: "ต้มยำปลา", calories: 280, protein: 26, carbs: 12, fat: 8, reason: "โปรตีนสูง" },
      ]),
    })

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.source).toBe("generated")
    expect(body.refreshing).toBe(false)
    expect(body.suggestions).toEqual([
      expect.objectContaining({ name: "ต้มยำปลา", calories: 280, protein: 26 }),
    ])
    expect(requestAiChat).toHaveBeenCalledTimes(1)
    expect(requestAiChat).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen/qwen3.6-flash",
      timeoutMs: 12_000,
      maxTokens: 320,
      enableThinking: false,
    }))
    expect(upsertCache).toHaveBeenCalledTimes(1)
  })

  it("returns an error and preserves the existing cache when generation fails", async () => {
    requestAiChat.mockRejectedValue(new Error("AI unavailable"))

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toContain("สร้างคำแนะนำใหม่ไม่สำเร็จ")
    expect(upsertCache).not.toHaveBeenCalled()
  })

  it("does not call AI when POST has no recent meals", async () => {
    findMeals.mockResolvedValue([])

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toContain("ต้องมีข้อมูลมื้ออาหาร")
    expect(requestAiChat).not.toHaveBeenCalled()
  })
})
