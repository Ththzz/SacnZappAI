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

  it("returns an older cache immediately without blocking GET on AI", async () => {
    findCache.mockResolvedValue({
      userId: "user-1",
      suggestionsJson: JSON.stringify(suggestions),
      generatedAt: new Date(2020, 0, 1),
    })

    const response = await GET()
    const body = await response.json()

    expect(body.source).toBe("cache-stale")
    expect(body.isStale).toBe(true)
    expect(body.suggestions).toEqual(suggestions)
    expect(requestAiChat).not.toHaveBeenCalled()
  })

  it("forces a fresh AI result with POST and updates the cache", async () => {
    findCache.mockResolvedValue({
      userId: "user-1",
      suggestionsJson: JSON.stringify(suggestions),
      generatedAt: new Date(),
    })
    requestAiChat.mockResolvedValue({
      text: JSON.stringify([
        { name: "ต้มยำปลา", calories: 280, protein: 26, carbs: 12, fat: 8, reason: "โปรตีนสูง" },
      ]),
    })

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.source).toBe("ai")
    expect(body.suggestions[0]).toMatchObject({ name: "ต้มยำปลา", carbs: 12, fat: 8 })
    expect(requestAiChat).toHaveBeenCalledTimes(1)
    expect(requestAiChat).toHaveBeenCalledWith(expect.objectContaining({
      timeoutMs: 25_000,
      maxTokens: 500,
    }))
    expect(upsertCache).toHaveBeenCalledTimes(1)
  })

  it("falls back to stale cache when AI refresh fails", async () => {
    findCache.mockResolvedValue({
      userId: "user-1",
      suggestionsJson: JSON.stringify(suggestions),
      generatedAt: new Date(2020, 0, 1),
    })
    requestAiChat.mockRejectedValue(new Error("AI unavailable"))

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.source).toBe("cache-stale")
    expect(body.isStale).toBe(true)
    expect(body.suggestions).toEqual(suggestions)
  })
})
